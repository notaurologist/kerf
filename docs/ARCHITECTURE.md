# Architecture

Status: Draft v0.1

Read `PRODUCT.md` and `DOMAIN.md` first. Decisions behind the choices here are recorded in `docs/decisions/`.

## Principles

1. **Numbers come from `packages/core`.** Every dimension, angle, quantity, and structural result is computed by pure functions in core (0001). The API and web app never compute or adjust them.
2. **Business logic never lives only in the client.** The web app renders and collects input. Generation, validation, and persistence go through the API.
3. **Exact until display.** Lengths are decimal inches and angles are degrees in the miter-saw convention (`DOMAIN.md`, Units). Rounding to 1/16 inch happens once, in display formatting.
4. **Every structural result carries its working.** Inputs with sources, formula, intermediate values, adjustment factors, assumptions, and margin travel together as one object.
5. **Reference data is versioned with the code** (0009). Projects store IDs and versions, never copies of reference data.

## System overview

```
 ┌──────────────────┐
 │     apps/web     │  React + Vite, SVG diagrams
 └────────┬─────────┘
          │  same origin, /api/*, typed client (hono/client)
 ┌────────▼─────────┐
 │     apps/api     │  Hono (Vercel Functions in production)
 │  auth middleware │
 │  routes          │
 │  services        │──── packages/core (templates, geometry, structural,
 │  db (Drizzle)    │                    knowledge, design values, display)
 └────────┬─────────┘
          │
 ┌────────▼─────────┐
 │     Postgres     │  projects, tools, sessions, login attempts
 └──────────────────┘
```

The web app also imports `packages/core` for types, parameter schemas (to validate forms before submitting), and display formatting. It never calls the generation functions to produce numbers it then shows as authoritative; it shows the snapshot the API returns.

## Repository layout

```
/
├── AGENTS.md                 # Agent entry point (CLAUDE.md imports it)
├── CLAUDE.md
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── routes/       # HTTP only: parse input with Zod, call services, return output
│   │   │   ├── services/     # Project generation, inventory, sessions
│   │   │   ├── auth/         # Session middleware, password check, rate limiting
│   │   │   ├── db/           # Drizzle schema, migrations, queries
│   │   │   ├── app.ts        # Hono app and exported AppType; no server, so tests call app.request()
│   │   │   ├── index.ts      # Local Node server
│   │   │   └── vercel.ts     # Vercel entry point
│   │   ├── scripts/          # hash-password
│   │   └── test/
│   └── web/
│       └── src/
│           ├── features/     # inventory/, project-editor/, cut-list/, shopping-list/,
│           │                 # diagrams/, build-steps/, structural/, login/
│           ├── components/   # Shared UI
│           ├── lib/          # API client, display helpers
│           └── main.tsx
├── packages/
│   └── core/
│       └── src/
│           ├── units/          # Inches, fractions to 1/16, feet-inches display, angle convention
│           ├── geometry/       # 3D vectors, part placement, projection to 2D drawing primitives
│           ├── templates/      # One folder per template; swing-set-a-frame/ first
│           ├── outputs/        # Cut list, shopping list (board grouping with kerf and trim)
│           ├── structural/     # Beam and hardware checks, adjustment factors, checklist generation
│           ├── steps/          # Build steps: operations to methods, using the tool inventory
│           ├── knowledge/      # Tool types, skills, methods, expert-check categories (data)
│           ├── design-values/  # NDS reference values and adjustment factors (data, sourced)
│           └── types/          # Shared domain types and Zod schemas
└── docs/
```

## packages/core

Pure TypeScript. No I/O, no framework dependencies, no clock or randomness. The same inputs always produce the same output, which is what makes worked-example tests and template versions meaningful.

### Template contract (sketch)

```ts
interface Template<P> {
  id: string;                   // 'swing-set-a-frame'
  version: number;              // bumped when output for the same parameters changes (0008)
  params: z.ZodType<P>;         // types, ranges, defaults
  validate(p: P): Issue[];      // combinations: contradictory or out-of-range values
  generate(p: P): TemplateOutput;
}

interface TemplateOutput {
  parts: Part[];                // DOMAIN.md data model
  hardware: HardwareItem[];
  operations: Operation[];      // per part: cuts, holes, counterbores, easing
  placements: Placement[];      // 3D position and orientation of each part instance
  structuralModel: StructuralModel; // members, supports, load points for structural/
  layout: SiteLayout;           // footprint and clearance zones
}
```

