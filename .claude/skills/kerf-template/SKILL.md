---
name: kerf-template
description: Walks a session through starting a new Kerf template or extending an existing one (a new parameter, part, operation, or any change to a template's output), from scope and spec through code, tests, versions, fixtures, and docs, with a stop for the owner at each step that needs one. Use when asked to add, build, spec, or change a template in packages/core/src/templates/, or to bump a template's version.
---

# Starting or extending a Kerf template

`docs/templates/README.md` is the contract: what each `TemplateDefinition` field holds, the tests, the version and fixture rules, and what generic code provides. This skill does not repeat it. It is the order to work in, where to stop for the owner, and what went wrong when the record cabinet was built by hand (#273, #291 to #323). Read the README section each step names before doing that step.

Read `AGENTS.md`, `docs/PRODUCT.md`, `docs/DOMAIN.md`, `docs/ARCHITECTURE.md`, and both template specs (`docs/templates/swing-set-a-frame.md`, `docs/templates/record-cabinet.md`) first.

Extending a template follows the same steps, smaller: an issue, the spec changed first, then code, tests, a version bump, and docs. Most of the record cabinet's later work (#317, #319, #320) was extension.

## The owner's standing preferences

These shape every step. Check them before proposing a design.

- **Beginners, minimal input** (owner, November 1, 2026). Every parameter should start from a suggested value with a labeled basis: `answer`, `source`, `convention`, `example`, or `rule-of-thumb` (`packages/core/src/model/questions.ts`). The owner can always enter an exact value.
- **Only structural inputs stay owner-entered** (hard rule 3): species and grade, loads, deflection limit, and hardware sizes and ratings. Everything else gets a suggestion.
- **Say when a rule works against the owner.** If a hard rule or recorded decision forces input the owner shouldn't need, or blocks a suggestion, tell the owner and propose changing it. Don't work around it in code, and don't change it without asking.

## 1. Scope

README section 1.

- Confirm the template is in `PRODUCT.md`'s after-MVP candidates or that the owner approved it (hard rule 13). The record cabinet was not a candidate; the owner chose it on #99.
- One issue for the spec, one for the build. Branch from `main` for each.
- List what the template needs that generic code lacks. For the record cabinet that was edge-glued panels (#278, #297), wood movement (#284), long-term shelf deflection (#288), and dado, notch, and cutout operations (#300). Each became its own issue and pull request and landed before the template. Don't compute a generic thing inside the template folder to avoid waiting.

**Stop for the owner:** the template choice if it isn't a candidate, and each generic gap that needs a design decision. Label those issues `decision`.

## 2. Spec first

README section 2. Write `docs/templates/<id>.md` with no code.

- Follow the swing-set spec's headings. Give each parameter its range with a reason, and its suggested value with a basis. The record cabinet's spec first had board stock, allowances, dado depth, and setback owner-entered with no suggestion, which the owner reversed after using the app (#317). Decide the suggestion here, not after the build.
- Work every worked example by hand, to the numbers the tests will assert, including the stock each part is cut from and that stock's thickness. The cabinet's hand check listed the back rails at the panel thickness though each is one board, not flattened, at the board's thickness. That went out in versions 1 and 2 and needed version 3 (#320).
- Include an edge-of-range example that hits a refusal.
- Use real sources for real things. While the cabinet was being scoped, the session gave the Sonos Five's size from memory and had it wrong; the spec pull request had to correct it (#291). Read the manufacturer's page and cite it with the date read.
- List open questions in the spec and record each decision with who made it and the date.

**Stop for the owner:** review of the spec, every open question, and the parameter ranges and suggestions, before any code. Open the spec as its own pull request (#291 was).

## 3. Sources

README section 2, Structural model; hard rules 3 and 5; `DOMAIN.md`, Sources.

- Every design value and safety-relevant claim names its source and edition, in the spec and in the data. Read the source itself before implementing a value from it.
- Where no published source exists, say so and label the value `rule-of-thumb` with the rule in a few words (the cabinet's dado depth and panel allowances, #317).
- Structural inputs are never defaulted. A worked example may carry illustrative structural inputs; label them illustrative in the spec.
- Every method safety note cites a source (`knowledge/methods.test.ts` fails otherwise).

**Stop for the owner:** a value with no source that the template would treat as a structural input, and any source that conflicts with a recorded decision.

## 4. Design review, then code

**Design review first.** Before writing the template, compare the spec with the design system (`docs/design/README.md`) and open an issue for every gap, as #306 did for #71: the cabinet needed elevations and a section (#302), notches and dadoes in drawings (#303), wood movement on screen (#304), and panels in the cut list (#305). Each landed before the template and blocked it.

**Stop for the owner:** design choices the review raises (#306 asked about the grain arrow and where board seams show).

Then the code, README section 3:

- Template knowledge only in `packages/core/src/templates/<id>/` (ARCHITECTURE principle 6). Words only this template uses go in `ownWords`.
- Register it in `templates/index.ts` only.
- Starting questions (`questions.ts`) suggest every parameter. Mark a form field `confirmed` only for inputs hard rule 3 covers: a worked-example start empties every `confirmed` field, which surprised the owner when it emptied board stock and allowances (#317).
- Operations need generic operation types and methods first. Each type needs at least two methods, method text holds no numbers of its own (use `{placeholders}` for values the operation has), and no text uses the content guide's ruled-out or verdict words (`knowledge/methods.test.ts`, `apps/web/src/copy.test.tsx`; hard rule 2).
- Version 1 and snapshot shape 1, with `snapshots/v1.json` (README section 5).

## 5. Tests

README section 4.

- Assert every number in the spec's worked examples, fit tests, structural working, and "input needed" with each input missing.
- Run a mutation test on each formula that matters, such as the shelf span (`b + t` to `b`), and confirm a test fails. Before mutating a file that has uncommitted edits, copy it aside and restore from the copy. Never undo a mutation with `git checkout -- <file>`; it throws away the uncommitted work too.
- `pnpm check` runs lint, typecheck, knip, and tests. Knip fails on an unused export, so export only what another module imports.
- Say in the pull request what wasn't checked. Every cabinet PR said "Not checked in the running app," because the dev server needs Postgres and logging in needs the owner's password.

### Versions and fixtures when extending

README section 5 and decisions 0008 and 0014. The mechanics that tripped sessions up:

- Any change to output for the same parameters bumps `version`, including labels and sources. A change to the stored shape also bumps `snapshotVersion` and adds an upgrade to `snapshotUpgrades`. An upgrade that returns the snapshot unchanged is fine when older plans simply lack the new data and the new field is optional.
- `pnpm --filter @kerf/api write-snapshot-fixture <id>` refuses to overwrite. If you rewrite the new version's fixture during your own branch, before it merges, delete your own new file first; never touch a merged one.
- Pin the previous version's fixture in `apps/api/scripts/snapshot-fixtures.test.ts`. The hash is sha256 of `JSON.stringify(JSON.parse(file))`, not of the file bytes. The test prints the actual hash when it fails.
- Add a test to the template's `versions.test.ts` saying what the version changed (decision 0008 requires it), as well as a test in `snapshots.test.ts` that reads each older fixture through the upgrades. The cabinet's versions 2 and 3 have only the second (#325); the swing set's `versions.test.ts` is the example to copy.
- Run `pnpm --filter @kerf/api write-catalog-sample` when `catalog-sample.test.ts` reports a difference. The catalog uses the first template, so a generic change can move it too.

## 6. What the template exposed

README section 6.

- Anything in generic code that still assumes the swing set, anything the design system doesn't cover, and anything wrong that was already true before your change goes in a new issue. Don't widen the template's pull request. #321 found #320 this way and said so under "Found along the way."
- If the template needs a generic change, that change is its own pull request and lands first. Stacking is fine; say so at the top of the body ("Stacked on #n: merge that first").

**Stop for the owner:** any new issue labeled `decision`.

## 7. Docs

README section 7.

- Update the spec's status line, parameters, worked examples, and open questions in the same pull request as each change.
- Update `DOMAIN.md` when a generic rule changed.
- `PRODUCT.md`: name the template. The README says to move it out of the candidates, but a template the owner chose outside the list was never there; `PRODUCT.md` still describes only the swing set (#326).
- `AGENTS.md`: its reading table points at `docs/templates/` as a whole, so a new template needs no row. Update it only if a new kind of doc appears.
- If this skill missed something, correct it in the same pull request.

## Pull request

- `Closes #n`. Plain English, per the owner's writing style. Sections: what changed, sources, what was verified (with test counts), what was not, and anything found along the way.
- `pnpm check` passes before pushing; the pre-push hook runs it.
