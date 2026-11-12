# Shagannan Shenanigans

Online store and admin dashboard for handmade gifts, custom and ready-made t-shirts, and custom and ready-made crochet dolls.

- **Storefront** (`src/app/(store)`): white, black and warm tan, DM Sans / Inter.
- **Admin dashboard** (`src/app/admin`): deep purple sidebar, pink and lavender cards. It has its own layout and theme tokens and never shares the storefront palette.
- Both share one Supabase database, one set of business rules (`src/lib`) and one payment pipeline.

Stack: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Supabase (Postgres, Auth, Storage, RLS), Stripe (primary), Square (fallback), Resend, Recharts, Zod, React Hook Form, Motion, Lucide. Deploys on Vercel.

---

## What works today, and what needs your accounts

| Area | Status |
| --- | --- |
| Storefront, product pages, shirt and doll builders, cart, checkout UI, account pages | Built. Runs in demo mode without any keys. |
| Admin dashboard, orders, custom orders/quotes, products, categories, inventory, customers, analytics, payments, discounts, shipping/pickup, content CMS, staff, settings | Built. Read-only in demo mode. |
| Database schema, RLS, stock/payment/refund/reconciliation functions | Built and checked against a real Postgres engine (`npm run test:sql`, 37 checks). Not yet run on a live Supabase project. |
| Stripe Checkout + webhooks, Square fallback + webhooks, refunds | Implemented against the current SDKs. **Not yet verified with live sandbox credentials.** Test with Stripe test mode and Square sandbox before going live (steps below). |
| Email (Resend) | Implemented. Needs an API key and a verified sending domain. |
| Business-rule unit tests | `npm test` (50 tests: pricing, discounts, cart validation, payment state machine, Square-fallback rules, inventory, roles, fulfillment, analytics). |

### Demo mode

When Supabase isn't configured (or `DEMO_MODE=true`), the site serves **clearly labelled sample products and orders** so the design can be reviewed. In demo mode, checkout, uploads and every admin change are disabled, and banners say so on both the storefront and the dashboard. The admin signs you in as a demo owner called "Shannon". Dashboard numbers are still calculated from the sample orders; none are hardcoded. Sample data never appears once Supabase is connected.

---

## Run it locally

```bash
npm install          # .npmrc sets legacy-peer-deps for React 19 peers
cp .env.example .env.local
npm run dev          # http://localhost:3000  ·  admin at /admin
npm test             # unit tests
npm run test:sql     # applies the migrations to in-memory Postgres and checks the rules
npm run build
```

With an empty `.env.local` you get demo mode.

---

## 1. Supabase

1. Create a project at supabase.com.
2. Run the migrations in order, either with the Supabase CLI (`supabase link` then `supabase db push`) or by pasting each file into the SQL editor:
   `supabase/migrations/0001_schema.sql`, `0002_rls.sql`, `0003_functions.sql`, `0004_storage.sql`.
3. From **Project Settings → API**, copy the URL and anon key into `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and the service role key into `SUPABASE_SERVICE_ROLE_KEY`. The service role key is only read in server code (`src/lib/supabase/server.ts` is marked `server-only`).
4. **Auth → URL configuration:** set the Site URL to your domain and add `https://your-domain.com/**` to redirect URLs.
5. **Create the first owner.** Sign up once at `/account` (or invite yourself under Auth → Users), then run this in the SQL editor:

   ```sql
   insert into public.staff_roles (user_id, role, display_name)
   select id, 'owner', 'Shannon' from auth.users where email = 'you@example.com';
   ```

   After that, add staff from **Admin → Staff**. Roles:
   - **Owner** has full access, including refunds and payment reconciliation.
   - **Manager** has no access to refunds, staff, or settings.
   - **Fulfillment** can see orders and update their status only.
6. In the admin, add your **shipping rates**, **pickup locations** (the address is never hardcoded), **tax rate** (0% until you set it), **categories** and **products**.

Storage buckets created by the migration:
- `product-media` (public): product photos.
- `site-assets` (public): logo, favicon and hero image.
- `customer-uploads` (**private**): customer reference photos. These are only ever served through short-lived signed URLs.

---

## 2. Stripe (primary payments)

