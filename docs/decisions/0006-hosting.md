# 0006: Vercel for the web app and API, Neon for Postgres

Status: Accepted (October 2026)

## Context
Kerf needs a host for the API, the web app, and Postgres. rowing-conditions compared free hosts in its decision 0017 (October 26, 2026) and chose Vercel Hobby with Neon. Kerf's needs are smaller: one user, a handful of requests per session, and no calls to external data sources.

## Decision
- **One Vercel project on the Hobby plan** with two services: the `apps/web` build at `/` and the Hono API at `/api/*`. The browser sees one origin, so the API needs no CORS. Local development uses `@hono/node-server` and the Vite proxy.
- **Neon free project on Postgres 18**, reached through Neon's pooled connection string.
- **Secrets** (`DATABASE_URL`, the login password hash) live only in Vercel's environment settings and a local `.env`, never in the repository.
- Free-tier limits are re-checked against each provider's docs at M3, before the first deploy, and recorded here.

## Consequences
- The API runs as Vercel Functions, so anything that must hold across requests (sessions, login rate limiting) goes in Postgres, not in memory.
- Vercel Hobby is for non-commercial personal use, which matches Kerf.
- Neon suspends compute after a few idle minutes, so the first request after a break is slower.
