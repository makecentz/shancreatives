-- Row Level Security. Every table has RLS enabled. The service role (used only
-- in server code: webhooks, checkout creation) bypasses RLS; the browser only
-- ever holds the anon key plus the user's own JWT.

create or replace function public.staff_role(uid uuid default auth.uid()) returns text
language sql stable security definer set search_path = public as $$
  select role from public.staff_roles where user_id = uid and is_active
$$;

-- Mirrors src/lib/auth/roles.ts. Keep the two in sync (tests cover the TS side).
create or replace function public.has_permission(perm text, uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public as $$
  select case public.staff_role(uid)
    when 'owner' then true
    when 'manager' then perm = any (array[
      'dashboard.view','orders.view','orders.manage','custom_orders.manage','products.manage','inventory.manage',
      'customers.view','analytics.view','discounts.manage','shipping.manage','content.manage','fulfillment.update'])
    when 'fulfillment' then perm = any (array['orders.view','fulfillment.update'])
    else false
  end
$$;

create or replace function public.is_staff(uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public as $$
  select public.staff_role(uid) is not null
$$;

do $$
declare t text;
begin
  foreach t in array array['profiles','staff_roles','categories','products','product_categories','product_variants','product_media',
    'customization_fields','carts','cart_items','pickup_locations','shipping_rates','tax_settings','discounts','orders','order_items',
    'custom_uploads','pickup_details','shipments','payment_attempts','payments','refunds','webhook_events','inventory_reservations',
    'inventory_movements','site_content','notifications','audit_logs','newsletter_subscribers','email_log']
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Profiles: customers see and edit only their own; staff with customers.view can read.
create policy profiles_self_select on public.profiles for select using (id = auth.uid() or public.has_permission('customers.view'));
create policy profiles_self_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_self_insert on public.profiles for insert with check (id = auth.uid());

-- Staff roles: only owners manage; staff can read their own row.
create policy staff_roles_read on public.staff_roles for select using (user_id = auth.uid() or public.has_permission('staff.manage'));
create policy staff_roles_write on public.staff_roles for all using (public.has_permission('staff.manage')) with check (public.has_permission('staff.manage'));

-- Public catalogue: anyone reads visible/active rows; product managers write.
create policy categories_public_read on public.categories for select using (is_visible or public.has_permission('products.manage'));
create policy categories_write on public.categories for all using (public.has_permission('products.manage')) with check (public.has_permission('products.manage'));

create policy products_public_read on public.products for select using (status in ('active','out_of_stock') or public.is_staff());
create policy products_write on public.products for all using (public.has_permission('products.manage')) with check (public.has_permission('products.manage'));

create policy product_categories_read on public.product_categories for select using (true);
create policy product_categories_write on public.product_categories for all using (public.has_permission('products.manage')) with check (public.has_permission('products.manage'));

create policy variants_public_read on public.product_variants for select using (
  exists (select 1 from public.products p where p.id = product_id and (p.status in ('active','out_of_stock') or public.is_staff())));
create policy variants_write on public.product_variants for all
  using (public.has_permission('products.manage') or public.has_permission('inventory.manage'))
  with check (public.has_permission('products.manage') or public.has_permission('inventory.manage'));

create policy media_public_read on public.product_media for select using (
  exists (select 1 from public.products p where p.id = product_id and (p.status in ('active','out_of_stock') or public.is_staff())));
create policy media_write on public.product_media for all using (public.has_permission('products.manage')) with check (public.has_permission('products.manage'));

create policy fields_public_read on public.customization_fields for select using (
  exists (select 1 from public.products p where p.id = product_id and (p.status in ('active','out_of_stock') or public.is_staff())));
create policy fields_write on public.customization_fields for all using (public.has_permission('products.manage')) with check (public.has_permission('products.manage'));

-- Carts: signed-in users own theirs. Guest carts are only touched by server code (service role).
create policy carts_owner on public.carts for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy cart_items_owner on public.cart_items for all
  using (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = auth.uid()));

-- Shipping / pickup / tax configuration
create policy pickup_public_read on public.pickup_locations for select using (is_active or public.has_permission('shipping.manage'));
create policy pickup_write on public.pickup_locations for all using (public.has_permission('shipping.manage')) with check (public.has_permission('shipping.manage'));
create policy rates_public_read on public.shipping_rates for select using (is_active or public.has_permission('shipping.manage'));
create policy rates_write on public.shipping_rates for all using (public.has_permission('shipping.manage')) with check (public.has_permission('shipping.manage'));
create policy tax_read on public.tax_settings for select using (true);
create policy tax_write on public.tax_settings for update using (public.has_permission('settings.manage'));

-- Discounts: never readable by the public (codes are validated server-side).
create policy discounts_staff on public.discounts for all using (public.has_permission('discounts.manage')) with check (public.has_permission('discounts.manage'));

-- Orders: customers read their own; staff with orders.view read; orders are
-- created and payment fields changed only by server code (service role).
create policy orders_owner_read on public.orders for select using (user_id = auth.uid() or public.has_permission('orders.view'));
create policy orders_staff_update on public.orders for update
  using (public.has_permission('orders.manage') or public.has_permission('fulfillment.update'))
  with check (public.has_permission('orders.manage') or public.has_permission('fulfillment.update'));

-- Payment columns can't be changed through the API by staff; only the service
-- role or the SECURITY DEFINER payment/reconciliation functions (which run as
-- their owner, so current_user is no longer the API role) can change them.
create or replace function public.guard_order_payment_columns() returns trigger
language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon')
     and (new.payment_status, new.payment_provider, new.total_cents, new.refunded_cents, new.paid_at)
         is distinct from (old.payment_status, old.payment_provider, old.total_cents, old.refunded_cents, old.paid_at) then
    raise exception 'payment fields may only change through verified payment events or audited reconciliation';
  end if;
  return new;
end $$;
create trigger orders_guard_payment before update on public.orders for each row execute function public.guard_order_payment_columns();

create policy order_items_read on public.order_items for select using (
  exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.has_permission('orders.view'))));
