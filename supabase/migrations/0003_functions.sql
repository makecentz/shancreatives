-- Transactional business functions. Called from server code with the service
-- role (or by staff where noted). Each runs in a single transaction.

-- Create a profile for each new auth user.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Reserve stock for an order, all-or-nothing. items: [{variant_id, quantity}]
-- Locks variant rows so concurrent checkouts cannot oversell.
create or replace function public.reserve_inventory(p_order_id uuid, p_items jsonb, p_ttl interval default interval '45 minutes')
returns void language plpgsql security definer set search_path = public as $$
declare
  it jsonb;
  v record;
  qty int;
  limit_qty int;
begin
  for it in select * from jsonb_array_elements(p_items) loop
    qty := (it ->> 'quantity')::int;
    -- Re-reserving for a retry: an already-active reservation is just extended.
    if exists (select 1 from public.inventory_reservations
               where order_id = p_order_id and variant_id = (it ->> 'variant_id')::uuid and status = 'active') then
      update public.inventory_reservations set expires_at = now() + p_ttl
        where order_id = p_order_id and variant_id = (it ->> 'variant_id')::uuid;
      continue;
    end if;
    if exists (select 1 from public.inventory_reservations
               where order_id = p_order_id and variant_id = (it ->> 'variant_id')::uuid and status = 'committed') then
      continue;
    end if;
    select pv.id, pv.stock_quantity, pv.reserved_quantity, p.production_capacity
      into v
      from public.product_variants pv join public.products p on p.id = pv.product_id
      where pv.id = (it ->> 'variant_id')::uuid
      for update of pv;
    if not found then raise exception 'unknown variant %', it ->> 'variant_id'; end if;
    limit_qty := coalesce(v.stock_quantity, v.production_capacity);
    if limit_qty is not null and limit_qty - v.reserved_quantity < qty then
      raise exception 'insufficient_stock:%:%', v.id, greatest(0, limit_qty - v.reserved_quantity) using errcode = 'P0001';
    end if;
    update public.product_variants set reserved_quantity = reserved_quantity + qty where id = v.id;
    insert into public.inventory_reservations (order_id, variant_id, quantity, expires_at)
      values (p_order_id, v.id, qty, now() + p_ttl)
      on conflict (order_id, variant_id) do update set quantity = excluded.quantity, expires_at = excluded.expires_at, status = 'active';
  end loop;
end $$;

