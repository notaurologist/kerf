# 0004: React and Vite for the web app, SVG for diagrams

Status: Accepted (October 2026)

## Context
The web app needs forms (parameters, inventory, structural inputs), lists (cut list, shopping list, steps), and diagrams: isometric assembled view, exploded view, per-part cut details, and a site layout. Diagrams must be printable and readable on a phone. The options for diagrams were SVG with a hand-written isometric projection or a 3D library such as three.js.

## Decision
- **React with Vite** for the web app, matching rowing-conditions.
- **SVG** for every diagram. `packages/core` turns template geometry into 2D drawing primitives (projected lines, polygons, dimension labels); the web app renders them as SVG. No 3D library.

## Consequences
- Diagrams print cleanly and scale to any screen, and the projection is testable as pure functions.
- No interactive 3D rotation. If that becomes worth having, it is a new decision; the 3D geometry in core would carry over.
