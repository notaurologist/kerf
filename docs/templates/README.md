# Writing a template

A template is a project type: a swing set today, a bookshelf or workbench later. It lives in `packages/core/src/templates/<template-id>/` as TypeScript (decision 0008) and gives generic code everything specific to that project type. This guide is the order to work in and the rules at each step. The code it points to is the source of truth for the contract; read it alongside.

Three templates follow it: the swing set (`templates/swing-set-a-frame/`, spec `swing-set-a-frame.md`), a frame of dimension lumber; the record cabinet (`templates/record-cabinet/`, spec `record-cabinet.md`), a case of edge-glued panels with dadoes; and the workbench (`templates/workbench/`, spec `workbench.md`), strip glue-ups, mortise and tenon, dovetailed drawers, and bought hardware whose figures the owner enters. Where the swing set does something only a swing set needs, the guide says so.

## 1. Agree the scope

- The template is one of `PRODUCT.md`'s after-MVP candidates, or the owner has approved it (hard rule 13). One issue, one branch.
- List what it needs that generic code may not have yet, such as sheet goods in the shopping list, a member that is not a beam on two supports, or a joint `packages/core/src/joints/` lacks. Each gap is its own issue, decided before the template depends on it. A template does not work around generic code by computing a generic thing itself.

## 2. Write the spec first

`docs/templates/<template-id>.md`, before any code, reviewed by the owner (hard rules 5 and 9). Follow the swing-set spec's headings:

