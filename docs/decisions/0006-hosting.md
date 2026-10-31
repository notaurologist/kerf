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

## First-deploy measurements, October 31, 2026

- **Release step:** the production build log for the API service shows `release: migrations applied.`, and the tables exist in Neon without a manual `pnpm db:migrate` (owner, October 28). Vercel runs the API service's `buildCommand` with database access (0014).
- **Cold start:** with the Neon compute confirmed suspended (last active 79 minutes earlier), a request with a made-up session token, which makes the API look up the session in Postgres, took 2.8 s, of which about 0.1 s was the connection. The same request warm took 0.12 s. A login adds its scrypt hash (about 0.27 s locally) to either figure, so a first login after a break takes about 3 s. A login itself was not timed, because that needs the password.
- **Vercel, 6 hours of use (Observability, October 31):** 114 invocations with no errors or timeouts. Active CPU per invocation averaged 64 ms (P75 77 ms, P95 115 ms), 7 s in all, against Hobby's 14,400 s a month. Memory used averaged 342 MB (P95 397 MB) of the function's 2 GB. 21% of invocations were cold starts. The API is one function, so Observability does not split these by route. Provisioned memory in GB-hours, the unit of Hobby's 360 GB-hour limit, is on the Usage page and was not recorded.
- **Neon:** the compute was awake 8.8 hours in its first 2.4 days, about 110 hours a month at that rate. At the smallest size (0.25 CU) that is about 27 of the 100 free CU-hours; autoscaling above 0.25 CU would use more.

Backups: the free plan's restore window is 6 hours, which does not cover a mistake noticed days later. `PRODUCT.md` calls for backups from Postgres; a scheduled dump is a follow-up, not part of M3. Update, October 30, 2026 (#21): the owner chose manual dumps for now (steps in `ARCHITECTURE.md`, Backups). Neon's scheduled snapshots need a paid plan, and a free scheduled dump from GitHub Actions would need an encrypted artifact (the repository is public) and a database secret outside Vercel.


## Requests that keep the database awake, checked October 31, 2026 (#211)

Neon's compute stays awake while requests reach it, and suspends only after 5 idle minutes. One request every 4 minutes would keep it awake all month: about 720 hours at 0.25 CU, or 180 CU-hours against the free plan's 100. When the allowance is used up, compute is suspended until the next billing period.

- **Made-up session cookies** no longer reach the database. A cookie that is not the shape the API issues (43 base64url characters) is refused without a query.
- **Remaining:** every `POST /api/login` still writes to the database for rate limiting, and a cookie of the right shape is still looked up. Both are reachable without a password.
- **Neon usage alerts:** none found for the free plan. Neon's [free plan FAQ](https://neon.com/faqs/free-plan-limits-and-quotas) says compute is suspended when the CU-hours run out and mentions no notification. [Spending notifications](https://neon.com/docs/introduction/spending-notifications) are for paid plans, and the [Slack usage app](https://neon.com/blog/monitor-your-neon-usage-via-slack-alerts) was deprecated in November 2025. Usage can be checked by hand on the project's Monitoring page.
- **Vercel Firewall:** [WAF rate limiting](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting) is available on Hobby (page updated August 28, 2026): one rate-limit rule per project, keyed by IP or JA4 digest, with a fixed window of 10 seconds to 10 minutes and 1,000,000 allowed requests included. A rule on `POST /api/login` per IP would cap one source's login requests before they reach the API. It is set in the Vercel dashboard, not in `vercel.json`, and does not stop requests spread across many addresses.
