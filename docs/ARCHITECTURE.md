# Architecture

Status: Draft v0.1

Read `PRODUCT.md` and `DOMAIN.md` first. Decisions behind the choices here are recorded in `docs/decisions/`.

## Principles

1. **Numbers come from `packages/core`.** Every dimension, angle, quantity, and structural result is computed by pure functions in core (0001). The API and web app never compute or adjust them.
2. **Business logic never lives only in the client.** The web app renders and collects input. Generation, validation, and persistence go through the API.
3. **Exact until display.** Lengths are decimal inches and angles are degrees in the miter-saw convention (`DOMAIN.md`, Units). Rounding to 1/16 inch happens once, in display formatting.
4. **Every structural result carries its working.** Inputs with sources, formula, intermediate values, adjustment factors, assumptions, and margin travel together as one object.
5. **Reference data is versioned with the code** (0009). Projects store IDs and versions, never copies of reference data.
6. **Kerf is a general woodworking planner; templates hold what is specific to a project type.** Everything in `packages/core` outside `templates/<template-id>/` (units, lumber, outputs, geometry helpers, structural checks) works for any template and never mentions one. Rules that apply to one kind of project, such as playground guidance from the CPSC for the swing set, live in that template's folder and reach generic code as data (for example, which fittings a bolt takes, or notes to show with a list).

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
│           ├── ui/           # The design system: tokens, layout primitives, components,
│           │                 # icons, fonts, and the catalog page (docs/design/system.md)
│           ├── lib/          # API client, routes, display helpers
│           └── main.tsx
├── packages/
│   └── core/
│       └── src/
│           ├── units/          # Inches, fractions to 1/16, feet-inches display, angle convention
│           ├── inventory/      # Tool inventory schema, checked against the tool library (knowledge/)
│           ├── geometry/       # 3D vectors, part placement, projection to 2D drawing primitives
│           ├── templates/      # One folder per template; swing-set-a-frame/ first
│           ├── outputs/        # Cut list, shopping list (board grouping with kerf and trim)
│           ├── structural/     # Generic beam and hardware checks and adjustment factors
│           ├── steps/          # Build steps: operations to methods, using the tool inventory
│           ├── knowledge/      # Tool types, skills, methods, expert-check categories (data)
│           ├── design-values/  # NDS reference values and adjustment factors (data, sourced)
│           └── snapshot/       # Project snapshots: create, read back, compare with the current version
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
  form: TemplateForm;           // how parameters and structural inputs are entered (data)
  plan(o: Outputs): Plan;       // outputs in the shape every display shares; picks, never computes
  drawings(o: Outputs): Drawings; // 2D primitives drawn from stored outputs; not stored (#90)
  generate(p: P): TemplateOutput;
}

interface TemplateOutput {
  parts: Part[];                // DOMAIN.md data model
  hardware: HardwareItem[];
  operations: Operation[];      // cuts and bolt holes made generically from parts and hardware (templates/operations.ts); easing, site work
  placements: Placement[];      // each part instance's local frame in 3D: origin and axes (DOMAIN.md, Geometry)
  structuralModel: StructuralModel; // members, supports, loads, load cases, checklist items
  layout: SiteLayout;           // footprint and clearance zones
}
```

### Generation pipeline

```
parameters ─► template.generate ─► TemplateOutput
                                     │
          tool inventory ───────────►├─► steps/       build steps, methods, flags, tool suggestions
          structural inputs ────────►├─► structural/  structural checks and confirmation checklist
                                     ├─► outputs/     cut list, shopping list
                                     └─► geometry/    isometric, exploded, cut details, site layout
                                                      (2D drawing primitives)
