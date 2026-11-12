-- Shagannan Shenanigans: core schema
-- Money is always integer cents (bigint). Never floats.

create extension if not exists pgcrypto;
create extension if not exists citext;

-- updated_at helper
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email citext,
  phone text,
  default_shipping_address jsonb,
  saved_addresses jsonb not null default '[]'::jsonb,
  marketing_opt_in boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.staff_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'manager', 'fulfillment')),
  display_name text,
  is_active boolean not null default true,
  invited_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Catalogue
-- ---------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  description text not null default '',
  image_path text,
  sort_order int not null default 0,
  is_visible boolean not null default true,
  parent_id uuid references public.categories (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  short_description text not null default '',
  description text not null default '',
  status text not null default 'draft' check (status in ('draft', 'active', 'archived', 'out_of_stock')),
  fulfillment_type text not null default 'ready_made' check (fulfillment_type in ('ready_made', 'custom', 'both')),
  customizer_kind text check (customizer_kind in ('shirt', 'crochet_doll', 'generic')),
  base_price_cents bigint not null check (base_price_cents >= 0),
  sale_price_cents bigint check (sale_price_cents >= 0),
  production_days_min int check (production_days_min >= 0),
  production_days_max int check (production_days_max >= production_days_min),
  production_capacity int check (production_capacity >= 0), -- optional limited capacity for made-to-order
  quote_only boolean not null default false,
  rush_available boolean not null default false,
  rush_fee_cents bigint not null default 0 check (rush_fee_cents >= 0),
  is_featured boolean not null default false,
  is_seasonal boolean not null default false,
  seo_title text,
  seo_description text,
  units_sold int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_status_idx on public.products (status);
create index products_featured_idx on public.products (is_featured) where is_featured;

create table public.product_categories (
  product_id uuid not null references public.products (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  sort_order int not null default 0,
  primary key (product_id, category_id)
);
create index product_categories_category_idx on public.product_categories (category_id);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  sku text not null unique,
  size text,
  color text,
  price_cents bigint check (price_cents >= 0),
  sale_price_cents bigint check (sale_price_cents >= 0),
  stock_quantity int check (stock_quantity >= 0), -- null = made to order
  reserved_quantity int not null default 0 check (reserved_quantity >= 0),
  low_stock_threshold int not null default 3 check (low_stock_threshold >= 0),
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reserved_not_above_stock check (stock_quantity is null or reserved_quantity <= stock_quantity),
  unique (product_id, size, color)
);
create index product_variants_product_idx on public.product_variants (product_id);

create table public.product_media (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  storage_path text not null,
  alt text not null default '',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index product_media_product_idx on public.product_media (product_id, sort_order);

create table public.customization_fields (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  key text not null check (key ~ '^[a-z0-9_]+$'),
  label text not null,
  type text not null check (type in ('text', 'textarea', 'select', 'multi_select', 'color', 'file', 'number', 'checkbox')),
  required boolean not null default false,
  help_text text,
  options jsonb not null default '[]'::jsonb, -- [{value,label,price_delta_cents,swatch}]
  price_delta_cents bigint not null default 0,
  max_length int,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, key)
);

-- ---------------------------------------------------------------------------
-- Carts
-- ---------------------------------------------------------------------------
create table public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  guest_token_hash text unique, -- sha256 of an httpOnly cookie token for guests
  discount_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cart_owner check (user_id is not null or guest_token_hash is not null)
);
create unique index carts_user_idx on public.carts (user_id) where user_id is not null;

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  variant_id uuid references public.product_variants (id) on delete cascade,
  quantity int not null check (quantity between 1 and 50),
  customize boolean not null default false,
  rush boolean not null default false,
  selections jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index cart_items_cart_idx on public.cart_items (cart_id);

