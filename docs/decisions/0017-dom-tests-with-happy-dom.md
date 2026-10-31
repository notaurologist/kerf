# 0017: Interaction tests in happy-dom

Status: Accepted (October 2026). Decided by the owner on #205.

## Context
Web tests render components to an HTML string (`apps/web/src/test/render.tsx`, `renderToString`). That checks markup well, but no effect, focus move, dialog, event, or address change runs, so the error summary's focus, the leave guard, the dialog, and route changes had no test. The engineering review of 31 October 2026 traced its four High frontend findings to this gap.

Both candidate environments were tried against what these tests need (October 31, 2026):

| | happy-dom 21.0.4 | jsdom 30.1.3 |
|---|---|---|
| `<dialog>` `showModal()` and `close()` | Yes | Not implemented |
| `ResizeObserver`, `scrollIntoView` | Yes | No |
| `focus()`, including `tabindex="-1"` | Yes | Yes |
| `hashchange` | Yes | Yes |
| React 19 effects through `act` | Yes | Yes |
| Direct dependencies | 7 | About 20 |

## Decision
- **happy-dom** is the DOM for interaction tests. The owner asked for the simple, fast choice if it covers the need, and it does without stubs.
- **Interaction tests are `*.dom.test.tsx`** files in `apps/web` that start with `// @vitest-environment happy-dom`. Every other web test keeps running in Node and renders to a string; markup stays tested that way.
- **No Testing Library.** `apps/web/src/test/dom.tsx` mounts with React's own `createRoot` and `act`, clicks, changes the address, and waits a turn for its events. Add Testing Library only if that helper grows into a copy of it.

## Consequences
- A `ui/` component or hook with an effect, focus, or event handling needs a DOM test (`docs/design/system.md`, Adding a component).
- happy-dom is not a browser. Known differences found so far: Escape does not fire `cancel` on a modal dialog (tests dispatch `cancel` themselves), the dialog does not move focus into itself on `showModal`, and `location.replace` adds a history entry. Behavior that depends on these needs a check in a real browser.
- Pinned exactly in `apps/web` like every other dependency (0011).