-- Release an order's active reservations (payment expired / definitively failed / cancelled).
create or replace function public.release_inventory(p_order_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select * from public.inventory_reservations where order_id = p_order_id and status = 'active' for update loop
    update public.product_variants set reserved_quantity = greatest(0, reserved_quantity - r.quantity) where id = r.variant_id;
    update public.inventory_reservations set status = 'released' where id = r.id;
  end loop;
end $$;

-- Commit reservations into stock movements on verified payment. Idempotent:
-- inventory_committed_at is set once, so a repeated webhook does nothing.
create or replace function public.commit_inventory(p_order_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  r record;
  new_stock int;
  already timestamptz;
begin
  select inventory_committed_at into already from public.orders where id = p_order_id for update;
  if already is not null then return false; end if;
  for r in select * from public.inventory_reservations where order_id = p_order_id and status = 'active' for update loop
    update public.product_variants
      set reserved_quantity = greatest(0, reserved_quantity - r.quantity),
          stock_quantity = case when stock_quantity is null then null else greatest(0, stock_quantity - r.quantity) end
      where id = r.variant_id
      returning stock_quantity into new_stock;
    update public.inventory_reservations set status = 'committed' where id = r.id;
    insert into public.inventory_movements (variant_id, change, reason, order_id, stock_after)
      values (r.variant_id, -r.quantity, 'sale', p_order_id, new_stock);
  end loop;
  update public.orders set inventory_committed_at = now() where id = p_order_id;
  return true;
end $$;

-- Staff stock adjustment with movement history and audit log.
create or replace function public.adjust_stock(p_variant_id uuid, p_change int, p_reason text, p_note text default null)
returns int language plpgsql security definer set search_path = public as $$
declare new_stock int;
begin
  if not public.has_permission('inventory.manage') then raise exception 'not authorised'; end if;
  update public.product_variants
    set stock_quantity = coalesce(stock_quantity, 0) + p_change
    where id = p_variant_id and coalesce(stock_quantity, 0) + p_change >= reserved_quantity
    returning stock_quantity into new_stock;
  if not found then raise exception 'stock cannot go below reserved quantity'; end if;
  insert into public.inventory_movements (variant_id, change, reason, note, stock_after, created_by)
    values (p_variant_id, p_change, p_reason, p_note, new_stock, auth.uid());
  insert into public.audit_logs (actor_id, actor_role, action, entity_type, entity_id, after)
    values (auth.uid(), public.staff_role(), 'inventory.adjust', 'product_variant', p_variant_id::text,
      jsonb_build_object('change', p_change, 'reason', p_reason, 'stock_after', new_stock));
  if new_stock <= (select low_stock_threshold from public.product_variants where id = p_variant_id) then
    insert into public.notifications (kind, title, variant_id, link)
      values ('low_inventory', 'Low stock: ' || (select sku from public.product_variants where id = p_variant_id), p_variant_id, '/admin/inventory');
  end if;
  return new_stock;
end $$;

-- Record a verified successful payment. Idempotent and duplicate-proof:
--  * the unique partial index allows only one succeeded attempt per order
--  * payments.order_id is unique
--  * a repeated webhook returns false and changes nothing
create or replace function public.record_payment_success(
  p_attempt_id uuid, p_provider_payment_id text, p_amount_cents bigint,
  p_card_brand text default null, p_card_last4 text default null, p_receipt_url text default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  a record;
  o record;
begin
  select * into a from public.payment_attempts where id = p_attempt_id for update;
  if not found then raise exception 'unknown attempt %', p_attempt_id; end if;
  if a.status in ('succeeded', 'partially_refunded', 'refunded') then return false; end if;
  select * into o from public.orders where id = a.order_id for update;
  if a.status in ('failed', 'canceled', 'expired') then
    -- The processor reports money taken on an attempt we had closed (and whose
    -- stock was released). Never auto-fulfil: flag it for owner review.
    update public.payment_attempts set status = 'unknown', provider_payment_id = p_provider_payment_id,
      failure_reason = 'late_success_after_' || a.status where id = a.id;
    update public.orders set payment_status = 'requires_reconciliation' where id = o.id and payment_status <> 'paid';
    insert into public.notifications (kind, title, order_id, link)
      values ('reconciliation_needed', 'Late payment received on ' || o.order_number, o.id, '/admin/payments');
    return false;
  end if;
  if o.payment_status = 'paid' then
    -- A different attempt already paid this order: flag for reconciliation/refund, never double-fulfil.
    update public.payment_attempts set status = 'unknown', provider_payment_id = p_provider_payment_id,
      failure_reason = 'duplicate_payment_requires_refund' where id = a.id;
    insert into public.notifications (kind, title, order_id, link)
      values ('reconciliation_needed', 'Duplicate payment detected on ' || o.order_number, o.id, '/admin/payments');
    return false;
  end if;
  if p_amount_cents <> o.total_cents then
    update public.payment_attempts set status = 'unknown', failure_reason = 'amount_mismatch' where id = a.id;
    update public.orders set payment_status = 'requires_reconciliation' where id = o.id;
    insert into public.notifications (kind, title, order_id, link)
      values ('reconciliation_needed', 'Payment amount mismatch on ' || o.order_number, o.id, '/admin/payments');
    return false;
  end if;

  update public.payment_attempts set status = 'succeeded', provider_payment_id = p_provider_payment_id where id = a.id;
  insert into public.payments (order_id, payment_attempt_id, provider, provider_payment_id, amount_cents, card_brand, card_last4, receipt_url)
    values (o.id, a.id, a.provider, p_provider_payment_id, p_amount_cents, p_card_brand, p_card_last4, p_receipt_url);
  update public.orders set payment_status = 'paid', payment_provider = a.provider, paid_at = now(),
    fulfillment_status = case when is_custom_order then 'design_review' else 'paid' end
    where id = o.id;
  perform public.commit_inventory(o.id);
  if o.discount_code is not null then
    update public.discounts set usage_count = usage_count + 1 where code = o.discount_code;
  end if;
  update public.products p set units_sold = units_sold + oi.quantity
    from public.order_items oi where oi.order_id = o.id and oi.product_id = p.id;
  insert into public.notifications (kind, title, order_id, link)
    values ('new_order', 'New order ' || o.order_number, o.id, '/admin/orders/' || o.id);
  return true;
end $$;

-- Record a definitive failure / cancellation / expiry and release stock.
create or replace function public.record_payment_failure(p_attempt_id uuid, p_status text, p_reason text default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare a record;
begin
  if p_status not in ('failed', 'canceled', 'expired') then raise exception 'invalid failure status %', p_status; end if;
  select * into a from public.payment_attempts where id = p_attempt_id for update;
  if not found then raise exception 'unknown attempt'; end if;
  if a.status not in ('created', 'pending', 'unknown') then return false; end if;
  update public.payment_attempts set status = p_status, failure_reason = p_reason where id = a.id;
  if not exists (select 1 from public.payment_attempts where order_id = a.order_id and status in ('created','pending','unknown','succeeded')) then
    update public.orders set payment_status = 'failed' where id = a.order_id and payment_status <> 'paid';
    perform public.release_inventory(a.order_id);
  end if;
  if p_status = 'failed' then
    insert into public.notifications (kind, title, order_id, link)
      select 'payment_failed', 'Payment failed for ' || order_number, id, '/admin/orders/' || id from public.orders where id = a.order_id;
  end if;
  return true;
end $$;

-- Sweep expired reservations (schedule with pg_cron or a Vercel cron hitting /api/cron/release-reservations).
create or replace function public.release_expired_reservations() returns int
language plpgsql security definer set search_path = public as $$
declare n int := 0; r record;
begin
  for r in
    select distinct ir.order_id from public.inventory_reservations ir
    join public.orders o on o.id = ir.order_id
    where ir.status = 'active' and ir.expires_at < now() and o.payment_status in ('unpaid','pending','failed')
      and not exists (select 1 from public.payment_attempts pa where pa.order_id = ir.order_id and pa.status in ('pending','unknown'))
  loop
    perform public.release_inventory(r.order_id);
    n := n + 1;
  end loop;
  return n;
end $$;

revoke execute on function public.reserve_inventory(uuid, jsonb, interval) from public, anon, authenticated;
revoke execute on function public.release_inventory(uuid) from public, anon, authenticated;
revoke execute on function public.commit_inventory(uuid) from public, anon, authenticated;
revoke execute on function public.record_payment_success(uuid, text, bigint, text, text, text) from public, anon, authenticated;
revoke execute on function public.record_payment_failure(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.release_expired_reservations() from public, anon, authenticated;
grant execute on function public.adjust_stock(uuid, int, text, text) to authenticated;

-- Apply a refund outcome (from the provider API response or webhook). Idempotent.
create or replace function public.record_refund_result(p_refund_id uuid, p_status text, p_provider_refund_id text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  r record;
  total_refunded bigint;
  pay record;
begin
  select * into r from public.refunds where id = p_refund_id for update;
  if not found then raise exception 'unknown refund'; end if;
  if r.status = p_status then return; end if;
  if r.status in ('succeeded', 'failed', 'canceled') then return; end if; -- terminal
  update public.refunds set status = p_status, provider_refund_id = coalesce(p_provider_refund_id, provider_refund_id) where id = r.id;
  if p_status <> 'succeeded' then return; end if;

  select coalesce(sum(amount_cents), 0) into total_refunded from public.refunds where payment_id = r.payment_id and status = 'succeeded';
  select * into pay from public.payments where id = r.payment_id;
  update public.orders set
    refunded_cents = total_refunded,
    payment_status = case when total_refunded >= pay.amount_cents then 'refunded' else 'partially_refunded' end
    where id = r.order_id;
  update public.payment_attempts set status = case when total_refunded >= pay.amount_cents then 'refunded' else 'partially_refunded' end
    where id = pay.payment_attempt_id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
    values (r.requested_by, 'refund.succeeded', 'order', r.order_id::text, jsonb_build_object('refund_id', r.id, 'amount_cents', r.amount_cents, 'total_refunded', total_refunded));
end $$;
revoke execute on function public.record_refund_result(uuid, text, text) from public, anon, authenticated;

-- Audited manual reconciliation (owner only). The only path besides verified
-- provider events that can change a payment status. Requires the provider's
-- payment id so the decision is traceable to the processor's own records.
create or replace function public.reconcile_payment(p_attempt_id uuid, p_resolution text, p_provider_payment_id text, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare a record;
begin
  if not public.has_permission('orders.refund') then raise exception 'not authorised'; end if;
  if p_resolution not in ('succeeded', 'failed') then raise exception 'invalid resolution'; end if;
  if coalesce(trim(p_note), '') = '' or coalesce(trim(p_provider_payment_id), '') = '' then
    raise exception 'a note and the provider payment id are required';
  end if;
  select * into a from public.payment_attempts where id = p_attempt_id for update;
  if a.status not in ('unknown', 'pending') then raise exception 'attempt is not awaiting reconciliation'; end if;
  insert into public.audit_logs (actor_id, actor_role, action, entity_type, entity_id, before, after)
    values (auth.uid(), public.staff_role(), 'payment.reconcile', 'payment_attempt', a.id::text, to_jsonb(a),
      jsonb_build_object('resolution', p_resolution, 'provider_payment_id', p_provider_payment_id, 'note', p_note));
  if p_resolution = 'succeeded' then
    update public.payment_attempts set status = 'pending' where id = a.id and status = 'unknown';
    perform public.record_payment_success(a.id, p_provider_payment_id, a.amount_cents);
  else
    update public.payment_attempts set status = 'pending' where id = a.id and status = 'unknown';
    perform public.record_payment_failure(a.id, 'failed', 'reconciled: ' || p_note);
  end if;
end $$;
grant execute on function public.reconcile_payment(uuid, text, text, text) to authenticated;
