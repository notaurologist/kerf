# 0007: Single-user password login with server-side sessions

Status: Accepted (October 2026)

## Context
The API is reachable on the public internet (0006) and holds the owner's projects and inventory, so it needs a login. `PRODUCT.md` rules out accounts and other users. rowing-conditions has no login, so there is no existing pattern to copy. Options considered: a third-party identity provider (another service and dependency for one user), Vercel deployment protection (does not cover API calls from other clients and depends on plan), and a password checked by the API.

## Decision
- **One password, no username.** Its hash is stored in an environment variable, created with a small script in the repository. Hashing uses Node's built-in `crypto.scrypt`, so no new dependency.
- **Server-side sessions in Postgres.** Login creates a session row with a random 256-bit ID and an expiry; the cookie holds only that ID. Logout and expiry delete the row, so a session can be revoked.
- **Cookie settings:** `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/`.
- **Every API route except login requires a valid session**, enforced by one Hono middleware. Tests cover that each route rejects requests without one.
- **Login rate limiting in Postgres** (failed attempts per time window), since function instances do not share memory.
- **Cross-site requests:** `SameSite=Strict` plus a same-origin API, and state-changing routes accept only JSON bodies.

## Consequences
- No user table. Data is not scoped by user. If Kerf ever has a second user, that is a new decision and a migration.
- Changing the password means updating the environment variable and redeploying, and existing sessions should be cleared.
- Adds two small tables (sessions, login attempts) and a password-hash script.
