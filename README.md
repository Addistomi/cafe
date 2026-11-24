# Fana Cafe

Ordering and café-operations app for residents on floors 4–10. Built with Next.js 15 App Router, TypeScript, Tailwind CSS, Supabase Postgres, Supabase Auth and Row Level Security.

## Main experiences

- **Resident storefront:** browse and search the menu, filter by category, customize removable ingredients and paid extras, manage the cart, select a floor/apartment and track orders.
- **Owner workspace:** overview metrics, order desk, meal and recipe editor, inventory management, payment register and resident approvals.
- **Kitchen board:** verified paid orders, preparing, ready for delivery and out-for-delivery stages.
- **Resident payment receipt submission:** upload a Telebirr screenshot; browser OCR suggests the transaction reference; the private receipt appears in the owner payment register.

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
- Private resident payment receipt upload, in-browser OCR reference suggestion, duplicate-reference protection and admin receipt viewing. Receipt submissions remain PENDING.
- Payment register and a development-only mock payment button.

**Important payment limitation:** Receipt OCR only reads text from the image; it does not prove that money was received. A production Telebirr merchant adapter, signed callback endpoint and Query Order reconciliation still require the café's merchant onboarding, API documentation and credentials. Until that integration is completed, screenshot submissions stay PENDING and orders are not marked paid. Never manually trust an uploaded image or OCR result as payment proof.

## Setup

1. Create a Supabase project. In **Authentication → Providers → Email**, turn off email confirmation for local development if desired.
2. In the Supabase SQL editor, run these scripts in order:
   - `supabase/migrations/0001_schema.sql`
   - `supabase/migrations/0002_admin_tools.sql`
   - `supabase/migrations/0003_payment_receipts.sql`
   - `supabase/seed.sql` (sample menu, ingredients and recipes)
3. Copy the environment template and fill in the Supabase project values:

   ```bash
   cp .env.example .env.local
   ```

   Required values:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server only; never expose it in client code)

   For local testing keep `PAYMENTS_MODE=mock`. Mock payments are not real Telebirr payments. In production, do not enable mock mode.
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
| `/orders` and `/orders/[id]` | Signed-in residents | Order history, tracking and payment receipt submission |
| `/admin` | Owner / manager | Management overview |
| `/admin/orders` | Owner / manager | Accept and manage orders |
| `/admin/menu` | Owner / manager | Meals, recipes and paid extras |
| `/admin/ingredients` | Owner / manager | Ingredients, stock and adjustments |
| `/admin/payments` | Owner / manager | Payment records and private submitted receipts |
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
| Duplicate successful payment records for one order are blocked | Serialized database trigger in migration 0002 |
| Receipt images are private and uploaded only after resident/order checks | Server action and private Supabase Storage bucket in migration 0003 |
| One pending screenshot receipt per order and duplicate references are blocked | Unique indexes in migration 0003 |
| OCR is never treated as payment verification | Receipt records remain PENDING until provider verification |
| Privileged database functions cannot be called by browsers | Execute grants restricted to `service_role`; server actions check user roles |
| Residents see only their own orders | Supabase RLS policies |

## Checks

```bash
npm run typecheck
npm test
npm run build
```

## Still required before production

1. Obtain the Fana Cafe Telebirr merchant account and official integration credentials/API documentation.
2. Implement the official transaction-reference query flow (if supported for the merchant account), signed notify callback and reconciliation. Verify merchant/recipient, amount, currency, unique transaction ID and successful provider status server-side.
3. Only after a verified provider response, set payment SUCCESS and permit kitchen preparation.
4. Replace mock payment mode with the real provider integration only after sandbox/production testing.
5. Add a controlled refund workflow and a scheduled reservation-expiry/reconciliation job.
6. Add suppliers, formal purchase records and wastage reasons if the café needs purchasing/cost reporting.
7. Add automated notifications and live kitchen refresh.
8. Configure production Supabase URL/keys, HTTPS callback URL, backups and deployment environment.

Do not put the Supabase service-role key or Telebirr private signing keys in browser code or public environment variables.