```

The result of the whole pipeline is a **project snapshot**: one JSON-serializable object with a Zod schema, containing the template ID and version, the parameters and inputs used, and every generated output. Structural checks with missing inputs appear in the snapshot as "input needed," never computed with a stand-in value.

Drawings (`geometry/`, #90) are drawn from a snapshot's stored outputs, not stored with them: the isometric and exploded views, a cut detail per part, and the site layout, as 2D primitives (lines, polygons, arcs, circles, text, part letters) in drawing coordinates. Each primitive carries a line or text role from the drawing standard (`docs/design/diagrams.html`), never a color or width, and the part ID, instance, and letter it belongs to. Every number in a label comes from core's formatters, and a plan's drawings show the numbers it was made with. Generic code draws solids from parts and placements, orders faces with a BSP tree, and lays out cut details and plans; the template supplies the viewpoint, the ground, phantom lines such as chains, how the exploded view pulls parts apart, and the site plan's areas, as data. Where the drawings are produced for the web app is #91's choice.

Each template also describes its editor form as data (`templates/form.ts`): fields by path with a label, kind (length, angle, number, choice, yes/no), unit, help, and when the field applies. The web app renders any template's form from it, so only the template's folder knows its fields. Every field starts empty; the template's schemas decide what is valid.

Every type that appears in a snapshot is a Zod schema with its TypeScript type inferred from it, so one definition both types the code and parses a stored snapshot. Each template exports a `TemplateDefinition` (ID, version, name, schemas for parameters, structural inputs, and outputs, and a pure `generate`), and `templates/index.ts` lists them; generic code finds a template there and never imports one directly.

`snapshot/` creates a snapshot with a template's current version, reads one back, and compares a stored snapshot with what the current version would produce from the same parameters and inputs, as a list of changed paths with their values before and after. It also compares two snapshots of one project, such as the saved one and an edit's preview, through the template's `plan`, so the paths are the ones every display shares (`cutList[0].length`, `checks[0].margin`). A snapshot records two versions: the template version whose numbers it holds (0008) and the shape it is stored in. Reading a snapshot stored in an older shape upgrades it step by step first, without recomputing, so old projects stay readable with their original numbers (0014).

### Method selection

For each operation, `steps/` lists the methods from the knowledge base whose required tool types and capabilities the inventory satisfies, and picks one by a fixed, documented preference order per operation. If no method fits, the step says so and names the generic tool that would allow one. Suggestions for a better tool come from the same data: a method the inventory does not support that the knowledge base marks as easier or more accurate.

The preference order is the order of `METHODS` in `knowledge/methods.ts`, where each operation type's methods are listed together: guided and stationary power tools first, since they hold the line and the angle, and hand tools last. A method's tools are met when, for each requirement, the inventory has one of its tool types with every capability it needs at least the operation's value divided by the number of passes. Each method lists the methods for the same operation it is easier than and more accurate than (`easierThan`, `moreAccurateThan`). `fillMethodText` fills a method's `{name}` values from an operation with core's formatters.

`steps/select.ts` applies this to one operation. A tool type the inventory lacks, or a capability below what the operation needs, is a gap; a capability not entered is a gap too, never a guess (hard rule 3). The chosen method is the first with no gaps. With none, the step names the tools for the method with the fewest gaps, ties going to preference order. Methods that wait only on capabilities not entered, and that are preferred over the chosen one or better than it, are listed as input needed, so the step says which entry would allow them. Methods the inventory does not support that are easier or more accurate than the chosen one are the tool suggestions, each gap described by `describeChoice` with core's formatters.

`steps/build.ts` turns a plan's operations into build steps. Each template supplies its step order as data through `TemplateDefinition.steps`: groups of operation IDs with a title and the expert-check categories the work falls in. Generic code chooses a method for each operation, fills its text, and gathers each step's parts, skills, and flags: the chosen methods' flags, the plan's flags whose hardware the step drills for or, failing that, whose parts it first works on (#51), and the step's categories. An outline that leaves out, repeats, or invents an operation throws. Like drawings, steps are made on read from the stored operations and the current inventory and knowledge base, and are not stored. `planSteps` returns them with `inventoryKey`, a short hash of the inventory's library tools and capabilities; the project response carries both (#52).

## apps/api

### Routes

| Route | Purpose |
|---|---|
| `GET /api/health` | Deploy and uptime check; no session, no data |
| `POST /api/login`, `POST /api/logout`, `GET /api/session` | Login and session (0007) |
| `GET /api/templates` | Templates with their current version and name |
| `GET/PUT /api/tools` | Tool inventory: library tools with their capabilities, and other tools by name; `PUT` replaces the whole list |
| `GET /api/projects`, `POST /api/projects` | List (summaries, no snapshots) and create |
| `GET /api/projects/:id` | The stored snapshot (upgraded to the current shape if needed, 0014), plus a version report: `current`, `ahead`, or `behind` with the changed paths regenerating would bring (or the issues that stop it), the plan's drawings, drawn by core from the stored snapshot on each read (#91), and its build steps, with methods chosen from the current tool inventory and that inventory's key (`inventoryKey`), so the shop view needs no other request and a stale step list can be detected (#52) |
| `PUT /api/projects/:id` | Update name, status, parameters, or structural inputs; changing parameters or inputs regenerates the snapshot with the current template version |
| `POST /api/projects/:id/preview` | Dry run for the edit screen (#56): takes the same body as `PUT`, generates the snapshot with the current template version, and returns it with the changed paths against the stored snapshot. Saves nothing; 422 with core's issues like `PUT` |
| `POST /api/projects/:id/regenerate` | Regenerate with the current template version (explicit, never automatic) |
| `DELETE /api/projects/:id` | Delete a project and its history rows, permanently (204) |

Errors are JSON with an `error` code: 400 for a malformed request (with `issues` and their paths), 401 without a session, 404 for a missing project, 415 for a state-changing request that is not JSON, 422 when core rejects the parameters or inputs (with core's `issues`), 429 when login is rate limited. Routes call services in `services/`, the only code that touches the database.

### Login (0007)

- `PASSWORD_HASH` holds `scrypt:N:r:p:salt:hash` (base64url), made by `pnpm --filter @kerf/api hash-password` with N = 2^17, r = 8, p = 1. Verification reads the cost from the stored hash and compares in constant time.
- The session cookie `kerf_session` holds a random 256-bit token; `sessions` stores only its SHA-256 hash, so the table alone gives no working session. Sessions last 30 days. Expired rows are deleted at the next login.
- Rate limiting counts failed logins for the whole app in fixed 15-minute windows, at most 10 per window, then answers 429 with `Retry-After`, even for the right password. Each attempt is counted before the password is checked and taken back on success, so parallel guesses cannot slip under the limit. The limit is global rather than per address: there is one user, and a per-address limit lets anyone with many addresses keep guessing. The cost is that someone guessing can keep the owner locked out; changing that is a new decision.
- One middleware requires a session on every route except `GET /api/health` and `POST /api/login`, listed by method and path. A test walks every route the app registers and checks each answers 401 without a session.
- `POST`, `PUT`, `PATCH`, and `DELETE` requests must have a JSON content type (415 otherwise).

### Data (sketch)

| Table | Contents |
|---|---|
| `tools` | Library tool type ID and the capabilities entered. Rows from before the library are read through core's `readStoredTools`, which moves what the library lacks to `other_tools`; the release step rewrites them |
| `other_tools` | Tools the library does not have: position, name, note |
| `projects` | Name, status, template ID, template version, snapshot (JSON, holding the parameters and structural inputs), timestamps |
| `project_history` | One row per operation in a project: operation ID and type, the method chosen (null when the inventory supported none), its skills, and the key of the inventory it was chosen from. Replaced in the same transaction whenever a snapshot is saved (create, a parameter or input change, regenerate), not on a rename or status change. The release step writes rows for projects that have none and keeps rows that exist (#106). Used later for references to past projects |
| `sessions` | Session ID, created, expires |
| `login_attempts` | Time window and failure count for rate limiting |

Snapshots are stored, not regenerated on every read. A project's plan therefore never changes underneath it when the template changes; the API reports the difference and regeneration is the owner's choice. Snapshots are parsed with their Zod schema when read back.

### Deploying (0006)

- `vercel.json` defines two services in one Vercel project: the web build at `/` and the API at `/api/*`, entered through `apps/api/src/vercel.ts`. The API's routes already start with `/api`, so the same paths work in development and production.
- The API connects to Neon's pooled connection string with prepared statements off (`POOLED_CONNECTION` in `bootstrap.ts`).
- Secrets live only in Vercel's environment settings and a local `.env`: `DATABASE_URL` and `PASSWORD_HASH` (see `.env.example`). The API refuses to start if either is missing or malformed, naming the variable but never printing its value.
- Every production build runs `pnpm db:migrate` for the API service (`vercel.json`): the Drizzle migrations, then the snapshot backfill (0014) and the tool-inventory backfill. It connects through `DATABASE_URL_UNPOOLED` (Neon's direct connection) when set. Preview builds skip it. Locally, `pnpm db:migrate` does the same against `.env` or the Docker database.
- Changing the password: run `pnpm --filter @kerf/api hash-password`, set the new `PASSWORD_HASH` in Vercel, redeploy, and delete the rows in `sessions` (0007).

#### First deploy (the owner's steps; they need accounts)

1. **Neon:** a free project on Postgres 18 in AWS `us-east-1`, near Vercel's default function region. Copy the pooled connection string (host ends in `-pooler`) and the direct one.
2. **Password hash:** in a terminal, `pnpm --filter @kerf/api hash-password`; copy the printed `scrypt:...` value.
3. **Vercel:** on the Hobby plan, import the GitHub repository with the repository root as the root directory, so `vercel.json` applies. Node.js version 24.x.
4. **Environment variables, Production only, marked Sensitive:** `DATABASE_URL` (pooled), `DATABASE_URL_UNPOOLED` (direct), `PASSWORD_HASH`. Preview deployments get none, so they cannot reach the production database; their API does not start.
5. **Deploy** `main`. The API's build log shows `release: migrations applied.`
6. **Check:** `pnpm --filter @kerf/api check-deploy https://<project>.vercel.app` asks for the password without echo, then checks health, login, storing and reading a project, and logout. It leaves one project named "Deploy check".

## apps/web

- Talks only to `/api/*` on its own origin, through the Hono typed client (`src/lib/api.ts`). One function, `send`, turns responses into results the UI shows; a 401 sends the owner to the login screen.
- Screens are chosen from the URL hash (`#/projects`, `#/projects/<id>`, `#/projects/<id>/edit`, `#/projects/new?template=<id>`, `#/tools`, and `#/catalog` for the design system's catalog), so links, reload, and back work without a router library. Data is loaded per screen with plain `fetch` through the client; there is no client-side cache library.
- Uses core's parameter schemas to show validation before submitting; the API validates again.
- The edit screen shows the project's output beside the form (#39, L-A). A moment after typing stops, it asks the preview route for the snapshot the form would produce, labels it "Preview, not saved", and marks each changed value with the saved one, from the paths the route returns.
- Uses core's display helpers for every length and angle so all views round the same way. A project's outputs are parsed with the template's schema and read through its `plan`, so screens know no template.
- **The design system lives in `src/ui`** (`docs/design/README.md`, Stage 6; usage in `docs/design/system.md`).
  - **Styles:** plain CSS in cascade layers, in the order `reset, tokens, base, layout, components, print`. Tokens are custom properties; colors are `light-dark()` pairs that follow the device.
  - **Fonts:** Atkinson Hyperlegible Next and Mono, self-hosted (decision 0015).
  - **Screens:** built only from `ui/` components and layout primitives. They write no `className` or `style` and import no stylesheet, which `ui/screens.test.ts` enforces. A screen that needs something new gets a new component in `ui/`, with tests and a place on the catalog page.
- Diagrams render core's 2D primitives, which the API sends with the project, as SVG through `Diagram` inside `DiagramFrame` (#91). Each primitive's role maps to the line and diagram tokens; strokes do not scale, and text, arrowheads, and part letters are sized in pixels for the width shown. Tapping a part selects it in the drawings and the cut list, whose part names are the keyboard path. In print, each section of the plan starts a page with a title block, the isometric, exploded, and site views take landscape pages, cut details do not split, zones are hatched, and expandable working opens.
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
| `apps/web` | Forms, rendering of snapshots, and that displayed values use core's formatters; each component's states and accessible names; every recorded contrast ratio against the color tokens; no styles outside `ui/`; no template's ID or words in generic code anywhere in the repository (`generic.test.ts`) |