- **Design covered**: what the template builds, what it leaves out, and the variants it does not cover.
- **Coordinates**: the origin and axes the geometry uses.
- **Parameters**: each with its unit, range, and why that range. Every number in the parameter schema has a minimum and a maximum, so no entry can ask for any number of parts or boards, or a size the display cannot show (#421).
- **Derived geometry**: every length, angle, and position as a formula from the parameters, in the miter-saw convention (`DOMAIN.md`, Units). The template computes only the positions and joint sizes; the lengths, end cuts, and grips are there to check the joints by hand.
- **Joints**: each part, where it stands, and how it joins its neighbors, with each joint's kind and size (decision 0020). Name the joints from `packages/core/src/joints/`, and mark one core lacks with the issue that adds it. Features with no partner part, such as a taper or a dog hole, are listed as the template's own. The workbench's "Parts and their joints" lists each part this way; the swing set's and record cabinet's specs describe theirs under "Joints".
- **Hardware, operations, build steps, drawings**: what the template generates for each.
- **Validation and flags**: combinations it refuses, and what it flags for an expert check (`DOMAIN.md`, Expert-check categories).
- **Worked examples, hand-checked**: at least one ordinary example and one at the edge of the range, worked through by hand to the numbers the tests will assert.
- **Structural model**: members, supports, loads, load cases, and which checks are computed and which stay on the checklist (`DOMAIN.md`, Structural checks). Every design value and safety-relevant claim names its source and edition (hard rule 5); loads, species and grade, deflection limit, and hardware ratings are inputs the owner enters, never defaults (hard rule 3).

## 3. Write the code to the contract

The contract is `TemplateDefinition` in `packages/core/src/model/definition.ts`. Each field's comment says what it is for. In short:

| Field | What it holds |
|---|---|
| `id`, `name`, `version` | The ID used in URLs and stored projects; the name the owner sees; the template version (step 5) |
| `ownWords` | Words that name what this template builds and no other template uses, such as its parts, lowercase, each plural listed. Generic members such as a leg or a beam do not belong. Generic code and other templates' folders may not use them (step 6) |
| `params`, `structuralInputs` | Zod schemas. Every structural input is optional: missing means "input needed" |
| `storedParams`, `suggestMissing` | How stored parameters are read after upgrades: `params` with each parameter older shapes lack made optional. A template with one shape of parameters uses `params`. `suggestMissing` suggests a value, with its basis, for each parameter or input an older plan lacks; the editor and a regeneration fill only the missing ones (step 5) |
| `form` | How parameters and structural inputs are entered, as data (`model/form.ts`). Fields start empty; hardware is `confirmed` |
| `checkFields` | The fields in the form each structural check changes with: the member's size and span, what loads it, and the structural inputs it reads. The review links each from its check (#448); `templates/checkFields.test.ts` checks every one names a field the form has |
| `generate` | Pure: parameters and inputs to outputs, or issues. No clock, randomness, or I/O |
| `outputs`, `storedOutputs` | What `generate` makes now, every field generic code reads required; and what a stored snapshot holds after upgrades. A template with one snapshot shape uses `outputs` for both |
| `plan` | Outputs in the shape every display shares (`outputs/plan.ts`). Picks values out and fills in what an older snapshot lacks; never computes |
| `drawings`, `assembly`, `steps` | Made from stored outputs on each read, not stored: the template's drawings, the 3D scene and how parts pull apart, and the order of build steps |
| `examples` | The worked examples from the spec. One with `start` is offered as a new project's starting point, with its parameters only |
| `snapshotVersion`, `snapshotUpgrades` | The stored shape, and how each older shape becomes the next (step 5) |
| `questions` | Optional starting questions (`model/questions.ts`) that suggest parameters, never hardware, with `examples`: answer sets that reach the suggestions' notes, for the contract test. A structural input is suggested only from the owner's answers or a cited source, for the owner to check |

### Place the parts and declare their joints

A template does not work out a part's length, end cuts, or the features a joint cuts into it (decision 0020). It places each part uncut, as a `Member` (`joints/trim.ts`): its frame, its stock's width, and which way it runs. Then it declares the joints between parts with their sizes, and takes the rest from them:

| Joint (`packages/core/src/joints/`) | Gives |
|---|---|
| `trim` | A part cut to a plane at each end: its length, end cuts, and origin |
| `boltedLap` | Each part's hole along a bolt's line, and the bolt's grip |
| `housedEnd`, `housingPlane` | The dado an end goes into, the notch a stopped dado leaves, and the plane the housed part is trimmed to |
| `mortiseAndTenon`, `throughTenon`, `tenonInGroove` | A tenon and the mortise or groove it fits |
| `floatingPanel`, `panelInFaces` | A panel's grooves, its size and place in them, and its tongues |
| `slottedScrews` | Screw holes, round where the part is held and slotted the way it moves |
| `throughDovetails` | A corner's tails and pins |

Where a part's stock depends on its length, as a glued-up panel's does, size it after the joints give the length. A joint refuses parts that don't meet as it needs, with a message. The workbench returns that message as the plan's refusal; the swing set and record cabinet refuse such parameters in validation first, and throw if a joint still refuses. Either way `generate` never throws for parameters the schemas accept, which the sweep checks. Every instance of a part shares one cut-list line, so each must come out of its joints with the same features; the workbench checks this with `compare` as it builds (`workbench/design.ts`). The swing set's and record cabinet's joints are in `joints.ts` in their folders, the workbench's in `design.ts`.

What stays the template's: where each part stands and the closing formulas behind it, each joint's size, features with no partner part (the swing set's flush cut, the cabinet's tapers, door tracks, and finger recesses, the workbench's dog holes), hardware, the structural model, and wording. A joint the template needs that core lacks is a generic change: add it to `joints/` first, in its own pull request, with hand-checked tests and a mutation test.

### Use what generic code makes

Generic code already makes the cut list, shopping list, hardware list, operations, structural checks, drawings, and build steps from what `generate` returns. Use it: `cutList`, `hardwareList`, and `planLumber` from `outputs/`, `withLetters` from `model/letters.ts`, the structural checks from `structural/`, and the view functions from `geometry/`. The swing set's `definition.ts` and `template.ts` show how they fit together.

Register the template in `templates/index.ts`: add its definition to `TEMPLATES`, and export its folder's `index.ts` as a namespace beside the swing set's, for tests that need its definition by name. Nothing else imports from its folder (`apps/web/src/templateFolders.test.ts`).

## 4. Test it

| Test | Where | What it checks |
|---|---|---|
| Worked examples | the template's folder, like `swing-set-a-frame/template.test.ts` | Every number in the spec's hand-checked examples |
| Fit | `templates/contract.test.ts` (runs for every registered template), and the template's folder, like `placements.test.ts` | Every worked example passes the generic fit checks (`fit/`): each joint's two sides agree, no two parts overlap, and no through hole runs into another part. The template's own tests check the parts meet where the spec says they do (`DOMAIN.md`, Verification) |
| Sweep | the template's folder, `sweep.ts` and `sweep.test.ts` (`templates/sweep.ts`, listed in `SWEEPS` in `templates/index.ts`) | Parameters drawn across the schema's ranges each make a plan that reads back and passes the fit checks, or are refused with issues; the test asserts how many draws make plans, and that each draw generates what `sweeps/v<version>.json` records |
| Structural | the template's folder, like `structural.test.ts` | Each computed check against the hand-checked working, and "input needed" when an input is missing |
| Contract | `templates/contract.test.ts` (runs for every registered template) | Each example's outputs parse with `outputs` and read back unchanged through `storedOutputs` and `readSnapshot`; each example's parameters and structural inputs, built from the form as the editor builds them (hidden fields left out), parse with `params` and `structuralInputs`, so a value only a hidden field holds must be optional (#501); `ownWords` is set; no verdict words or brands in the outputs, plan, build steps, form, starting questions and what they suggest for `questions.examples`, or store readings (hard rules 2 and 11) |
| Random parameters | `templates/properties.test.ts` (runs for every registered template) | Every number in `params` has a range; random values inside the schemas either generate or return issues, within a time budget, and never throw (#421) |
| Snapshot fixtures | `templates/contract.test.ts` (finds every template's `snapshots/v*.json`, `shown/v*.json`, and `sweeps/v*.json`), `apps/api/scripts/snapshot-fixtures.test.ts`, and the template's `snapshots.test.ts` for what its own upgrades keep | Step 5 |
| Generic code | `apps/web/src/generic.test.ts`, `templateFolders.test.ts`, `generation.test.ts` | Step 6 |

Copy each from the swing set and change what is specific. The contract and generic-code tests pick a new template up from `TEMPLATES` without changes.

## 5. Versions, shapes, and fixtures

Two numbers move independently (decisions 0008 and 0014):

- **`version`** goes up whenever output for the same parameters changes, a number or anything else stored with it, such as a label or a source. Stored projects keep the version they were made with; the plan screen offers to regenerate.
- **`snapshotVersion`** goes up whenever the shape of the stored snapshot changes: a field added, removed, renamed, or restructured. Add an upgrade from the previous shape to `snapshotUpgrades`; it restructures only and never recomputes, so an old plan keeps its numbers. It writes no parameter or structural input the plan did not hold: a new parameter stays missing, `storedParams` makes it optional, and `suggestMissing` suggests it when the owner edits or regenerates (#429). A rename, or a fact true of every plan of the older shape (such as having no doors), is listed in the template's `upgrade-writes.json`, which `contract.test.ts` checks every upgrade against.

Every template version has a fixture: `snapshots/v<version>.json`, its worked examples as stored. After setting or bumping the version, write it with `pnpm --filter @kerf/api write-snapshot-fixture <template-id>`. The script also writes `shown/v<version>.json`, what the worked examples show when read (`shownOnRead`: the plan, the build steps with no tools and with a small shop's, and each drawing's dimension text), runs the template's sweep and writes `sweeps/v<version>.json`, a hash of what each draw generates, removes the previous version's copies of both, and records the hash of all three new files in `apps/api/scripts/snapshot-fixture-hashes.json`. It refuses a version that already has a hash there. `contract.test.ts` reads every fixture it finds: one per version and per shape, an upgrade between shapes, every fixture readable with its template version kept, the current one read back exactly, regenerated exactly, and shown exactly as `shown/v<version>.json` says. The template's `sweep.test.ts` checks each sweep draw against `sweeps/v<version>.json`, so output the worked examples do not reach is pinned too. `snapshot-fixtures.test.ts` checks every file's hash, the current version's included. A fixture is never rewritten. The `shown/` files are left out of Biome: the record cabinet's is over its 1 MB limit, most of it method text in build steps. A new template starts at version 1 and shape 1 with one fixture, `v1.json`. Each later version also gets a test in the template's `versions.test.ts` saying what it changed.

## 6. Keep generic code generic

Only the template's folder may know it exists (ARCHITECTURE.md, principle 6). Rules for one kind of project, such as the CPSC playground guidance the swing set follows, live in the folder and reach generic code as data: a note to show with a list, which fittings a bolt takes, a flag's category. Three tests hold the line:

- `generic.test.ts` fails when source outside the template's folder, other than tests, uses its ID or one of its `ownWords`, as a word or inside an identifier (`crossbarSpan`, `swing_angle`). It also fails when another template's folder, tests included, uses them.
- `templateFolders.test.ts` fails when anything but `templates/index.ts` imports from the folder.
- `generation.test.ts` fails when the web app calls generation code instead of displaying what the API sends.

When the template needs something generic code does not do, open an issue for the generic change and land it first, in its own pull request. Note anything the design system does not cover, too (#71).

## 7. Finish

- `PRODUCT.md`: move the template from the candidates to what Kerf offers. A template the owner chose that was never a candidate, as the record cabinet was (#99), gets its own section naming it, why it was chosen, what it covers in a few sentences, and a pointer to its spec.
- The catalog sample (`pnpm --filter @kerf/api write-catalog-sample`) uses the first template only; nothing to do unless the new one is first.
