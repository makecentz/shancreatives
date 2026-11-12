// Applies the Supabase migrations to an in-memory Postgres (PGlite) with small
// stand-ins for Supabase's auth/storage schemas and default grants, then checks
// the inventory, payment, refund, reconciliation and RLS rules end to end.
// Run: npm run test:sql
import { PGlite } from "@electric-sql/pglite";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import fs from "node:fs";
const dir = process.argv[2] ?? new URL("../supabase/migrations", import.meta.url).pathname;
const db = new PGlite({ extensions: { citext, pgcrypto } });
// Minimal stand-ins for the Supabase-provided auth/storage schemas and roles.
await db.exec(`
create role anon; create role authenticated; create role service_role;
create schema auth; create schema storage;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
alter table storage.objects enable row level security;
-- Supabase's default grants: RLS, not table privileges, is the real gate.
grant usage on schema public, auth, storage to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
grant all on all tables in schema storage to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;
create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;
`);
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
  try { await db.exec(fs.readFileSync(`${dir}/${f}`, "utf8")); console.log("applied", f); }
  catch (e) { console.error("FAILED", f, e.message); process.exit(1); }
}
const q = async (sql, params) => (await db.query(sql, params)).rows;
const one = async (sql, params) => (await q(sql, params))[0];
let failures = 0;
const check = (name, cond) => { console.log(cond ? "  ok  " : "  FAIL", name); if (!cond) failures++; };
const throws = async (name, fn, re) => { try { await fn(); check(name, false); } catch (e) { check(name + ` (${e.message.slice(0, 60)})`, !re || re.test(e.message)); } };

// Fixtures
const owner = (await one(`insert into auth.users (email) values ('owner@example.com') returning id`)).id;
const ful = (await one(`insert into auth.users (email) values ('ful@example.com') returning id`)).id;
check("profile created by trigger", (await q(`select 1 from public.profiles where id=$1`, [owner])).length === 1);
await q(`insert into public.staff_roles (user_id, role) values ($1,'owner'), ($2,'fulfillment')`, [owner, ful]);
const prod = (await one(`insert into public.products (slug,name,status,base_price_cents) values ('tee','Tee','active',2500) returning id`)).id;
const v = (await one(`insert into public.product_variants (product_id,sku,stock_quantity) values ($1,'T-1',3) returning id`, [prod])).id;
const mkOrder = async (total = 5000) => (await one(`insert into public.orders (customer_name,customer_email,delivery_method,shipping_address,subtotal_cents,total_cents) values ('A','a@example.com','shipping','{}',$1,$1) returning id`, [total])).id;

// Inventory
const o1 = await mkOrder();
await q(`insert into public.order_items (order_id,product_id,variant_id,product_name,product_slug,quantity,unit_price_cents,line_total_cents) values ($1,$2,$3,'Tee','tee',2,2500,5000)`, [o1, prod, v]);
await q(`select public.reserve_inventory($1, $2::jsonb)`, [o1, JSON.stringify([{ variant_id: v, quantity: 2 }])]);
check("reserve increments reserved", (await one(`select reserved_quantity r from public.product_variants where id=$1`, [v])).r === 2);
await q(`select public.reserve_inventory($1, $2::jsonb)`, [o1, JSON.stringify([{ variant_id: v, quantity: 2 }])]);
check("re-reserve for retry is idempotent", (await one(`select reserved_quantity r from public.product_variants where id=$1`, [v])).r === 2);
const o2 = await mkOrder();
await throws("cannot oversell", () => q(`select public.reserve_inventory($1, $2::jsonb)`, [o2, JSON.stringify([{ variant_id: v, quantity: 2 }])]), /insufficient_stock/);

// Payments
const att = (await one(`insert into public.payment_attempts (order_id,provider,status,amount_cents,idempotency_key) values ($1,'stripe','pending',5000,'k1') returning id`, [o1])).id;
await throws("second in-flight attempt blocked by unique index", () => q(`insert into public.payment_attempts (order_id,provider,status,amount_cents,idempotency_key) values ($1,'square','pending',5000,'k2')`, [o1]));
check("first success recorded", (await one(`select public.record_payment_success($1,'pi_1',5000) r`, [att])).r === true);
check("repeated webhook is a no-op", (await one(`select public.record_payment_success($1,'pi_1',5000) r`, [att])).r === false);
const o1r = await one(`select payment_status, fulfillment_status, inventory_committed_at from public.orders where id=$1`, [o1]);
check("order paid", o1r.payment_status === "paid" && o1r.fulfillment_status === "paid" && o1r.inventory_committed_at);
check("exactly one payment row", (await one(`select count(*)::int c from public.payments where order_id=$1`, [o1])).c === 1);
const vr = await one(`select stock_quantity s, reserved_quantity r from public.product_variants where id=$1`, [v]);
check("stock committed once (3-2=1, reserved 0)", vr.s === 1 && vr.r === 0);
check("one sale movement", (await one(`select count(*)::int c from public.inventory_movements where order_id=$1`, [o1])).c === 1);