-- ---------------------------------------------------------------------------
-- Fulfilment configuration
-- ---------------------------------------------------------------------------
create table public.pickup_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address jsonb not null, -- entered by the owner in /admin/shipping; never hardcoded
  instructions text not null default '',
  scheduling_note text,
  available_windows jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.shipping_rates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  amount_cents bigint not null check (amount_cents >= 0),
  free_over_cents bigint check (free_over_cents >= 0),
  min_days int, max_days int,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tax_settings (
  id int primary key default 1 check (id = 1),
  -- basis points, configured by the owner; 0 until set. Not hardcoded.
  default_rate_bps int not null default 0 check (default_rate_bps between 0 and 3000),
  tax_shipping boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.tax_settings (id) values (1) on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Discounts
-- ---------------------------------------------------------------------------
create table public.discounts (
  id uuid primary key default gen_random_uuid(),
  code citext not null unique,
  kind text not null check (kind in ('percentage', 'fixed')),
  value bigint not null check (value > 0), -- bps for percentage, cents for fixed
  product_ids uuid[],
  min_subtotal_cents bigint not null default 0,
  usage_limit int check (usage_limit > 0),
  usage_count int not null default 0,
  per_customer_limit int check (per_customer_limit > 0),
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pct_max check (kind <> 'percentage' or value <= 10000)
);

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------
create sequence public.order_number_seq start 1001;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default ('SS-' || nextval('public.order_number_seq')),
  user_id uuid references auth.users (id) on delete set null,
  guest_access_token_hash text, -- lets a guest view their own order via a signed link
  customer_name text not null,
  customer_email citext not null,
  customer_phone text,
  delivery_method text not null check (delivery_method in ('shipping', 'pickup')),
  shipping_address jsonb,
  pickup_location_id uuid references public.pickup_locations (id),
  subtotal_cents bigint not null check (subtotal_cents >= 0),
  discount_cents bigint not null default 0 check (discount_cents >= 0),
  discount_code citext,
  shipping_cents bigint not null default 0 check (shipping_cents >= 0),
  tax_cents bigint not null default 0 check (tax_cents >= 0),
  total_cents bigint not null check (total_cents >= 0),
  refunded_cents bigint not null default 0 check (refunded_cents >= 0),
  currency text not null default 'usd',
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'pending', 'paid', 'failed', 'refunded', 'partially_refunded', 'requires_reconciliation')),
  payment_provider text check (payment_provider in ('stripe', 'square')),
  fulfillment_status text not null default 'awaiting_payment' check (fulfillment_status in (
    'request_received', 'quote_pending', 'awaiting_payment', 'paid', 'design_review', 'approved', 'in_production',
    'ready_for_shipping', 'ready_for_pickup', 'shipped', 'completed', 'cancelled')),
  is_custom_order boolean not null default false,
  is_quote_request boolean not null default false,
  quote_cents bigint check (quote_cents >= 0),
  quote_message text,
  quote_accepted_at timestamptz,
  rush boolean not null default false,
  customer_notes text,
  internal_notes jsonb not null default '[]'::jsonb,
  paid_at timestamptz,
  inventory_committed_at timestamptz, -- set once; guards against double fulfilment
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint total_math check (total_cents = subtotal_cents - discount_cents + shipping_cents + tax_cents),
  constraint refund_not_above_total check (refunded_cents <= total_cents),
  constraint shipping_needs_address check (delivery_method <> 'shipping' or shipping_address is not null or is_quote_request)
);
create index orders_user_idx on public.orders (user_id);
create index orders_created_idx on public.orders (created_at desc);
create index orders_status_idx on public.orders (payment_status, fulfillment_status);
create index orders_email_idx on public.orders (customer_email);

-- Immutable snapshot of what was bought, at the price it was bought.
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  variant_id uuid references public.product_variants (id) on delete set null,
  product_name text not null,
  product_slug text not null,
  image_path text,
  sku text,
  size text,
  color text,
  category_ids uuid[] not null default '{}',
  quantity int not null check (quantity > 0),
  unit_price_cents bigint not null check (unit_price_cents >= 0),
  customization_cents bigint not null default 0 check (customization_cents >= 0),
  rush_cents bigint not null default 0 check (rush_cents >= 0),
  line_total_cents bigint not null check (line_total_cents >= 0),
  is_custom boolean not null default false,
  customization jsonb not null default '{}'::jsonb,
  production_status text not null default 'not_started' check (production_status in ('not_started', 'design_review', 'approved', 'in_production', 'done')),
  assigned_to uuid references auth.users (id),
  created_at timestamptz not null default now()
);
create index order_items_order_idx on public.order_items (order_id);
create index order_items_product_idx on public.order_items (product_id);

create or replace function public.prevent_order_item_mutation() returns trigger
language plpgsql as $$
begin
  -- Only production workflow columns may change after creation.
  if (new.product_name, new.unit_price_cents, new.customization_cents, new.line_total_cents, new.quantity, new.customization, new.sku)
     is distinct from
     (old.product_name, old.unit_price_cents, old.customization_cents, old.line_total_cents, old.quantity, old.customization, old.sku) then
    raise exception 'order_items snapshots are immutable';
  end if;
  return new;
end $$;
create trigger order_items_immutable before update on public.order_items
  for each row execute function public.prevent_order_item_mutation();

create table public.custom_uploads (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users (id) on delete set null,
  guest_token_hash text,
  order_id uuid references public.orders (id) on delete set null,
  order_item_id uuid references public.order_items (id) on delete set null,
  storage_path text not null unique, -- in the private `customer-uploads` bucket
  mime_type text not null check (mime_type in ('image/png', 'image/jpeg', 'image/webp')),
  size_bytes int not null check (size_bytes > 0 and size_bytes <= 10485760),
  original_name text,
  created_at timestamptz not null default now()
);
create index custom_uploads_order_idx on public.custom_uploads (order_id);

