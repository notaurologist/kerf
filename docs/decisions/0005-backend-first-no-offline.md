# 0005: Backend from the start; no PWA or offline use in the MVP

Status: Accepted (October 2026)

## Context
The first draft started with browser storage (IndexedDB) and planned to add a backend for sync later. Review found two problems. Safari can clear a site's storage after 7 days without use unless the site is installed to the home screen, which would lose data on the shop tablet. And projects designed on the laptop would need manual export and import to reach the phone. The owner prefers the robust approach over the quick one and does not want a PWA. The shop has reliable internet.

## Decision
- The API and Postgres exist from the first deployed milestone. All persisted data lives in Postgres. No browser-only storage of user data.
- No service worker, web app manifest, or offline mode in the MVP.
- The API returns a project as one complete snapshot (parameters, template version, and generated outputs), so a read-only offline mode can be added later without restructuring.

## Consequences
- The app needs hosting (0006) and login (0007) before it is useful.
- A page that is already open keeps working through a brief connection drop; a reload while offline fails.
- If shop connectivity turns out to be unreliable, offline mode is a new decision: a service worker caching the app and read-only project snapshots, still without installing the app.
