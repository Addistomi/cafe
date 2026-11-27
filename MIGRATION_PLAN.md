# Fana Cafe: Supabase to React + FastAPI + standalone PostgreSQL

## Safety rules

- This is a separate migration branch; the existing app and Supabase database remain untouched.
- Keep the existing app/database as the production source of truth until cutover is approved.
- Never commit dumps, credentials, KYC documents, payment screenshots, or resident personal data.
- Do not assume Supabase Auth password hashes can be reused in a custom auth system. Plan account re-verification/password reset unless compatibility is verified.
- PostgreSQL dumps do not include Storage file bytes. KYC and receipt files require a separate private-object migration and checksum verification.

## Target architecture

- frontend/: React 19 + Vite + TypeScript.
- backend/: FastAPI + SQLAlchemy 2 + Pydantic Settings + Alembic.
- Database: separate PostgreSQL instance, managed by Alembic.
- Private object storage for KYC documents and payment receipts.
- Telebirr verification remains server-side; a screenshot or QR reference alone is not proof of payment.

## Migration phases

1. Inventory source tables, columns, constraints, indexes, triggers, functions, RLS policies, enums, views, row counts, Auth users, and Storage object paths.
2. Provision an empty destination PostgreSQL database with restricted roles, TLS, and backups.
3. Design a standalone schema replacing auth.uid(), auth.users, Supabase Storage, and RLS dependencies with application users, service-layer authorization, and private object storage.
4. Create Alembic migrations; do not run destructive SQL against the source.
5. Export a protected source snapshot using pg_dump; separately map Auth identities and profile records. Store encrypted backups outside GitHub.
6. Transform/import into staging, preserving IDs and relationships where possible. Reconcile currency values, timestamps, enums, foreign keys, order/payment history, and stock ledger.
7. Move KYC and payment files separately; verify object counts and checksums and issue short-lived signed URLs.
8. Validate row counts, financial totals, foreign-key orphans, duplicate Telebirr references, stock balances, KYC states, and authorization tests.
9. After approval, freeze writes briefly, perform a final delta sync, deploy, smoke-test, then switch traffic.
10. Roll back by routing traffic to the unchanged old app/database. Keep the source intact until the new system is proven.

## Current status

This branch contains initial React/FastAPI scaffolding and a migration plan only. It is not a completed port. No production data has been copied or changed. Existing Next.js/Supabase source remains on the original branch.

## Decisions needed before data migration

- Destination PostgreSQL provider/region.
- Frontend and API hosting providers.
- Private object-storage provider.
- Account migration approach, including password reset/re-verification if required.
