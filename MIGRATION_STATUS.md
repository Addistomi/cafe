# Migration implementation status

Branch: `migration/react-fastapi-postgres`

## Completed in this branch

- React 19 + Vite + TypeScript app entry point and development configuration.
- FastAPI application with CORS configuration and system health/readiness routes.
- SQLAlchemy 2 models translated from the existing Supabase schema:
  - resident profiles and application roles
  - categories, meals, ingredients, recipes and add-ons
  - orders, order items, customisation snapshots and status history
  - Telebirr payment records and receipt-verification metadata
  - inventory reservations and movement ledger
  - resident KYC metadata and private-file object paths
- Alembic environment and revision template.
- Backend local-development instructions.

## Not completed yet

- No production database has been provisioned or connected.
- No Alembic migration has been generated or applied to a real database.
- No Supabase data or storage files have been exported or copied.
- Authentication endpoints, password hashing, token/session handling and role authorization are not implemented.
- Cafe business APIs and full React resident/admin/kitchen screens are not yet ported.
- Telebirr receipt verification is not yet implemented in FastAPI.
- No deployment or production cutover has occurred.

## Next implementation sequence

1. Review and test the SQLAlchemy schema against every existing SQL migration.
2. Add secure registration/login and role-based authorization.
3. Add public menu and resident order APIs with transactional stock reservation.
4. Add payment receipt intake and server-side verification workflow.
5. Add admin, kitchen, inventory and KYC management APIs.
6. Port the existing React experience and connect each screen to the API.
7. Generate and test Alembic migrations against a clean local PostgreSQL database.
8. Prepare a staging database and a protected, verifiable data migration.
