# 0007: Single-user password login with server-side sessions

Status: Accepted (October 2026)

## Context
The API is reachable on the public internet (0006) and holds the owner's projects and inventory, so it needs a login. `PRODUCT.md` rules out accounts and other users. rowing-conditions has no login, so there is no existing pattern to copy. Options considered: a third-party identity provider (another service and dependency for one user), Vercel deployment protection (does not cover API calls from other clients and depends on plan), and a password checked by the API.

## Decision
- **One password, no username.** Its hash is stored in an environment variable, created with a small script in the repository. Hashing uses Node's built-in `crypto.scrypt`, so no new dependency.
- **Server-side sessions in Postgres.** Login creates a session row with a random 256-bit ID and an expiry; the cookie holds only that ID. Logout and expiry delete the row, so a session can be revoked.
- **Sessions end when the password changes** (owner's decision, October 31, 2026, #212). Each session stores a short fingerprint of `PASSWORD_HASH` (64 bits of a SHA-256 of it) and is valid only while it matches the configured hash. The hash itself is never stored or logged.
- **Log out everywhere** (owner's decision, November 5, 2026, #708). `POST /api/logout-all`, behind the session like every other route, deletes every session row, the caller's too, and clears the cookie. Workshop offers it next to Log out and asks first, in place, since it also logs out the phone and the Home Screen app. Before this, changing the password was the only way to end another device's session (#212).
- **Cookie settings:** `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/`.
- **Every API route except login and `GET /api/health` requires a valid session**, enforced by one Hono middleware. The health check returns no data. Tests cover that each route rejects requests without one.
- **Login rate limiting in Postgres** (failed attempts per time window), since function instances do not share memory. Two limits (owner's decision, October 31, 2026, #212):
  - **Per address:** 10 failures per 15 minutes. The address is the first entry of `x-forwarded-for`, which Vercel overwrites with the connecting address, so a client cannot choose its own. IPv6 addresses count together by /64, since one client usually holds a whole /64. Without the header, as in local development, all logins share one count.
  - **For the whole app:** 100 failures per hour. Attempts the per-address limit refuses do not count toward it.
  - Before this, the only limit was 10 failures per 15 minutes for the whole app, so anyone guessing could keep the owner locked out.
- **Cross-site requests:** `SameSite=Strict` plus a same-origin API, and state-changing routes accept only JSON bodies.

## Consequences
- No user table. Data is not scoped by user. If Kerf ever has a second user, that is a new decision and a migration.
- Changing the password means updating the environment variable and redeploying. Sessions created under the old hash stop working with the new deploy.
- **Remaining risk:** guessers using many addresses together can still use up the global cap and keep the owner from logging in for the rest of the hour. A session the owner already has is unaffected, since sessions last 30 days and are not rate limited. Log out everywhere ends that session too, so using it during such an attack means waiting out the hour to log in again.
- Storing client addresses: a row per address and window, deleted once the window has passed.
- Adds two small tables (sessions, login failures) and a password-hash script.