create policy order_items_production_update on public.order_items for update using (public.has_permission('fulfillment.update'));

create policy uploads_owner_read on public.custom_uploads for select using (owner_user_id = auth.uid() or public.has_permission('orders.view'));

create policy pickup_details_read on public.pickup_details for select using (
  exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.has_permission('orders.view'))));
create policy pickup_details_write on public.pickup_details for all using (public.has_permission('fulfillment.update')) with check (public.has_permission('fulfillment.update'));

create policy shipments_read on public.shipments for select using (
  exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.has_permission('orders.view'))));
create policy shipments_write on public.shipments for all using (public.has_permission('fulfillment.update')) with check (public.has_permission('fulfillment.update'));

-- Payments / refunds / attempts / webhooks: read-only to authorised staff; writes are service-role only.
create policy attempts_staff_read on public.payment_attempts for select using (public.has_permission('payments.view') or public.has_permission('orders.manage'));
create policy payments_read on public.payments for select using (
  public.has_permission('payments.view') or public.has_permission('orders.manage')
  or exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));
create policy refunds_read on public.refunds for select using (public.has_permission('payments.view') or public.has_permission('orders.refund'));
create policy webhook_events_read on public.webhook_events for select using (public.has_permission('payments.view'));

create policy reservations_staff_read on public.inventory_reservations for select using (public.has_permission('inventory.manage'));
create policy movements_staff_read on public.inventory_movements for select using (public.has_permission('inventory.manage'));

create policy site_content_public_read on public.site_content for select using (true);
create policy site_content_write on public.site_content for all using (public.has_permission('content.manage')) with check (public.has_permission('content.manage'));

create policy notifications_staff on public.notifications for select using (public.is_staff());
create policy notifications_mark_read on public.notifications for update using (public.is_staff());

create policy audit_owner_read on public.audit_logs for select using (public.has_permission('staff.manage'));

create policy email_log_staff on public.email_log for select using (public.has_permission('orders.manage'));
-- newsletter_subscribers: insert happens via server route only; no public policies.
