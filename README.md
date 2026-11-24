# Fana Cafe

Ordering and café-operations app for residents on floors 4–10. Next.js 15 (App Router) + TypeScript + Tailwind + Supabase (Postgres, Auth, Row Level Security).

## What is built (Phases 1–4 slice)

- Resident sign-up (floors 4–10 enforced in the form, in Postgres, and in the signup trigger) with manager approval
- Live menu, search, category filter, sort; meal page with removable ingredients and priced extras
- Cart and checkout with a building "tower" floor picker
- Server-side repricing (integer santim math), order snapshots, one-transaction order creation
- Manager desk: accept (atomic stock reservation), reject/cancel with reason, resident approval, stock view
- Kitchen board: start preparing (consumes reserved stock once), mark ready, mark delivered
- Append-only inventory ledger, reservations, on-hand / reserved / available stock
- Mock payment button (`PAYMENTS_MODE=mock`) standing in for Telebirr

Not built yet: Telebirr adapter (Phase 5), purchases/suppliers, wastage and adjustments UI, meal/recipe editor, reports, audit log, notifications, reservation-expiry job, photo upload.

## Setup

1. Create a Supabase project. In **Authentication → Providers → Email**, turn off "Confirm email" for development.
2. In the SQL editor run `supabase/migrations/0001_schema.sql`, then `supabase/seed.sql` (sample data only).
3. `cp .env.example .env.local` and fill in the three Supabase keys.
4. `npm install && npm run dev` → http://localhost:3000
5. Register an account, then promote yourself in the SQL editor:

```sql
update profiles set role = 'OWNER', account_status = 'ACTIVE'
where id = (select id from auth.users where email = 'you@example.com');
```

6. Register a second account as a resident. Approve it at `/admin/residents`, order, accept at `/admin/orders`, pay with the mock button, then cook it at `/kitchen`.

Tests: `npm test`. Types: `npm run typecheck`.

## How the rules are enforced

| Rule | Where |
|---|---|
| Prices never trusted from the browser | `features/orders/pricing.ts`, called from `placeOrder` |
| Required ingredients can't be removed | `priceLine` throws `PricingError` |
| No overselling under concurrency | `accept_order` locks ingredient rows in id order, then checks available stock |
| Stock consumed once, only after verified payment | `start_preparing` |
| Ledger can't be edited | trigger on `inventory_movements` |
| Business functions not callable by browsers | `revoke execute` + service-role client in server actions only |
| Residents see only their orders | RLS policies |

## Next steps

Phase 5 (Telebirr): implement a `TelebirrProvider` in `src/features/payments/` with `createCheckout`, `verifyCallback`, `queryPayment`; add `POST /api/payments/telebirr/notify` that verifies the signature, matches amount/currency, and inserts the payment idempotently (`merchant_order_id` and `transaction_id` are unique). Then purchases, wastage/adjustments, the recipe editor, and a scheduled job to expire stale reservations only after reconciling payment.
