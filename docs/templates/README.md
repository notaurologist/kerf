# Writing a template

A template is a project type: a swing set today, a bookshelf or workbench later. It lives in `packages/core/src/templates/<template-id>/` as TypeScript (decision 0008) and gives generic code everything specific to that project type. This guide is the order to work in and the rules at each step. The code it points to is the source of truth for the contract; read it alongside.

The swing set (`templates/swing-set-a-frame/`, spec `swing-set-a-frame.md`) is the only example so far. Where it does something only a swing set needs, the guide says so.

## 1. Agree the scope

- The template is one of `PRODUCT.md`'s after-MVP candidates, or the owner has approved it (hard rule 13). One issue, one branch.
- List what it needs that generic code may not have yet, such as sheet goods in the shopping list, a member that is not a beam on two supports, or joinery other than bolts. Each gap is its own issue, decided before the template depends on it. A template does not work around generic code by computing a generic thing itself.

## 2. Write the spec first

`docs/templates/<template-id>.md`, before any code, reviewed by the owner (hard rules 5 and 9). Follow the swing-set spec's headings:

- **Design covered**: what the template builds, what it leaves out, and the variants it does not cover.
- **Coordinates**: the origin and axes the geometry uses.
- **Parameters**: each with its unit, range, and why that range.
- **Derived geometry**: every length, angle, and position as a formula from the parameters, in the miter-saw convention (`DOMAIN.md`, Units).
- **Hardware, operations, build steps, drawings**: what the template generates for each.
- **Validation and flags**: combinations it refuses, and what it flags for an expert check (`DOMAIN.md`, Expert-check categories).
- **Worked examples, hand-checked**: at least one ordinary example and one at the edge of the range, worked through by hand to the numbers the tests will assert.
- **Structural model**: members, supports, loads, load cases, and which checks are computed and which stay on the checklist (`DOMAIN.md`, Structural checks). Every design value and safety-relevant claim names its source and edition (hard rule 5); loads, species and grade, deflection limit, and hardware ratings are inputs the owner enters, never defaults (hard rule 3).

## 3. Write the code to the contract

The contract is `TemplateDefinition` in `packages/core/src/model/definition.ts`. Each field's comment says what it is for. In short:

| Field | What it holds |
|---|---|
| `id`, `name`, `version` | The ID used in URLs and stored projects; the name the owner sees; the template version (step 5) |
| `ownWords` | Words only this folder uses, such as the names of its parts, lowercase. Generic code may not use them (step 6) |
| `params`, `structuralInputs` | Zod schemas. Every structural input is optional: missing means "input needed" |
| `form` | How parameters and structural inputs are entered, as data (`model/form.ts`). Fields start empty; hardware is `confirmed` |
| `generate` | Pure: parameters and inputs to outputs, or issues. No clock, randomness, or I/O |
| `outputs`, `storedOutputs` | What `generate` makes now, every field generic code reads required; and what a stored snapshot holds after upgrades. A template with one snapshot shape uses `outputs` for both |
| `plan` | Outputs in the shape every display shares (`outputs/plan.ts`). Picks values out and fills in what an older snapshot lacks; never computes |
| `drawings`, `assembly`, `steps` | Made from stored outputs on each read, not stored: the template's drawings, the 3D scene and how parts pull apart, and the order of build steps |
| `examples` | The worked examples from the spec. One with `start` is offered as a new project's starting point, with its parameters only |
| `snapshotVersion`, `snapshotUpgrades` | The stored shape, and how each older shape becomes the next (step 5) |
| `questions` | Optional starting questions (`model/questions.ts`) that suggest parameters, never hardware or structural inputs |

Generic code already makes the cut list, shopping list, hardware list, operations, structural checks, drawings, and build steps from what `generate` returns. Use it: `cutList`, `hardwareList`, and `planLumber` from `outputs/`, `withLetters` from `model/letters.ts`, the structural checks from `structural/`, and the view functions from `geometry/`. The swing set's `definition.ts` and `template.ts` show how they fit together.

Register the template in `templates/index.ts`: add its definition to `TEMPLATES`, and export its folder's `index.ts` as a namespace beside the swing set's, for tests that need its definition by name. Nothing else imports from its folder (`apps/web/src/templateFolders.test.ts`).

## 4. Test it

| Test | Where | What it checks |
|---|---|---|
| Worked examples | the template's folder, like `swing-set-a-frame/template.test.ts` | Every number in the spec's hand-checked examples |
| Fit | the template's folder, like `placements.test.ts` | The parts meet where the spec says they do (`DOMAIN.md`, Verification) |
| Structural | the template's folder, like `structural.test.ts` | Each computed check against the hand-checked working, and "input needed" when an input is missing |
| Contract | `templates/contract.test.ts` (runs for every registered template) | Each example's outputs parse with `outputs` and read back unchanged through `storedOutputs` and `readSnapshot`; `ownWords` is set |
| Snapshot fixtures | the template's `snapshots.test.ts`, and `apps/api/scripts/snapshot-fixtures.test.ts` | Step 5 |
| Generic code | `apps/web/src/generic.test.ts`, `templateFolders.test.ts`, `generation.test.ts` | Step 6 |

Copy each from the swing set and change what is specific. The contract and generic-code tests pick a new template up from `TEMPLATES` without changes.

## 5. Versions, shapes, and fixtures

Two numbers move independently (decisions 0008 and 0014):

- **`version`** goes up whenever output for the same parameters changes, a number or anything else stored with it, such as a label or a source. Stored projects keep the version they were made with; the plan screen offers to regenerate.
- **`snapshotVersion`** goes up whenever the shape of the stored snapshot changes: a field added, removed, renamed, or restructured. Add an upgrade from the previous shape to `snapshotUpgrades`; it restructures only and never recomputes, so an old plan keeps its numbers.

Every template version has a fixture: `snapshots/v<version>.json`, its worked examples as stored. After setting or bumping the version, write it with `pnpm --filter @kerf/api write-snapshot-fixture <template-id>`, import it in the template's `snapshots.test.ts`, and pin the previous version's fixture by its hash in `apps/api/scripts/snapshot-fixtures.test.ts`. A fixture is never rewritten. A new template starts at version 1 and shape 1 with one fixture, `v1.json`. Each later version also gets a test in the template's `versions.test.ts` saying what it changed.

## 6. Keep generic code generic

Only the template's folder may know it exists (ARCHITECTURE.md, principle 6). Rules for one kind of project, such as the CPSC playground guidance the swing set follows, live in the folder and reach generic code as data: a note to show with a list, which fittings a bolt takes, a flag's category. Three tests hold the line:

- `generic.test.ts` fails when source outside the template's folder, other than tests, uses its ID (in either spelling) or one of its `ownWords`.
- `templateFolders.test.ts` fails when anything but `templates/index.ts` imports from the folder.
- `generation.test.ts` fails when the web app calls generation code instead of displaying what the API sends.

When the template needs something generic code does not do, open an issue for the generic change and land it first, in its own pull request. Note anything the design system does not cover, too (#71).

## 7. Finish

- `PRODUCT.md`: move the template from the candidates to what Kerf offers.
- The catalog sample (`pnpm --filter @kerf/api write-catalog-sample`) uses the first template only; nothing to do unless the new one is first.
