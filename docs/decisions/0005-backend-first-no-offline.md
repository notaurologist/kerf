# 0005: Backend from the start; no PWA or offline use in the MVP

Status: Accepted (October 2026); amended for display preferences (October 2026, #155)

## Context
The first draft started with browser storage (IndexedDB) and planned to add a backend for sync later. Review found two problems. Safari can clear a site's storage after 7 days without use unless the site is installed to the home screen, which would lose data on the shop tablet. And projects designed on the laptop would need manual export and import to reach the phone. The owner prefers the robust approach over the quick one and does not want a PWA. The shop has reliable internet.

## Decision
- The API and Postgres exist from the first deployed milestone. All persisted data lives in Postgres. No browser-only storage of user data.
- A display preference for one device, such as the theme (#155), may be kept in the browser's storage. It is not user data: losing it costs nothing but a choice made again, and it is meant to differ between devices. Projects, the inventory, progress, structural inputs, and anything else that would be lost or would need to reach another device stay on the server. A stored preference is read as one of its allowed values, and anything else means the default.
- No service worker, web app manifest, or offline mode in the MVP.
- The API returns a project as one complete snapshot (parameters, template version, and generated outputs), so a read-only offline mode can be added later without restructuring.

## Consequences
- A preference kept in the browser can be cleared (Safari clears script-written storage after 7 days without use unless the site is installed), and then it falls back to its default.
- The app needs hosting (0006) and login (0007) before it is useful.
- A page that is already open keeps working through a brief connection drop; a reload while offline fails.
- If shop connectivity turns out to be unreliable, offline mode is a new decision: a service worker caching the app and read-only project snapshots, still without installing the app.