### Generation pipeline

```
parameters ─► template.generate ─► TemplateOutput
                                     │
          tool inventory ───────────►├─► steps/       build steps, methods, flags, tool suggestions
          structural inputs ────────►├─► structural/  sanity checks and confirmation checklist
                                     ├─► outputs/     cut list, shopping list
                                     └─► geometry/    isometric, exploded, cut details, site layout
                                                      (2D drawing primitives)
```

The result of the whole pipeline is a **project snapshot**: one JSON-serializable object with a Zod schema, containing the template ID and version, the parameters and inputs used, and every generated output. Structural checks with missing inputs appear in the snapshot as "input needed," never computed with a stand-in value.

### Method selection

For each operation, `steps/` lists the methods from the knowledge base whose required tool types and capabilities the inventory satisfies, and picks one by a fixed, documented preference order per operation. If no method fits, the step says so and names the generic tool that would allow one. Suggestions for a better tool come from the same data: a method the inventory does not support that the knowledge base marks as easier or more accurate.

## apps/api

### Routes (sketch)

| Route | Purpose |
|---|---|
| `GET /api/health` | Deploy and uptime check; no session, no data |
| `POST /api/login`, `POST /api/logout`, `GET /api/session` | Login and session (0007) |
| `GET /api/templates` | Templates with their current version and parameter schema metadata |
| `GET/PUT /api/tools` | Tool inventory |
| `GET /api/projects`, `POST /api/projects` | List and create |
| `GET /api/projects/:id` | The stored snapshot, plus whether the current template version would produce different output |
| `PUT /api/projects/:id` | Update name, status, parameters, or structural inputs; regenerates the snapshot |
| `POST /api/projects/:id/regenerate` | Regenerate with the current template version (explicit, never automatic) |

### Data (sketch)

| Table | Contents |
|---|---|
| `tools` | Tool type ID and capabilities |
| `projects` | Name, status, template ID, template version, parameters (JSON), structural inputs (JSON), snapshot (JSON), timestamps |
| `project_history` | One row per operation in a project: operation type, method ID, skills. Written when the snapshot is saved; used later for references to past projects |
| `sessions` | Session ID, created, expires |
| `login_attempts` | Time window and failure count for rate limiting |

Snapshots are stored, not regenerated on every read. A project's plan therefore never changes underneath it when the template changes; the API reports the difference and regeneration is the owner's choice. Snapshots are parsed with their Zod schema when read back.

## apps/web

- Talks only to `/api/*` on its own origin, through the Hono typed client.
- Uses core's parameter schemas to show validation before submitting; the API validates again.
- Uses core's display helpers for every length and angle so all views round the same way.
- Diagrams render core's 2D primitives as SVG. Print styles give each diagram and the cut list its own page.
- Phone and tablet layouts are first-class: large text and one build step at a time (`PRODUCT.md`, MVP feature 9).

## Testing

| Area | What tests must cover |
|---|---|
| `units/` | Fraction rounding at every 1/32 boundary, feet-inches display, angle convention conversions |
| `templates/` | Hand-checked worked examples; fit tests (`DOMAIN.md`, Verification); validation of contradictory parameters; a version-bump test listing changed outputs |
| `structural/` | Hand-checked worked examples for each check, including the symmetric hand-check cases and an asymmetric case; missing inputs produce "input needed" |
| `outputs/` | Board grouping including kerf and trim; nothing silently dropped when a part is longer than any buyable length |
| `knowledge/`, `design-values/` | Every entry parses; every reference resolves; every design value has a source |
| `apps/api` | Every route rejects requests without a session; login rate limiting; snapshot round trip through Postgres (PGlite, 0010) |
| `apps/web` | Forms, rendering of snapshots, and that displayed values use core's formatters |
