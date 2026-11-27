# Fana Cafe API

Standalone FastAPI + PostgreSQL service. The SQLAlchemy models are the first translation of the current Supabase schema, including profiles, menu, recipes, orders, payments, inventory, and resident KYC metadata.

## Local development

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Set DATABASE_URL and APP_SECRET_KEY in .env, then create the empty local database.
alembic revision --autogenerate -m "initial standalone schema"
alembic upgrade head
uvicorn app.main:app --reload
```

`GET /health` checks the API process. `GET /ready` checks PostgreSQL connectivity. Never commit .env files, database dumps, KYC documents, or payment screenshots.
