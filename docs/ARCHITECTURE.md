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
│           ├── components/   # Shared UI
│           ├── lib/          # API client, display helpers
│           └── main.tsx
├── packages/
│   └── core/
│       └── src/
│           ├── units/          # Inches, fractions to 1/16, feet-inches display, angle convention
│           ├── inventory/      # Tool inventory schema, shared by the API and the web form
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
  generate(p: P): TemplateOutput;
}

interface TemplateOutput {
  parts: Part[];                // DOMAIN.md data model
  hardware: HardwareItem[];
  operations: Operation[];      // per part: cuts, holes, counterbores, easing
  placements: Placement[];      // 3D position and orientation of each part instance
  structuralModel: StructuralModel; // members, supports, loads, load cases, checklist items
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

Each template also describes its editor form as data (`templates/form.ts`): fields by path with a label, kind (length, angle, number, choice, yes/no), unit, help, and when the field applies. The web app renders any template's form from it, so only the template's folder knows its fields. Every field starts empty; the template's schemas decide what is valid.

Every type that appears in a snapshot is a Zod schema with its TypeScript type inferred from it, so one definition both types the code and parses a stored snapshot. Each template exports a `TemplateDefinition` (ID, version, name, schemas for parameters, structural inputs, and outputs, and a pure `generate`), and `templates/index.ts` lists them; generic code finds a template there and never imports one directly.

`snapshot/` creates a snapshot with a template's current version, reads one back, and compares a stored snapshot with what the current version would produce from the same parameters and inputs, as a list of changed paths with their values before and after. A snapshot records two versions: the template version whose numbers it holds (0008) and the shape it is stored in. Reading a snapshot stored in an older shape upgrades it step by step first, without recomputing, so old projects stay readable with their original numbers (0014).

### Method selection

For each operation, `steps/` lists the methods from the knowledge base whose required tool types and capabilities the inventory satisfies, and picks one by a fixed, documented preference order per operation. If no method fits, the step says so and names the generic tool that would allow one. Suggestions for a better tool come from the same data: a method the inventory does not support that the knowledge base marks as easier or more accurate.

## apps/api

### Routes

| Route | Purpose |
|---|---|
| `GET /api/health` | Deploy and uptime check; no session, no data |
| `POST /api/login`, `POST /api/logout`, `GET /api/session` | Login and session (0007) |
| `GET /api/templates` | Templates with their current version and name |
| `GET/PUT /api/tools` | Tool inventory; `PUT` replaces the whole list |
| `GET /api/projects`, `POST /api/projects` | List (summaries, no snapshots) and create |
| `GET /api/projects/:id` | The stored snapshot (upgraded to the current shape if needed, 0014), plus a version report: `current`, `ahead`, or `behind` with the changed paths regenerating would bring (or the issues that stop it) |
| `PUT /api/projects/:id` | Update name, status, parameters, or structural inputs; changing parameters or inputs regenerates the snapshot with the current template version |
| `POST /api/projects/:id/regenerate` | Regenerate with the current template version (explicit, never automatic) |

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
| `tools` | Tool type ID and capabilities |
| `projects` | Name, status, template ID, template version, snapshot (JSON, holding the parameters and structural inputs), timestamps |
| `project_history` | One row per operation in a project: operation type, method ID, skills. Written when the snapshot is saved; used later for references to past projects |
| `sessions` | Session ID, created, expires |
| `login_attempts` | Time window and failure count for rate limiting |

Snapshots are stored, not regenerated on every read. A project's plan therefore never changes underneath it when the template changes; the API reports the difference and regeneration is the owner's choice. Snapshots are parsed with their Zod schema when read back.

### Deploying (0006)

- `vercel.json` defines two services in one Vercel project: the web build at `/` and the API at `/api/*`, entered through `apps/api/src/vercel.ts`. The API's routes already start with `/api`, so the same paths work in development and production.
- The API connects to Neon's pooled connection string with prepared statements off (`POOLED_CONNECTION` in `bootstrap.ts`).
- Secrets live only in Vercel's environment settings and a local `.env`: `DATABASE_URL` and `PASSWORD_HASH` (see `.env.example`). The API refuses to start if either is missing or malformed, naming the variable but never printing its value.
- Every production build runs `pnpm db:migrate` for the API service (`vercel.json`): the Drizzle migrations, then the snapshot backfill (0014). It connects through `DATABASE_URL_UNPOOLED` (Neon's direct connection) when set. Preview builds skip it. Locally, `pnpm db:migrate` does the same against `.env` or the Docker database.
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
- Screens are chosen from the URL hash (`#/projects`, `#/projects/<id>`, `#/projects/<id>/edit`, `#/projects/new?template=<id>`, `#/tools`), so links, reload, and back work without a router library. Data is loaded per screen with plain `fetch` through the client; there is no client-side cache library.
- Uses core's parameter schemas to show validation before submitting; the API validates again.
- Uses core's display helpers for every length and angle so all views round the same way. A project's outputs are parsed with the template's schema and read through its `plan`, so screens know no template.
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
