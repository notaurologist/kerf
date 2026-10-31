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
│   │   │   ├── services/     # Projects and their request bodies, history, progress, inventory
│   │   │   ├── auth/         # Session middleware, password check, rate limiting
│   │   │   ├── db/           # Drizzle schema, migrations, queries
│   │   │   ├── app.ts        # Hono app and exported AppType; no server, so tests call app.request()
│   │   │   ├── index.ts      # Local Node server
│   │   │   └── vercel.ts     # Vercel entry point
│   │   ├── scripts/          # release (runs at deploy), hash-password, check-deploy,
│   │   │                     # write-snapshot-fixture
│   │   └── test/
│   └── web/
│       ├── public/           # Icons and the social preview image (docs/design/brand.md)
│       └── src/
│           ├── features/     # One folder per screen or plan section: projects/, project/,
│           │                 # project-editor/, modes/, boards/, cut-list/, shopping-list/,
│           │                 # diagrams/, build-steps/, structural/, glossary/, inventory/,
│           │                 # login/
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
│           ├── model/          # The generic template contract: TemplateDefinition, output types,
│           │                   # operations, forms, starting questions, part letters
│           ├── templates/      # The registry (index.ts) and one folder per template;
│           │                   # swing-set-a-frame/ first
│           ├── outputs/        # Cut list, shopping list (board grouping with kerf and trim)
│           ├── structural/     # Generic beam and hardware checks and adjustment factors
│           ├── steps/          # Build steps: operations to methods, using the tool inventory
│           ├── progress/       # What can be ticked off in a plan, and which ticks a regeneration clears
│           ├── knowledge/      # Tool types, skills, methods, expert-check categories, glossary (data)
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
  ownWords: string[];           // words only its folder may use, such as its parts' names
  params: z.ZodType<P>;         // types, ranges, defaults
  outputs: z.ZodType<O>;        // what generate makes now: every field generic code reads, required
  storedOutputs: z.ZodType<S>;  // reads a stored snapshot after its upgrades (0014); relaxes only
                                // the fields older shapes lack
  validate(p: P): Issue[];      // combinations: contradictory or out-of-range values
  form: TemplateForm;           // how parameters and structural inputs are entered (data)
  plan(o: Stored): Plan;        // outputs in the shape every display shares; picks and fills in
                                // what an older snapshot lacks, never computes
  drawings(o: Stored): Drawings; // 2D primitives drawn from stored outputs; not stored (#90)
  assembly(o: Stored): { scene; view; explode } | null; // what the 3D views draw from, as data (#118)
  generate(p: P): TemplateOutput;
  questions?: StartingQuestions; // a few plain questions and a pure answers-to-parameters function (#163)
}

