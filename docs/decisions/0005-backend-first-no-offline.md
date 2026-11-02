# 0005: Backend from the start; no PWA or offline use in the MVP

Status: Accepted (October 2026); amended for display preferences (October 2026, #155) and the home-screen install (November 2026, #414)

## Context
The first draft started with browser storage (IndexedDB) and planned to add a backend for sync later. Review found two problems. Safari can clear a site's storage after 7 days without use unless the site is installed to the home screen, which would lose data on the shop tablet. And projects designed on the laptop would need manual export and import to reach the phone. The owner prefers the robust approach over the quick one and does not want a PWA. The shop has reliable internet.

## Decision
- The API and Postgres exist from the first deployed milestone. All persisted data lives in Postgres. No browser-only storage of user data.
- A display preference for one device, such as the theme (#155), may be kept in the browser's storage. It is not user data: losing it costs nothing but a choice made again, and it is meant to differ between devices. Projects, the inventory, progress, structural inputs, and anything else that would be lost or would need to reach another device stay on the server. A stored preference is read as one of its allowed values, and anything else means the default.
- No service worker, web app manifest, or offline mode in the MVP.
- The owner may add Kerf to a phone's Home Screen and use it from there (#414). Since iOS 26, any site added to the Home Screen opens as a web app with no manifest needed, so Kerf adds no manifest for it. Kerf must work the same in Safari and from the Home Screen, on the phone and the laptop.
- The API returns a project as one complete snapshot (parameters, template version, and generated outputs), so a read-only offline mode can be added later without restructuring.

## Consequences
- A preference kept in the browser can be cleared (Safari clears script-written storage after 7 days without use unless the site is installed), and then it falls back to its default.
- The Home Screen app keeps its own storage apart from Safari. iOS copies the site's cookies into it once, when it is added, and nothing else: the login carries over, but a display preference such as the theme starts at its default. Its storage is not cleared after 7 days without use.
- In the Home Screen app, following a download link puts the file over the whole app with no way back, so Download a backup hands the file to the share sheet there instead (#416).
- The app needs hosting (0006) and login (0007) before it is useful.
- A page that is already open keeps working through a brief connection drop; a reload while offline fails.
- If shop connectivity turns out to be unreliable, offline mode is a new decision: a service worker caching the app and read-only project snapshots, still without installing the app.