1. Use **test mode** first. Copy the secret key into `STRIPE_SECRET_KEY`.
2. **Developers → Webhooks → Add endpoint:** `https://your-domain.com/api/webhooks/stripe`. Subscribe to:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.async_payment_failed`
   - `checkout.session.expired`
   - `refund.created`
   - `refund.updated`
   - `refund.failed`

   Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
3. To test locally, run `stripe listen --forward-to localhost:3000/api/webhooks/stripe` and use test card `4242 4242 4242 4242`. Also try the decline card `4000 0000 0000 0002` and let a session expire.

Card details are entered on Stripe's hosted checkout page, so the app never sees or stores card numbers.

## 3. Square (fallback)

1. In the Square Developer Dashboard, create an app and use **Sandbox** credentials: `SQUARE_ACCESS_TOKEN` and `SQUARE_LOCATION_ID`, with `SQUARE_ENVIRONMENT=sandbox`.
2. Add a webhook subscription to `https://your-domain.com/api/webhooks/square` for `payment.created`, `payment.updated`, `refund.created` and `refund.updated`. Copy the signature key into `SQUARE_WEBHOOK_SIGNATURE_KEY`. The notification URL must exactly match `NEXT_PUBLIC_SITE_URL` + `/api/webhooks/square`, because it is part of the signature.
3. Switch to production credentials only after sandbox testing.

### How the fallback is protected

- Every checkout creates a durable **payment attempt**, and the order is only marked paid by a **signature-verified webhook**. The success page only reads status.
- The database allows **one successful attempt and one in-flight attempt per order** (unique partial indexes). Repeated webhooks are de-duplicated by event id and are no-ops.
- Square is offered only after Stripe **definitively fails** (or Stripe isn't configured). The customer must click it. Nothing is retried automatically.
- While a Stripe attempt is pending or its result is unknown, Square is blocked. Before offering Square, the server checks Stripe and expires any open session.
- A second success on an already-paid order, an amount mismatch, or a success arriving after an attempt was closed is **flagged for reconciliation**, never fulfilled automatically. The owner resolves it under **Admin → Payments** with the processor's payment id and a note, and the change is written to the audit log.

## 4. Resend (email)

Verify your domain in Resend. Set `RESEND_API_KEY`, `EMAIL_FROM`, and optionally `ADMIN_NOTIFICATION_EMAILS`.

Emails cover:
- order confirmation
- custom request received
- quote ready
- design approved
- production started
- ready for pickup
- shipped
- pickup completed
- refunds
- admin alerts

Each send is logged to `email_log` and de-duplicated. If email isn't configured, sends are skipped and logged, and checkout is not affected.

## 5. Deploy on Vercel

1. Push this folder to a GitHub repository (see below) and import it in Vercel.
2. Add every variable from `.env.example` under **Settings → Environment Variables**. Set `NEXT_PUBLIC_SITE_URL` to the production URL.
3. Deploy, then point the Stripe and Square webhooks at the production URL.
4. **Releasing abandoned-checkout stock.**
   - Provider "expired" webhooks release held stock immediately.
   - As a backup, `vercel.json` runs `/api/cron/release-reservations` daily, protected by `CRON_SECRET`.
   - For a faster sweep, enable `pg_cron` in Supabase and run:

     ```sql
     select cron.schedule('release-reservations', '*/10 * * * *', $$select public.release_expired_reservations()$$);
     ```

## Getting the code onto GitHub

```bash
cd shagannan-shenanigans
git add -A && git commit -m "Shagannan Shenanigans store"
git remote add origin https://github.com/<you>/shagannan-shenanigans.git
git push -u origin main
```

---

## Project map

```
src/app/(store)/        storefront routes and layout (store theme)
src/app/admin/(panel)/  admin routes and layout (admin theme)
src/app/admin/actions/  server actions: permission check → RLS client → audit log
src/app/api/            checkout, webhooks, uploads, quotes, newsletter, cron
src/lib/                pricing, cart validation, discounts, inventory, payments, analytics, roles
src/lib/data/           database reads (with labelled demo fallbacks)
supabase/migrations/    schema, RLS, transactional functions, storage
tests/                  unit tests        scripts/validate-sql.mjs  database checks
```

Money is stored and calculated in integer cents throughout. Prices, discounts, shipping and tax are always recomputed on the server. The cart only sends ids and selections.

### Before launch checklist

- Replace the placeholder policy text (Admin → Website Content → Policies) with reviewed policies.
- Confirm your sales-tax obligations and set the rate.
- Add your real products. The demo items live only in code and disappear once Supabase is connected.
- Run a full Stripe test-mode and Square sandbox purchase, refund and expiry.
- Logo: the crown-S logo in `public/brand/` is the default. You can replace it in Admin → Website Content.