// A late second processor success on an already-paid order is flagged, not double-fulfilled.
const att2 = (await one(`insert into public.payment_attempts (order_id,provider,status,amount_cents,idempotency_key) values ($1,'square','failed',5000,'k3') returning id`, [o1])).id;
await q(`update public.payment_attempts set status='pending' where id=$1`, [att2]);
check("duplicate payment returns false", (await one(`select public.record_payment_success($1,'sq_1',5000) r`, [att2])).r === false);
check("duplicate flagged unknown", (await one(`select status from public.payment_attempts where id=$1`, [att2])).status === "unknown");
check("still one payment row", (await one(`select count(*)::int c from public.payments where order_id=$1`, [o1])).c === 1);

// Amount mismatch
const o3 = await mkOrder(4000);
const att3 = (await one(`insert into public.payment_attempts (order_id,provider,status,amount_cents,idempotency_key) values ($1,'stripe','pending',4000,'k4') returning id`, [o3])).id;
check("amount mismatch rejected", (await one(`select public.record_payment_success($1,'pi_x',100) r`, [att3])).r === false);
check("mismatch -> requires_reconciliation", (await one(`select payment_status from public.orders where id=$1`, [o3])).payment_status === "requires_reconciliation");

// Failure releases stock
const o4 = await mkOrder(2500);
await q(`select public.reserve_inventory($1, $2::jsonb)`, [o4, JSON.stringify([{ variant_id: v, quantity: 1 }])]);
const att4 = (await one(`insert into public.payment_attempts (order_id,provider,status,amount_cents,idempotency_key) values ($1,'stripe','pending',2500,'k5') returning id`, [o4])).id;
await q(`select public.record_payment_failure($1,'failed','card_declined')`, [att4]);
check("failure marks order failed", (await one(`select payment_status from public.orders where id=$1`, [o4])).payment_status === "failed");
check("failure releases reservation", (await one(`select reserved_quantity r from public.product_variants where id=$1`, [v])).r === 0);
check("late success on failed attempt is not auto-fulfilled", (await one(`select public.record_payment_success($1,'pi_late',2500) r`, [att4])).r === false);
check("late success flags order for reconciliation", (await one(`select payment_status from public.orders where id=$1`, [o4])).payment_status === "requires_reconciliation");

// Refunds
const pay = await one(`select id from public.payments where order_id=$1`, [o1]);
const rf = (await one(`insert into public.refunds (payment_id,order_id,provider,amount_cents,idempotency_key,requested_by) values ($1,$2,'stripe',2000,'r1',$3) returning id`, [pay.id, o1, owner])).id;
await q(`select public.record_refund_result($1,'succeeded','re_1')`, [rf]);
await q(`select public.record_refund_result($1,'succeeded','re_1')`, [rf]);
const o1f = await one(`select refunded_cents, payment_status from public.orders where id=$1`, [o1]);
check("partial refund applied once", Number(o1f.refunded_cents) === 2000 && o1f.payment_status === "partially_refunded");

// Order items are immutable
await throws("order items cannot be edited", () => q(`update public.order_items set unit_price_cents=1 where order_id=$1`, [o1]));

// RLS + role checks as authenticated users
const as = async (uid, fn) => { await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${uid}',false); select set_config('request.jwt.claim.role','authenticated',false);`); try { return await fn(); } finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub','',false); select set_config('request.jwt.claim.role','',false);`); } };
await as(ful, async () => {
  await throws("fulfillment can't adjust stock", () => q(`select public.adjust_stock($1, 5, 'restock')`, [v]), /not authorised/);
  await throws("fulfillment can't reconcile payments", () => q(`select public.reconcile_payment($1,'succeeded','pi','note here')`, [att3]), /not authorised/);
  check("fulfillment can view orders", (await q(`select id from public.orders`)).length >= 1);
  await throws("fulfillment can't set payment status", () => q(`update public.orders set payment_status='paid' where id=$1`, [o4]));
  check("fulfillment can't read payments", (await q(`select id from public.payments`)).length === 0);
});
await as(owner, async () => {
  check("owner adjusts stock", (await one(`select public.adjust_stock($1, 5, 'restock', 'new batch') s`, [v])).s === 6);
  await throws("owner can't call payment success directly", () => q(`select public.record_payment_success($1,'pi',4000)`, [att3]), /permission denied/);
  await q(`select public.reconcile_payment($1,'succeeded','pi_verified','checked in Stripe dashboard')`, [att3]);
  await throws("owner can't hand-edit payment status", () => q(`update public.orders set payment_status='paid' where id=$1`, [o4]));
});
check("reconciled order is paid", (await one(`select payment_status from public.orders where id=$1`, [o3])).payment_status === "paid");
check("reconciliation audited", (await one(`select count(*)::int c from public.audit_logs where action='payment.reconcile'`)).c === 1);
const anonUser = (await one(`insert into auth.users (email) values ('c@example.com') returning id`)).id;
await as(anonUser, async () => {
  check("customer can't see other customers' orders", (await q(`select id from public.orders`)).length === 0);
  check("customer can't read discounts", (await q(`select id from public.discounts`)).length === 0);
  check("customer can't read staff roles", (await q(`select user_id from public.staff_roles`)).length === 0);
  check("customer can read active products", (await q(`select id from public.products`)).length === 1);
});
await db.exec(`set role anon;`);
check("anon can't read orders", (await q(`select id from public.orders`)).length === 0);
await db.exec(`reset role;`);
console.log(failures ? `\n${failures} FAILED` : "\nall SQL checks passed");
process.exit(failures ? 1 : 0);
