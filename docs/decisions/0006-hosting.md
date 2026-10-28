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

## Free-tier limits, re-checked October 28, 2026 (M3)

From each provider's own docs on that date:

| Provider | Free terms | Kerf's use |
|---|---|---|
| Vercel Hobby ([plan page](https://vercel.com/docs/plans/hobby), updated September 14, 2026) | Non-commercial personal use only. Per month: 4 active CPU hours, 360 GB-hours of provisioned memory, 1,000,000 function invocations, 100 GB fast data transfer, 10 GB fast origin transfer, 1,000,000 CDN requests. 100 deployments a day. Functions run up to 300 seconds. One hour of runtime logs. Over a limit, that feature usually stops until 30 days have passed. | One user. A login hashes the password once with scrypt (about 0.27 s of CPU measured locally); generating a swing-set snapshot takes milliseconds. Thousands of requests a month use a small fraction of 4 CPU hours. |
| Vercel Node versions ([docs](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)) | 24.x (default) and 22.x. | Node 24, matching `.nvmrc` and `engines`. |
| Neon Free ([plans](https://neon.com/docs/introduction/plans)) | Per project: 1 GB storage, 100 CU-hours of compute a month, 5 GB public network transfer a month, 10 branches, 6 hours of point-in-time restore. Compute suspends after 5 minutes idle and that cannot be turned off. Using up compute or transfer suspends compute until the next billing period; reaching the storage cap makes writes fail. No limit deletes data. | Postgres 18 is supported ([version policy](https://neon.com/docs/postgresql/postgres-version-policy)). A swing-set snapshot is about 45 KB of JSON, so 1 GB holds thousands of projects. At the smallest compute size (0.25 CU), 100 CU-hours is about 400 hours awake a month. |

Not verified until the first deploy: cold start time with Neon waking, and how much active CPU and memory a request uses on Vercel.

Backups: the free plan's restore window is 6 hours, which does not cover a mistake noticed days later. `PRODUCT.md` calls for backups from Postgres; a scheduled dump is a follow-up, not part of M3.

