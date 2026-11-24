# Fana Cafe

Ordering and café-operations app for residents on floors 4–10. Built with Next.js 15 App Router, TypeScript, Tailwind CSS, Supabase Postgres, Supabase Auth and Row Level Security.

## Main experiences

- **Resident storefront:** browse and search the menu, filter by category, customize removable ingredients and paid extras, manage the cart, select a floor/apartment and track orders.
- **Owner workspace:** overview metrics, order desk, meal and recipe editor, inventory management, payment register and resident approvals.
- **Kitchen board:** verified paid orders, preparing, ready for delivery and out-for-delivery stages.

## Implemented workflows

- Resident sign-up restricted to floors 4–10 in the form, Postgres constraints and signup trigger; café approval is required before checkout.
- Menu search, category filter and sorting.
- Per-meal recipes, removable ingredients and stock-tracked priced extras.
- Cart and checkout with building floor picker.
- Server-side repricing using integer santim math, immutable order snapshots and transactional order creation.
- Manager order acceptance with atomic stock reservations; rejection and cancellation with a reason.
- Kitchen preparation consumes reserved stock once and only after verified payment.
- Explicit ready → out-for-delivery → delivered transition.
- Append-only inventory ledger, stock creation, stock purchases/adjustments and on-hand/reserved/available quantities.
- Payment register and a development-only mock payment button.

**Telebirr is not live yet.** The payment register is ready to display verified payment records, but a production Telebirr merchant adapter, signed callback endpoint and Query Order reconciliation still need implementation and merchant credentials.

## Setup

1. Create a Supabase project. In **Authentication → Providers → Email**, turn off email confirmation for local development if desired.
2. In the Supabase SQL editor, run these scripts in order:
   - `supabase/migrations/0001_schema.sql`
   - `supabase/migrations/0002_admin_tools.sql`
   - `supabase/seed.sql` (sample menu, ingredients and recipes)
3. Copy the environment template and fill in the Supabase project values:

   ```bash
   cp .env.example .env.local
   ```

   Required values:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server only; never expose it in client code)

   For local testing keep `PAYMENTS_MODE=mock`. Mock payments are not real Telebirr payments.
4. Install dependencies and start the app:

   ```bash
   npm install
   npm run dev
   ```

   Open http://localhost:3000.

5. Register the owner account, then promote it in the Supabase SQL editor:

   ```sql
   update profiles set role = 'OWNER', account_status = 'ACTIVE'
   where id = (select id from auth.users where email = 'you@example.com');
   ```

6. Sign in again. Owners/managers are routed to `/admin`; kitchen staff are routed to `/kitchen`. Register a resident account and approve it from **Admin → Residents**.

## Key routes

| Route | Who can use it | Purpose |
|---|---|---|
| `/` | Public / residents | Storefront homepage |
| `/menu` | Public / residents | Menu catalogue |
| `/meals/[slug]` | Public / residents | Meal detail and customization |
| `/cart` | Public / residents | Cart |
| `/checkout` | Active residents | Submit an order |
| `/orders` and `/orders/[id]` | Signed-in residents | Order history and tracking |
| `/admin` | Owner / manager | Management overview |
| `/admin/orders` | Owner / manager | Accept and manage orders |
| `/admin/menu` | Owner / manager | Meals, recipes and paid extras |
| `/admin/ingredients` | Owner / manager | Ingredients, stock and adjustments |
| `/admin/payments` | Owner / manager | Payment records |
| `/admin/residents` | Owner / manager | Approve resident accounts |
| `/kitchen` | Owner / manager / kitchen | Kitchen and delivery board |

Protected layouts and server actions perform role checks. Hiding links in the UI is not treated as authorization.

## Business rules

| Rule | Enforcement |
|---|---|
| Prices are never trusted from the browser | `features/orders/pricing.ts` reprices IDs against database catalogue data |
| Required ingredients cannot be removed | Server-side pricing validation |
| No overselling during simultaneous order acceptance | `accept_order` locks ingredient rows and checks available stock |
| Accepted orders reserve ingredients | `inventory_reservations` |
| Physical stock is consumed once and only after verified payment | `start_preparing` |
| Manual removal cannot consume reserved stock | `adjust_ingredient_stock` in migration 0002 |
| Stock history is append-only | Trigger on `inventory_movements` |
| Duplicate successful payment records for one order are blocked | Partial unique index in migration 0002 |
| Privileged database functions cannot be called by browsers | Execute grants restricted to `service_role`; server actions check user roles |
| Residents see only their own orders | Supabase RLS policies |

## Checks

```bash
npm run typecheck
npm test
npm run build
```

## Still required before production

1. Implement the Telebirr merchant checkout adapter, signed notify callback and Query Order reconciliation. Verify amount, currency, merchant order reference and provider transaction ID server-side.
2. Replace mock payment mode with the real provider integration only after merchant onboarding and sandbox/production testing.
3. Add a controlled refund workflow and a scheduled reservation-expiry/reconciliation job.
4. Add suppliers, formal purchase records and wastage reasons if the café needs purchasing/cost reporting.
5. Add automated notifications and live kitchen refresh.
6. Configure production Supabase URL/keys, HTTPS callback URL, backups and deployment environment.

Do not put the Supabase service-role key or Telebirr private signing keys in browser code or public environment variables.
