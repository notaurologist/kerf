# 0003: Hono API, Postgres with Drizzle, Zod at the boundaries

Status: Accepted (October 2026)

## Context
Kerf has a backend from the start (0005). `PRODUCT.md` rules out hosted backend services with database-level access rules (Supabase, Firebase) because access control is easier to reason about and test in plain API code. The owner already runs this stack in rowing-conditions.

## Decision
- **Hono** for the HTTP API. The app is exported without a server so tests call `app.request()`, and the web app uses Hono's typed client.
- **Postgres** with **Drizzle** for schema, migrations, and queries. Migrations are committed.
- **Zod** parses every request body, query string, and stored JSON value read back from the database.
- Access control lives in API middleware, not database policies.

## Consequences
- Request and response types are shared between API and web app without a separate schema language.
- Generated project snapshots are stored as JSON (see `ARCHITECTURE.md`), so their Zod schemas are the contract for reading them back.