interface TemplateOutput {
  parts: Part[];                // DOMAIN.md data model
  hardware: HardwareItem[];
  operations: Operation[];      // cuts and bolt holes made generically from parts and hardware (model/operations.ts); easing, site work
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

Drawings (`geometry/`, #90) are drawn from a snapshot's stored outputs, not stored with them: the isometric and exploded views, a cut detail per part, the site layout, a drawing of each board to buy with the pieces it becomes (`boardDrawings`, #59: to scale along the length, not across; trim and offcut as zones), and an action drawing for each assembly step (`stepDrawings`, #118: a step that joins parts; only what it adds, tinted as the drawing's `emphasis`, pulled away by the template's exploded offsets with a one-headed motion arrow back, on what earlier assembly steps built, without phantoms), as 2D primitives (lines, polygons, arcs, circles, text, part letters) in drawing coordinates. Each primitive carries a line or text role from the drawing standard (`docs/design/diagrams.html`), never a color or width, and the part ID, instance, and letter it belongs to. Every number in a label comes from core's formatters, and a plan's drawings show the numbers it was made with. Generic code draws solids from parts and placements, orders faces with a BSP tree, and lays out cut details and plans; the template supplies the viewpoint, the ground, phantom lines such as chains, how the exploded view pulls parts apart, and the site plan's areas, as data. `projectDrawings` (`steps/drawings.ts`) puts a project's drawings together: the template's own, then the board drawings and action drawings that every template's data supports. The API sends them with the project (#91).

Each template also describes its editor form as data (`model/form.ts`): fields by path with a label, kind (length, angle, number, choice, yes/no), unit, help, when the field applies, and whether it is a parameter the owner enters or confirms (`confirmed`, such as a hardware size). Sections are parts of the project; a parameters section and a structural inputs section with the same title are one part (`formParts`), so the editor and the plan's Parameters and inputs show a part's size, lumber, bolts, and structural inputs together (#164). The web app renders any template's form from it, so only the template's folder knows its fields. Every field starts empty; the template's schemas decide what is valid.

A template can also ask starting questions (`model/questions.ts`, #163): questions as form sections like its own form, a Zod schema for the answers, and a pure function from the answers to suggested values for the form's fields. Each suggestion names its field and where it came from (the owner's answer, a cited source, a named convention, the worked example, or a stated rule of thumb), and may carry a note, such as a limit the answers set; a suggestion with no value leaves the field empty and the note says why. `suggestedValues` turns them into the form's text. A template suggests no hardware and no structural input except the ones the owner answered directly (hard rule 3). The web app runs the suggestion on the new-project screen, as it fills a worked example's values: they are entries the owner reviews, not output it presents, and the preview still comes from the API.

Every type that appears in a snapshot is a Zod schema with its TypeScript type inferred from it, so one definition both types the code and parses a stored snapshot. The generic contract lives in `model/`: `TemplateDefinition` and the output types every template shares (parts, end cuts, holes, hardware, flags, checklist items). Each template exports a `TemplateDefinition` (ID, version, name, its own words, schemas for parameters, structural inputs, and outputs, and a pure `generate`), and `templates/index.ts` lists them; generic code finds a template there and never imports one directly. Only the registry imports from a template's folder, and only core's entry point imports the registry (`apps/web/src/templateFolders.test.ts`).

The shared output types describe what a template generates now, so every field generic code reads is required: a template that leaves out a part's holes or a hardware item's store group fails to type-check rather than drawing or listing nothing. Snapshots stored before a field existed are read with the template's `storedOutputs`, which relaxes only those fields (0014), and the template's `plan`, `drawings`, `assembly`, and `steps` fill in what generic code needs, such as an empty list of holes. The swing set keeps its relaxed schema and the fill-ins in `templates/swing-set-a-frame/outputs.ts`. `Plan` leaves out what a stored plan does not say and a display can do without: a hardware line's group, a part's reference edge, and what an end cut is measured from.

`snapshot/` creates a snapshot with a template's current version, reads one back, and compares a stored snapshot with what the current version would produce from the same parameters and inputs, as a list of changed paths with their values before and after. It also compares two snapshots of one project, such as the saved one and an edit's preview, through the template's `plan`, so the paths are the ones every display shares (`cutList[0].length`, `checks[0].margin`). A snapshot records two versions: the template version whose numbers it holds (0008) and the shape it is stored in. Reading a snapshot stored in an older shape upgrades it step by step first, without recomputing, so old projects stay readable with their original numbers (0014).

### Method selection

For each operation, `steps/` lists the methods from the knowledge base whose required tool types and capabilities the inventory satisfies, and picks one by a fixed, documented preference order per operation. If no method fits, the step says so and names the generic tool that would allow one. Suggestions for a better tool come from the same data: a method the inventory does not support that the knowledge base marks as easier or more accurate.

The preference order is the order of `METHODS` in `knowledge/methods.ts`, where each operation type's methods are listed together: guided and stationary power tools first, since they hold the line and the angle, and hand tools last. A method's tools are met when, for each requirement, the inventory has a tool of one of its types with every capability it needs at least the operation's value divided by the number of passes. The inventory can hold several tools of a type, each named; the first in the owner's list that meets the requirement is chosen, and the step names it. Each method lists the methods for the same operation it is easier than and more accurate than (`easierThan`, `moreAccurateThan`). `fillMethodText` fills a method's `{name}` values from an operation with core's formatters.

### Glossary

`knowledge/glossary.ts` holds the glossary: each term with its other forms (plurals), a definition, an optional illustration, and sources where the definition is safety-relevant. `findTerms` finds the uses of glossary terms in a string: whole words, ignoring case, the longest term at each place, never inside a tool type's name ("miter" in "miter saw"), and never "Kerf" with a capital, which is the app's name. Screens use it to mark the first use of a term (`docs/design/content.md`, Definitions). `knowledge/illustrations.ts` draws the terms a picture explains best as 2D primitives, by `IllustrationId`; an entry names its drawing. `steps/terms.ts` finds the terms a plan uses (`planTerms`) in the same text the screens mark, for the printed plan's "Terms used in this plan", which follows the last section on paper and never shows on screen.

`steps/select.ts` applies this to one operation. A tool type the inventory lacks, or a capability below what the operation needs, is a gap; a capability not entered is a gap too, never a guess (hard rule 3). The chosen method is the first with no gaps. With none, the step names the tools for the method with the fewest gaps, ties going to preference order. Methods that wait only on capabilities not entered, and that are preferred over the chosen one or better than it, are listed as input needed, so the step says which entry would allow them. Methods the inventory does not support that are easier or more accurate than the chosen one are the tool suggestions, each gap described by `describeChoice` with core's formatters.

`steps/build.ts` turns a plan's operations into build steps. Cutting goes board by board (#58): one step per board in the board plan's order, listing its pieces as they come off it (each with its part ID and instance, so the part's cut detail opens from it) and the cutting operations (`CUTTING_OPERATION_TYPES`) on those parts, counted for that board. A part whose pieces are on two boards has its cuts in both steps. A cut whose part is on no board, because no buyable board holds it, gets a step after the boards. The planning cut list stays grouped by part. Each template supplies the order of everything else as data through `TemplateDefinition.steps`: groups of operation IDs with a title and the expert-check categories the work falls in; those steps follow the cutting steps. Generic code chooses a method for each operation, fills its text, and gathers each step's parts, skills, and flags: the chosen methods' flags, the plan's flags whose hardware the step drills for or, failing that, whose parts it first works on (#51), and the step's categories. An outline that leaves out, repeats, or invents an operation, or holds a cutting operation, throws. Like drawings, steps are made on read from the stored operations and the current inventory and knowledge base, and are not stored. `planSteps` returns them with `inventoryKey`, a short hash of the inventory's library tools and capabilities; the project response carries both (#52).

## apps/api

### Routes

| Route | Purpose |
|---|---|
| `GET /api/health` | Deploy and uptime check; no session, no data |
| `POST /api/login`, `POST /api/logout`, `GET /api/session` | Login and session (0007) |
| `GET /api/templates` | Templates with their current version and name |
| `GET/PUT /api/tools` | Tool inventory: library tools with their capabilities, and other tools by name; `PUT` replaces the whole list |
| `GET /api/projects`, `POST /api/projects` | List (summaries, no snapshots) and create. Each summary carries `progress`: shopping lines bought, steps done, and the next step, counted by core's `progressSummary` from the stored plan and its ticks (#61), for the Resume card |
| `POST /api/projects/preview` | Dry run for the new-project screen (#98): takes the create body (name and status optional), generates the snapshot with the template's current version, and returns it with no changed paths, since there is nothing saved to compare with. Saves nothing; 422 with core's issues and 400 for an unknown template, like create |
| `GET /api/projects/:id` | The stored snapshot (upgraded to the current shape if needed, 0014), plus a version report: `current`, `ahead`, or `behind` with the outputs regenerating would store and what it would change, as paths in the template's `plan` that the edit preview also uses (or the issues that stop it), the plan's drawings, drawn by core from the stored snapshot on each read (#91), its build steps, with methods chosen from the current tool inventory and that inventory's key (`inventoryKey`), so the shop view needs no other request and a stale step list can be detected (#52), and its `ticks` and `progress` (#61) |
| `PUT /api/projects/:id` | Update name, status, parameters, or structural inputs; changing parameters or inputs regenerates the snapshot with the current template version, and the response's `progressReset` lists the ticks that cleared (#57) |
| `POST /api/projects/:id/preview` | Dry run for the edit screen (#56): takes the same body as `PUT`, generates the snapshot with the current template version, and returns it with the changed paths against the stored snapshot. Saves nothing; 422 with core's issues like `PUT` |
| `POST /api/projects/:id/regenerate` | Regenerate with the current template version (explicit, never automatic); `progressReset` as for `PUT` |
| `GET /api/projects/:id/progress` | What has been ticked off (#57): `ticks`, each with its kind, key, and the time the server saved it |
| `PATCH /api/projects/:id/progress` | Set and clear ticks: `{ changes: [{ kind, key, done }] }`. Safe to send again: ticking a done item keeps its first time, and clearing one that is not done does nothing, so a client can retry writes queued through a dropped connection. A tick on an item the stored plan lacks is refused with 422 `unknown-progress`, naming the items, and nothing in the request is saved. Answers `ticks` and `status`: status follows progress (#61), moving a Planned project to In progress at its first tick and to Built when a write finishes the last step; it never moves back, and can still be set by hand |
| `DELETE /api/projects/:id` | Delete a project and its history and progress rows, permanently (204) |

Errors are JSON with an `error` code: 400 for a malformed request (with `issues` and their paths), 401 without a session, 404 for a missing project, 415 for a state-changing request that is not JSON, 422 when core rejects the parameters or inputs (with core's `issues`), 429 when login is rate limited, and 500 `internal` for anything unexpected, which is logged. A malformed JSON body is a 400 `invalid-request`, and an unknown route with a session is a 404 `not-found`. A stored project whose progress cannot be counted is listed with `progress: null` rather than failing the list. Routes call services in `services/`, the only code that touches the database. The project routes' request bodies are in `services/projectBodies.ts`, and history rows, including the release backfill, in `services/history.ts`.

### Login (0007)

- `PASSWORD_HASH` holds `scrypt:N:r:p:salt:hash` (base64url), made by `pnpm --filter @kerf/api hash-password` with N = 2^17, r = 8, p = 1. Verification reads the cost from the stored hash and compares in constant time.
- The session cookie `kerf_session` holds a random 256-bit token; `sessions` stores only its SHA-256 hash, so the table alone gives no working session. Sessions last 30 days. Expired rows are deleted at the next login.
- Rate limiting counts failed logins for the whole app in fixed 15-minute windows, at most 10 per window, then answers 429 with `Retry-After`, even for the right password. Each attempt is counted before the password is checked and taken back on success, so parallel guesses cannot slip under the limit. The limit is global rather than per address: there is one user, and a per-address limit lets anyone with many addresses keep guessing. The cost is that someone guessing can keep the owner locked out; changing that is a new decision.
- One middleware requires a session on every route except `GET /api/health` and `POST /api/login`, listed by method and path. A test walks every route the app registers and checks each answers 401 without a session.
- `POST`, `PUT`, `PATCH`, and `DELETE` requests must have a JSON content type (415 otherwise).

### Data (sketch)

| Table | Contents |
|---|---|
| `tools` | Library tool type ID and the capabilities entered. Rows from before the library are read through core's `readStoredTools`, which moves what the library lacks to `other_tools`; they are rewritten when the owner next saves the inventory |
| `other_tools` | Tools the library does not have: position, name, note |
| `projects` | Name, status, template ID, template version, snapshot (JSON, holding the parameters and structural inputs), timestamps |
| `project_history` | One row per operation in a project: operation ID and type, the method chosen (null when the inventory supported none), its skills, and the key of the inventory it was chosen from. Replaced in the same transaction whenever a snapshot is saved (create, a parameter or input change, regenerate), not on a rename or status change. A unique index on `(project_id, operation_id)` keeps it to one row per operation. The release step writes rows for projects that have none and keeps rows that exist (#106). Used later for references to past projects |
| `project_progress` | One row per item ticked off in a project (#57): kind (`shopping-line`, `board`, `part`, `step`), key, and when it was done. Keys come from core's `progress/`: a lumber line by nominal size and length, a hardware line by its description, a board by its ID in the board plan (`boardIds`: line and which board of that line, so boards of other sizes do not shift it), a part's piece by part ID and instance, a step by its ID. When a snapshot is saved, rows whose item is gone or has other numbers are deleted in the same transaction (`progressToReset`). A piece's numbers include its part's cut detail, and a step's the cut details of its parts, so moved holes clear a tick even when the cut list does not change |
| `sessions` | Session ID, created, expires |
| `login_attempts` | Time window and failure count for rate limiting |

Snapshots are stored, not regenerated on every read. A project's plan therefore never changes underneath it when the template changes; the API reports the difference and regeneration is the owner's choice. Snapshots are parsed with their Zod schema when read back.

### Deploying (0006)

- `vercel.json` defines two services in one Vercel project: the web build at `/` and the API at `/api/*`, entered through `apps/api/src/vercel.ts`. The API's routes already start with `/api`, so the same paths work in development and production.
- The API connects to Neon's pooled connection string with prepared statements off (`POOLED_CONNECTION` in `bootstrap.ts`).
- Secrets live only in Vercel's environment settings and a local `.env`: `DATABASE_URL` and `PASSWORD_HASH` (see `.env.example`). The API refuses to start if either is missing or malformed, naming the variable but never printing its value.
- Every production build runs `pnpm db:migrate` for the API service (`vercel.json`), while the previous deploy is still serving: a read-only check that the new code reads every stored snapshot, the Drizzle migrations, then the history backfill, all under an advisory lock (0014). It does not rewrite stored data into a newer shape. It connects through `DATABASE_URL_UNPOOLED` (Neon's direct connection) when set. Preview builds skip it. Locally, `pnpm db:migrate` does the same against `.env` or the Docker database.
- Changing the password: run `pnpm --filter @kerf/api hash-password`, set the new `PASSWORD_HASH` in Vercel, redeploy, and delete the rows in `sessions` (0007).

#### Backups (manual, for now)

There are no scheduled backups. Neon's free plan restores only the last 6 hours, and the owner chose to take a dump by hand when it seems worth it (October 2026, #21, where the options are recorded). The dump keeps the structure of `sessions` and `login_attempts` but not their rows, so no live session token is written to a file.

1. Install the Postgres client once: `brew install libpq`, then use `/opt/homebrew/opt/libpq/bin/pg_dump`. Its version must be 18 or later (`pg_dump --version`).
2. Copy the direct connection string (host without `-pooler`) from the Neon console, and read it into the shell without echo: `read -rs NEON_URL`.
3. Dump, to a folder outside the repository:

   ```
   pg_dump "$NEON_URL" -Fc --no-owner --no-acl \
     --exclude-table-data=sessions --exclude-table-data=login_attempts \
     -f ~/Backups/kerf-$(date +%F).dump
   ```

4. Check a dump by restoring it into the local Docker database. This replaces the local development data: `pg_restore -d postgres://kerf:kerf@localhost:5432/kerf --clean --if-exists --no-owner ~/Backups/kerf-<date>.dump`
5. To restore production, run the same `pg_restore` against `"$NEON_URL"`. Every session is gone afterwards, so log in again. If the mistake happened within the last 6 hours, Neon's own restore in the console is simpler.

Checked October 30, 2026 with `pg_dump` 18.6: a dump and restore into an empty database brought back every row of the other tables, plus the Drizzle migration history, and left `sessions` and `login_attempts` empty.

#### First deploy (the owner's steps; they need accounts)

1. **Neon:** a free project on Postgres 18 in AWS `us-east-1`, near Vercel's default function region. Copy the pooled connection string (host ends in `-pooler`) and the direct one.
2. **Password hash:** in a terminal, `pnpm --filter @kerf/api hash-password`; copy the printed `scrypt:...` value.
3. **Vercel:** on the Hobby plan, import the GitHub repository with the repository root as the root directory, so `vercel.json` applies. Node.js version 24.x.
4. **Environment variables, Production only, marked Sensitive:** `DATABASE_URL` (pooled), `DATABASE_URL_UNPOOLED` (direct), `PASSWORD_HASH`. Preview deployments get none, so they cannot reach the production database; their API does not start.
5. **Deploy** `main`. The API's build log shows `release: migrations applied.`
6. **Check:** `pnpm --filter @kerf/api check-deploy https://<project>.vercel.app` asks for the password without echo, then checks health, login, storing and reading a project, and logout. It leaves one project named "Deploy check".

## apps/web

- Talks only to `/api/*` on its own origin, through the Hono typed client (`src/lib/api.ts`). One function, `send`, turns responses into results the UI shows; a 401 sends the owner to the login screen.
- Screens are chosen from the URL hash (`#/projects`, `#/projects/<id>`, `#/projects/<id>/<section>`, `#/projects/<id>/edit`, `#/projects/new?template=<id>`, `#/tools`, `#/glossary` and `#/glossary/<term>`, and `#/catalog` for the design system's catalog), so links, reload, and back work without a router library.
- The plan is one section per screen (#156): the summary at `#/projects/<id>`, and each other section of order A at `#/projects/<id>/<section>` (`diagrams`, `structural-review`, `cut-list`, `boards`, `shopping-list`, `build-steps`, `parameters`; `lib/sections.ts`). No section may be `edit`, `shop`, or `build`. A move between sections adds a history entry. The part selected in the drawings and the cut list is in the address (`…/cut-list?part=<id>`), and selecting one replaces the entry. Edit carries the section it was opened from (`…/edit?from=cut-list`), and Save and Cancel return there.
- Shopping and Building (#61) are full-screen modes launched from cards in the plan's summary, under a bar with the mode's name and Exit and no other navigation: `#/projects/<id>/shop`, `#/projects/<id>/build` (opens the next step not done), `…/build/<step>`, `…/build/<step>/<part>` (the piece's cut card), and `…/build/steps`. A mode changes progress only, never the plan. The projects list puts a Resume card above an in-progress project, going to its next step or, before building starts, the shopping list.
- While a mode is open it holds a screen wake lock (`lib/wakeLock.ts`, #54), asked for again each time the page is shown, since the browser releases it when the page is hidden. Where the browser has no wake lock or refuses one, the screen sleeps as usual and nothing is said.
- Shopping's checklist (#59) lists lumber, then each hardware group the template names, each with its count. Each lumber line opens its board cards: every board of that size and length, drawn by core with its pieces and offcut, and what to look for when choosing them (#53). Every template's drawings include the board drawings (`projectDrawings`), since every plan has a board plan.
- Building mode's step screen (#118) is shop density: where you are, the step's title, then for a cutting step its board's pieces in cutting order, each length at glance size with a tick and a cut card, and the methods and flags. The cut card has the length largest, each end cut as the boxed saw setting with the angle to the board's edge (from the plan's operations through core's formatters), the marks, a tick per piece, and the cut detail. From 600 px of width (the 8-column page grid, #41) the step or card sits beside its drawing; narrower, a step's drawing comes after its pieces (or its title) and before its methods (`StepLayout`, #134): the board for a cutting step, the action drawing for an assembly step, the site layout for site work, the cut detail for a card.
- Ticks go through one in-memory queue per project (`lib/ticks.ts`, #57): sent at once, counted as done while waiting, marked "not yet sent" until the server answers, and sent again after a failure with a growing wait (2 s doubling to 30 s) and when the browser comes back online. A tick the server refuses because the plan no longer has the item is dropped and said. Nothing is kept in browser storage (0005), so a reload or closing the tab while ticks wait asks first. Data is loaded per screen with plain `fetch` through the client; there is no client-side cache library. The one exception is the last project the API returned, kept in memory (`lib/projectStore.ts`): the plan and the modes show it at once, refresh it in the background, and keep showing it when the refresh fails, so moving between them needs no round trip and survives a dropped connection. A save stores the saved project and a delete forgets it. The plan, drawings and build steps are parsed once per response (`useReadProject`).
- Uses core's parameter schemas to show validation before submitting; the API validates again.
- The new-project screen (#98, #163) offers its starts above the form: an empty form, each worked example, "Answer a few questions" when the template has starting questions (`?questions`), and each earlier project. The questions start asks first, then opens the form filled with the suggestions; each field says where its value came from until it is changed, and "Change your answers" goes back with the answers kept.
- The edit screen shows the project's output beside the form (#39, L-A). A moment after typing stops, it asks the preview route for the snapshot the form would produce, labels it "Preview, not saved", and marks each changed value with the saved one, from the paths the route returns. While a newer preview is pending, the one on screen stays, labeled "Earlier values, not saved", and the status says its numbers are for the values before the latest change.
- The plan screen (#119, #156) has the sections of order A, one on screen at a time, with the contents beside it (a bar that opens them on a phone) and Previous and Next at the end: a summary (the template's key results from `Plan.keyResults`, the lowest margin from core's `structural.lowestMargin`, the Shopping and Building cards, the flags, and each other section with a one-line digest from core's `planDigests`, counted from the stored plan on read), diagrams, structural review, cut list, boards, shopping list, build steps, and parameters and inputs read back through core's `enteredValues`. The other sections stay in the page, hidden, so Print, which calls the browser's print, gives the whole plan in order A from any section. After a move, focus goes to the section's heading, and the page title names the section and project. Every other change of screen, including a mode's steps and cards, scrolls to the top, focuses the new screen's `h1`, and sets the page title from it (`lib/screenChange.ts`).
- Uses core's display helpers for every length and angle so all views round the same way. A project's outputs are parsed with the template's `storedOutputs` and read through its `plan`, so screens know no template.
- **The design system lives in `src/ui`** (`docs/design/README.md`, Stage 6; usage in `docs/design/system.md`).
  - **Styles:** plain CSS in cascade layers, in the order `reset, tokens, base, layout, components, print`. Tokens are custom properties; colors are `light-dark()` pairs that follow the device, or the Theme menu's choice for this device, kept in browser storage (0005, #155).
  - **Fonts:** Atkinson Hyperlegible Next and Mono, self-hosted (decision 0015).
  - **Brand:** the `Wordmark` component and the files in `public/` (icons, social preview image) are made from the font by `docs/design/brand/make_brand.py` (#166, `docs/design/brand.md`).
  - **Screens:** built only from `ui/` components and layout primitives. They write no `className` or `style` and import no stylesheet, which `ui/screens.test.ts` enforces. A screen that needs something new gets a new component in `ui/`, with tests and a place on the catalog page.
- Diagrams render core's 2D primitives, which the API sends with the project, as SVG through `Diagram` inside `DiagramFrame` (#91). Each primitive's role maps to the line and diagram tokens; strokes do not scale, and text, arrowheads, and part letters are sized in pixels for the width shown. Tapping a part selects it in the drawings and the cut list, whose part names are the keyboard path. The assembled and exploded views share one place on screen, switched with a control (`ViewSwitch`, #200), and both print. In print, each section of the plan starts a page with a title block, the isometric, exploded, and site views take landscape pages, cut details do not split, zones are hatched, and expandable working opens.
- Phone and tablet layouts are first-class: large text and one build step at a time (`PRODUCT.md`, MVP feature 9).

## Testing

| Area | What tests must cover |
|---|---|
| `units/` | Fraction rounding at every 1/32 boundary, feet-inches display, angle convention conversions |
| `templates/` | Hand-checked worked examples; fit tests (`DOMAIN.md`, Verification); validation of contradictory parameters; a version-bump test listing changed outputs; every template's examples parse with its strict `outputs` and read back unchanged (`contract.test.ts`); every stored fixture's plan fills in what generic code reads |
| `structural/` | Hand-checked worked examples for each check, including the symmetric hand-check cases and an asymmetric case; missing inputs produce "input needed" |
| `outputs/` | Board grouping including kerf and trim; nothing silently dropped when a part is longer than any buyable length |
| `knowledge/`, `design-values/` | Every entry parses; every reference resolves; every design value has a source |
| `apps/api` | Every route rejects requests without a session; login rate limiting; snapshot round trip through Postgres (PGlite, 0010) |
| `apps/web` | Forms, rendering of snapshots (rendered to a string), and effects, focus, dialogs, and address changes (in happy-dom, `*.dom.test.tsx`, 0017), and that displayed values use core's formatters; each component's states and accessible names; every recorded contrast ratio against the color tokens; no styles outside `ui/`; no template's ID or own words (`TemplateDefinition.ownWords`) in generic code, including the API's scripts (`generic.test.ts`); only the registry imports a template's folder (`templateFolders.test.ts`) |