create table public.pickup_details (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete cascade,
  pickup_location_id uuid references public.pickup_locations (id),
  scheduled_window text,
  ready_at timestamptz,
  collected_at timestamptz,
  collected_confirmed_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  carrier text,
  tracking_number text,
  tracking_url text,
  status text not null default 'label_created' check (status in ('label_created', 'shipped', 'delivered', 'returned')),
  shipped_at timestamptz,
  delivered_at timestamptz,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index shipments_order_idx on public.shipments (order_id);

-- ---------------------------------------------------------------------------
-- Payments
-- ---------------------------------------------------------------------------
create table public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  provider text not null check (provider in ('stripe', 'square')),
  status text not null default 'created' check (status in ('created', 'pending', 'succeeded', 'failed', 'canceled', 'expired', 'unknown', 'refunded', 'partially_refunded')),
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null default 'usd',
  idempotency_key text not null unique,
  provider_session_id text, -- Stripe Checkout Session id / Square payment link id
  provider_payment_id text, -- Stripe PaymentIntent id / Square payment id
  provider_order_id text, -- Square order id
  checkout_url text,
  failure_reason text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_session_id),
  unique (provider, provider_payment_id)
);
create index payment_attempts_order_idx on public.payment_attempts (order_id);
-- Hard guarantee: at most one successful attempt per order.
create unique index payment_attempts_one_success on public.payment_attempts (order_id)
  where status in ('succeeded', 'partially_refunded', 'refunded');
-- Hard guarantee: at most one in-flight attempt per order.
create unique index payment_attempts_one_in_flight on public.payment_attempts (order_id)
  where status in ('created', 'pending', 'unknown');

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete restrict, -- one payment per order
  payment_attempt_id uuid not null unique references public.payment_attempts (id),
  provider text not null check (provider in ('stripe', 'square')),
  provider_payment_id text not null,
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null default 'usd',
  card_brand text,
  card_last4 text check (card_last4 ~ '^[0-9]{4}$'), -- display only; never full PAN
  receipt_url text,
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (provider, provider_payment_id)
);

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id) on delete restrict,
  order_id uuid not null references public.orders (id) on delete restrict,
  provider text not null check (provider in ('stripe', 'square')),
  provider_refund_id text,
  amount_cents bigint not null check (amount_cents > 0),
  reason text,
  status text not null default 'pending' check (status in ('pending', 'succeeded', 'failed', 'canceled')),
  idempotency_key text not null unique,
  requested_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_refund_id)
);
create index refunds_order_idx on public.refunds (order_id);

create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('stripe', 'square')),
  event_id text not null,
  event_type text not null,
  payload jsonb not null,
  signature_verified boolean not null,
  processed_at timestamptz,
  processing_error text,
  received_at timestamptz not null default now(),
  unique (provider, event_id) -- replayed webhooks are ignored
);

-- ---------------------------------------------------------------------------
-- Inventory
-- ---------------------------------------------------------------------------
create table public.inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  variant_id uuid not null references public.product_variants (id) on delete cascade,
  quantity int not null check (quantity > 0),
  status text not null default 'active' check (status in ('active', 'committed', 'released')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, variant_id)
);
create index inventory_reservations_active_idx on public.inventory_reservations (expires_at) where status = 'active';

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.product_variants (id) on delete cascade,
  change int not null,
  reason text not null check (reason in ('sale', 'adjustment', 'restock', 'return', 'damage', 'correction', 'initial')),
  order_id uuid references public.orders (id) on delete set null,
  note text,
  stock_after int,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);
create index inventory_movements_variant_idx on public.inventory_movements (variant_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Content, notifications, audit
-- ---------------------------------------------------------------------------
create table public.site_content (
  key text primary key, -- e.g. 'home', 'brand', 'policy:shipping'
  draft jsonb not null default '{}'::jsonb,
  published jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  updated_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('new_order', 'custom_request', 'low_inventory', 'payment_failed', 'awaiting_production', 'pickup_waiting', 'reconciliation_needed')),
  title text not null,
  body text,
  link text,
  order_id uuid references public.orders (id) on delete cascade,
  variant_id uuid references public.product_variants (id) on delete cascade,
  read_by uuid[] not null default '{}',
  created_at timestamptz not null default now()
);
create index notifications_created_idx on public.notifications (created_at desc);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users (id),
  actor_role text,
  action text not null,
  entity_type text not null,
  entity_id text,
  before jsonb,
  after jsonb,
  ip inet,
  created_at timestamptz not null default now()
);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);

create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique,
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.email_log (
  id uuid primary key default gen_random_uuid(),
  template text not null,
  to_email citext not null,
  order_id uuid references public.orders (id) on delete set null,
  provider_message_id text,
  status text not null check (status in ('sent', 'failed', 'skipped')),
  error text,
  dedupe_key text unique,
  created_at timestamptz not null default now()
);

-- updated_at triggers
do $$
declare t text;
begin
  foreach t in array array['profiles','staff_roles','categories','products','product_variants','product_media','customization_fields',
    'carts','cart_items','pickup_locations','shipping_rates','discounts','orders','pickup_details','shipments','payment_attempts',
    'refunds','inventory_reservations','site_content']
  loop
    execute format('create trigger %I_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;
