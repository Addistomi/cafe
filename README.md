# Fana Cafe

Ordering and café-operations app for residents on floors 4–10. Built with Next.js 15 App Router, TypeScript, Tailwind CSS, Supabase Postgres, Supabase Auth and Row Level Security.

## Main experiences

- **Resident storefront:** browse and search the menu, filter by category, customize removable ingredients and paid extras, manage the cart, select a floor/apartment and track orders.
- **Owner workspace:** overview metrics, order desk, meal and recipe editor, inventory management, payment register and resident approvals.
- **Kitchen board:** verified paid orders, preparing, ready for delivery and out-for-delivery stages.
- **Resident direct-transfer payment:** residents transfer to Fana Cafe's Telebirr merchant account, upload the receipt screenshot, and the browser scans the QR or falls back to OCR. The Next.js server then looks up the reference on Telebirr's public receipt page and compares the official receipt with the order.

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
- Private resident payment receipt upload, in-browser Telebirr QR scanning with CRC validation, OCR fallback, duplicate-reference protection, merchant transfer details and server-side lookup of the official Telebirr receipt. The owner payment register shows a private screenshot preview, reference, recipient, amount, verification result and a retry action for pending checks.
- Payment register and a development-only mock payment button.

**Important payment limitation:** The QR code contains only the transaction reference; it does not prove that money was received. The server now looks up `https://transactioninfo.ethiotelecom.et/receipt/{REFERENCE}` and parses the HTML receipt served by Telebirr's public receipt page. A payment is marked successful only when Telebirr returns the same reference, `Completed` status, the configured Fana Cafe recipient name and the exact order settled amount. A reference not found or a mismatched receipt is FAILED. If Telebirr times out, blocks the server or changes its HTML, the payment stays PENDING and an owner/manager can retry from Admin → Payments. Telebirr's public receipt host is reported to be reachable only from Ethiopian IP addresses, so test from your local Ethiopian network. Do not treat a screenshot or decoded QR as proof by itself.

## Setup

1. Create a Supabase project. In **Authentication → Providers → Email**, turn off email confirmation for local development if desired.
2. In the Supabase SQL editor, run these scripts in order:
   - `supabase/migrations/0001_schema.sql`
   - `supabase/migrations/0002_admin_tools.sql`
   - `supabase/migrations/0003_payment_receipts.sql`
   - `supabase/migrations/0004_telebirr_receipt_verification.sql`
   - `supabase/seed.sql` (sample menu, ingredients and recipes)
3. Copy the environment template and fill in the Supabase project values:

   ```bash
   cp .env.example .env.local
   ```

   Required values:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server only; never expose it in client code)
   - `TELEBIRR_MERCHANT_NAME` (the official merchant display name shown on receipts)
   - `TELEBIRR_MERCHANT_ACCOUNT` (the merchant number or short code shown to residents; this is displayed publicly)
   - `TELEBIRR_VERIFIED_RECIPIENT_NAMES` (required; exact credited-party name from a genuine Telebirr receipt; separate aliases with commas)
   - `TELEBIRR_VERIFIED_RECIPIENT_ACCOUNT` (optional; exact unmasked credited account number from the receipt)

   These verification settings are server-only. Do not prefix them with `NEXT_PUBLIC_`. For local development, test direct receipt verification while connected to an Ethiopian network. Keep `PAYMENTS_MODE=mock` only for separate local mock testing; mock payments are not real Telebirr payments. Mock payments are not real Telebirr payments. In production, do not enable mock mode.
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
| Receipt images are private, and owner/manager users see short-lived screenshot previews | Server action, private Supabase Storage bucket and admin payment register in migration 0003 |
| Duplicate transaction references cannot be attached to multiple payment records | Unique reference index in migration 0003 |
| A Telebirr receipt is accepted only after its official reference, completed status, credited recipient and settled amount match the order | Server-side receipt lookup and verification fields in migration 0004 |
| Kitchen stock can only be consumed after a verified merchant callback or official Telebirr receipt check | `start_preparing` in migration 0004 |
| Privileged database functions cannot be called by browsers | Execute grants restricted to `service_role`; server actions check user roles |
| Residents see only their own orders | Supabase RLS policies |

## Checks

```bash
npm run typecheck
npm test
npm run build
```

## Still required before production

1. Configure the exact Telebirr merchant display name and public merchant number / short code in the server environment.
2. Deploy the receipt-verification service where it can reach Telebirr's official receipt host from an Ethiopian IP address. A cloud deployment outside Ethiopia may be blocked by Telebirr.
3. Implement server-side receipt parsing and strict checks for completed status, Fana Cafe's recipient name/account, exact ETB amount and duplicate transaction reference. If Telebirr cannot be reached, keep the payment PENDING.
4. Only after a confirmed official receipt, set payment SUCCESS and permit kitchen preparation.
5. Replace mock payment mode with the real receipt-verification flow only after tests with real, low-value merchant transfers.
6. Add a controlled refund workflow and a scheduled reservation-expiry/reconciliation job.
7. Add suppliers, formal purchase records and wastage reasons if the café needs purchasing/cost reporting.
8. Add automated notifications and live kitchen refresh.
9. Configure production Supabase URL/keys, backups and deployment environment.

Do not put the Supabase service-role key or Telebirr private signing keys in browser code or public environment variables.
