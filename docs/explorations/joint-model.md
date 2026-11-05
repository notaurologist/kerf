# Joint-based model: design proposal

Status: Adopted (decision 0020, November 4, 2026). The owner chose option C on November 3, 2026. Issue #548, part of #543.

This is the exploration's record, brought to `main` when it ended. Everything up to "Adopted" describes `explore/joint-model` as it was: `packages/model`, its parity harness, and the `generateWith` seams exist only on that branch, which is kept and not merged. "Adopted" says what came to `main`.

## The problem

Each template computes its parts, their placements, and every feature on them by hand. A joint between two parts is written twice, once on each part, and the two halves are kept in agreement by the template's own code and fit tests:

- The record cabinet's top gets a dado for each side and partition (`templates/record-cabinet/parts.ts`), and each panel's length separately adds two dado depths (`panelLength`, h_b + 2j, in `geometry.ts`). Nothing generic ties the dado to the panel end it houses.
- The swing set's leg-to-beam bolt grip is a hand-derived formula, `bw + 2(w/cos α − (bd/2)·tan α)` (`templates/swing-set-a-frame/geometry.ts`), and the holes it passes through are written per part in `features.ts`.
- Fit tests (for example `swing-set-a-frame/placements.test.ts`) check that parts meet where they should, and they are written per template.

`Part` and `Placement` (`model/types.ts`) are already generic, and so is everything downstream: solids, drawings, the cut list, and the shopping list. The joints are the part that isn't.

## What a joint must do for the current templates

| Joint | Where | What it fixes on each part |
|---|---|---|
| Trim to a plane | Swing-set legs at the ground and the beam top; crossbar and gusset ends | The end cut's saw setting and which face it is measured from, and the part's length (long point to long point) |
| Flush cut | Swing-set leg tops above the beam | A taper along the leg |
| Bolted lap | Legs, beam, crossbars, gussets | Holes through every part in the stack on one axis, and the bolt grip (wood along that axis) |
| Hardware through one part | Swing hangers in the beam | Holes in that part only |
| Face lamination | Built-up beam plies | Plies stacked face to face; the member's width is the sum |
| Housed end (dado) | Cabinet top and bottom to sides and partitions | A dado in the housing part; the housed part's length grows by the dado depth at that end |
| Mortise and tenon | Cabinet aprons to legs; door rails to stiles (stub tenons) | A mortise in one part and a matching tenon on the other, with the length including the tenon |
| Floating panel in a groove | Door panels | Grooves in the frame parts; the panel sized short of the groove bottoms by the movement gap |
| Screwed with slots | Cleats under the case | Screw holes, slotted in the direction the wood moves |

Some features belong to one part only and stay in template code: notches, cutouts, finger recesses, and the sliding-door tracks. So does edge-gluing boards into a panel, which happens to stock before any part exists (`lumber/panel.ts`).

## Options

### A. A constraint solver

Each part's pose and length are unknowns. Each joint adds equations ("this face lies on that plane", "these axes coincide"), and a numerical solver finds values that satisfy them all. This is how parametric CAD sketches and assemblies work:

- [SolveSpace](https://solvespace.com/tech.pl) solves its constraint equations "numerically, by a modified Newton's method", in a least-squares sense when the sketch is under-constrained.
- [CadQuery assemblies](https://cadquery.readthedocs.io/en/latest/assy.html) turn each constraint (Point, Axis, Plane, PointInPlane, and others) into a cost and minimize their sum.
- The field's literature is mostly about splitting large systems into solvable pieces and finding the under- and over-constrained parts before solving numerically (Bettig and Hoffmann, [Geometric constraint solving in parametric CAD](https://www.cs.purdue.edu/cgvlab/www/publications/bettig2011geometric), JCISE 11(2), 2011; Zou et al., [A review on geometric constraint solving](https://arxiv.org/abs/2202.13795), 2022).

Against Kerf's rules:

- **Which solution.** SolveSpace says, "If multiple solutions exist, then the initial position of the sketch determines which is chosen." A leg could solve to its mirror image. Kerf would need a starting guess for every template and a test that the right branch was found.
- **Hand-checking.** Today every number has a closed-form formula in the template spec with a worked example (hard rule 9). A solver's answer can be checked against the hand calculation, but it doesn't produce the formula the spec documents.
- **Exactness.** Results are correct to the solver's tolerance, not to floating-point rounding of a formula. That is far below 1/16", but the parity test would need a tolerance on every geometric value.
- **Size.** A Newton or Levenberg–Marquardt solver with constraint diagnosis is a project in itself, or a dependency (rule 13).

This option teaches the most numerical method, and it fits Kerf the least.

### B. A tree of joints, placed in order

One part is grounded. Each joint places a child part relative to its parent through a local frame on each, as Onshape positions parts by "aligning a mate connector defined on one instance" with one on another ([Mate connector](https://cad.onshape.com/help/Content/mateconnector.htm), updated October 30, 2026). With only fixed joints, placement is matrix composition along the tree, as with OpenSCAD's explicit transforms ([Transformations](https://en.wikibooks.org/wiki/OpenSCAD_User_Manual/Transformations)). It is deterministic, has no solver, and every placement traces back through a chain of joints.

The difficulty is that both templates have closed loops. A swing-set leg meets the beam at the top and the ground at the foot, and a crossbar meets two legs. A tree can't close a loop by itself: something has to compute the leg's length and angle so both ends land. In Kerf that's the trigonometry in `geometry.ts`, so it stays in template code either way. A tree would replace how placements are written, which is the part of each template that is already short and hand-checked, and it wouldn't remove the closing formulas.

### C. Joints declared between placed parts (recommended)

Templates keep computing placements with their closed-form, hand-checked formulas, as now. They stop writing features on each part. Instead they declare joints between placed parts, and the model derives everything both sides of each joint need:

- **End cuts and lengths from trim planes.** A part trimmed to a plane gets its saw setting from the angle between its axis and the plane, and its length from where its edges cross the two planes at its ends. This replaces per-template end-cut and length formulas with one generic calculation, for the single-angle cuts both templates use. Compound cuts are outside the current templates and are refused.
- **Holes and grips from bolted stacks.** A bolt axis through a list of parts gives each part's hole (entry, direction, and length through that part) and the grip (the sum of those lengths). The swing set's grip formula becomes a hand-checked worked example of the generic calculation, no longer code.
- **Paired features.** A housed end makes the dado and the housed part's extra length together. A mortise and tenon are made as one, so the two can't disagree.
- **Generic fit tests.** Each joint type checks its own fit in every template: a housed end sits in its dado, and each hole in a stack lines up with the next. Today those checks are written per template.

The model's output is the same `Part[]` and `Placement[]` the templates return now, so solids, drawings, lists, steps, and snapshots don't change.

This option teaches the parts of the field Kerf can use: frame algebra (part frames, plane intersection, transforms between frames), designing a joint vocabulary, and making a representation in which one source of truth replaces two copies. It reaches parity one joint type at a time, so it can stop at any point with something working.

A numerical solver can still come later, in tests only. Given only the declared joints, it would check that a template's placements satisfy them, independently of the template's formulas. It would be a second check on the hand-derived trigonometry and would never supply a number. That is a separate experiment, filed if the owner wants it.

## Decision

Option C, chosen by the owner on November 3, 2026. Option A conflicts with hard rules 1, 4, and 9 as Kerf applies them, and option B moves code without removing any.

## What stays in template code

Parameter schemas and validation, starting questions, placements and the closing formulas behind them, single-part features, hardware choices, the structural model, flags and checklist items, build steps, and all wording. The model knows nothing about any project type (hard rule 7). A joint is "bolted lap", never "leg-to-beam".

## Package shape

`packages/model` on `explore/joint-model`, depending on `@kerf/core` for `Part`, `Placement`, `Vec3`, and the stock and unit helpers. Nothing in `apps/` imports it. If the owner adopts it later, the code moves into `packages/core/src/joints/` and the templates call it, with a template version bump only if an output changes (0008).

A first sketch of the vocabulary (names to settle during step 2):

```ts
type Joint =
  | { kind: 'trim'; part: PartRef; end: 0 | 1; plane: Plane }
  | { kind: 'bolted-lap'; hardwareId: string; axis: Line; parts: PartRef[] }
  | { kind: 'housed-end'; housing: PartRef; housed: PartRef; end: 0 | 1; depth: number }
  | { kind: 'mortise-tenon'; mortised: PartRef; tenoned: PartRef; end: 0 | 1; tenon: TenonSize };
```

## Parity test

For every worked example in both template specs, and every parameter set in the stored snapshot fixtures (`templates/*/snapshots/`), generate the plan with the current template and with the template's joint-based version, and compare:

1. **What the plan shows, exactly.** Every formatted length, angle, and label, through core's display formatters, string for string. This is the strict gate: it proves the owner would see no difference.
2. **The numbers before display, within 1e-9 in. and 1e-9°.** Computing a value a different way changes its last bits, so exact float equality isn't a fair test. 1e-9 in. is about 60 million times finer than 1/16".
3. **Everything else, exactly:** IDs, letters, roles, notes, hardware, operations, and the order of every list.

A joint type counts as done when both templates reach parity with it in place.

The harness is `packages/model/src/parity.ts` (#551). Its cases are each template's worked examples, then the distinct parameter sets in its snapshot fixtures that the current version accepts once upgraded: 10 for the swing set and 6 for the record cabinet as of November 3, 2026. Older record cabinet fixtures lack parameters added since and are left out. A template's `generate` returns its plan with the cut list and lumber already made from the parts, so a joint-based version has to make them the same way for the comparison to mean anything.

## Order of work

1. Package skeleton and the parity harness, comparing each template with itself so the harness is proven before anything changes (#551).
2. Trim planes: swing-set legs, crossbars, and gussets (#552).
3. Bolted laps and hardware through one part: the swing set's holes and grips (#553).
4. Housed ends: the cabinet's dadoes and panel lengths (#554).
5. Mortise and tenon, floating panels, and screwed slots: the rest of the cabinet (#555).
6. The owner decides whether to adopt it.

Each step is its own issue and pull request into `explore/joint-model`.

### How a template's joint-based version plugs in

A template's `generate` makes its design (parts, placements, hardware, flags) and then the cut list, lumber, and structural review from it. The joint-based version replaces only the design step, so everything after it runs unchanged. On `explore/joint-model`, the swing set's definition builds its `generate` with `generateWith(design)`, and its folder exports `generateWith`, `design`, and `dimensions`. Its own `generate` is `generateWith` of its own design, so its output is unchanged. The joint-based design lives in `packages/model/src/templates/<template-id>/`, which the generic-code scan treats like the template's own folder.

The beam's deeper-stock comparison and the starting questions' bolt suggestions still call the template's own design step. They compare other beam sizes and suggest bolts, and read no part's length or end cuts.

Step 2 (#552): `packages/model/src/trim.ts` cuts a part to a plane at each end. The swing set's joint-based design declares every part that way: the beam plies square at x = 0 and L, the legs level at the top of the beam and at the foot cut, and the crossbars and gussets parallel to the legs' outer faces, `past` beyond them. Every part's length, end cuts, marked edges, and placement come from the trims, and the swing set reaches parity in all 10 cases.

Step 3 (#553): `packages/model/src/boltedLap.ts` takes a bolt's line and the parts it passes through, in order, each with the side it is drilled from (near or far face, reference or far edge). Each hole is where the line runs inside that part, clipped to its stock, end cuts, and tapers; the grip is the sum of the holes. It refuses a gap or overlap between parts along the bolt, a bolt that misses a part or doesn't pass through the named side, and a part with notches, cutouts, or joinery, which would make it concave. The side is the template's choice: the swing set drills each leg from its outer edge and the beam plies from the back, and the same local hole on both frames is listed once. The swing set's joint-based design declares every placed bolt: leg to beam, crossbar, gusset, and vertical hanger bolts. Its holes, the leg-to-beam grip in its geometry, and each bolt's grip and lengths to buy come from the laps. It reaches parity in the 10 fixture cases and three more: the spec's edge of range, a three-ply beam, and other bolt counts at each joint.

Still from the template: the grip printed in hardware notes and flag text, which it formats from its own value (the same within the tolerance), and the grips of ply bolts and horizontal hanger bolts, which are not placed.

Step 4 (#554): `packages/model/src/housedEnd.ts`. `housingPlane` is the plane a dado's depth inside a part's face; a part trimmed to it is long enough to reach the dado's bottom. `housedEnd` then gives the dado: the housed end's outline where it enters the housing, on the face it enters, found from the parts' frames. A dado stopped short of the housed part's reference edge leaves that corner notched. It refuses an angled end, a part that meets the face at an angle, an end that doesn't reach the dado's bottom, and one that runs past the housing. The record cabinet's definition has the same `generateWith` seam as the swing set's. Its joint-based design trims each side and partition into the top and case bottom, and each back rail into the panels on either side of its bay. The panels' and rails' lengths and placements, the top's, bottom's, and panels' dadoes for them, and the panels' notches all come from the joints. The doors' tracks are still the template's. It reaches parity in the 6 fixture cases and two more: one bay and four bays.

Step 5 (#555): `packages/model/src/joinery.ts`.
- `mortiseAndTenon` gives a tenon of the template's size on the end and the mortise it fits, on whichever face or edge of the mortised part it enters.
- `tenonInGroove` gives a stub tenon as thick as the groove it reaches is wide, where that groove is.
- `floatingPanel` gives each frame part's groove and the panel's length, place, and tongue rabbets, centered in the grooves, short of their bottoms by its gaps. It refuses a panel whose stock is not the width between the grooves less its gaps.
- `slottedScrews` makes the screw nearest the edge the held part is fixed at round and slots the rest the way that part moves across its grain.
- `entering` and `sideEntered`, from step 4, find the face or edge an end goes into for all of them.

The record cabinet's joint-based design adds the aprons' tenons and the legs' mortises, the doors' rails, grooves, and panels, and the cleats' screw holes, and reaches parity in all 8 cases.

## Parity sweep

The hand-picked cases cover 13 parameter sets for the swing set and 8 for the cabinet. The sweep (`packages/model/src/templates/<template-id>/sweep.test.ts`) draws 800 more for each from a fixed seed, every parameter within its schema's range, half of them on a 1/16" step as an owner would type them. It keeps those the schema accepts: over 300 for the swing set, of which over 150 make a plan, and over 600 for the cabinet, of which over 180 do. Every draw's result is compared, refusals issue for issue, and every tenth draw's shown plan. `random.ts` is the seeded source; `sampledCases` in `parity.ts` draws the cases.

It found four things the hand-picked cases missed.

1. **Displayed angles flipped at half steps.** A swing set splayed exactly 17.25°, as an owner would type it, showed its cuts at 17.3° from the template and 17.2° from the joints. The trim recovers the angle as atan(tan 17.25°) = 17.249999999999996, inside the tolerance, but `formatAngle` rounded it down. On this branch core's display formatters now round a value within 1e-9 of a half step as its exact value would: `formatAngle` and `toSixteenths`. No current plan shows anything differently: every fixture and shown-plan lock passes unchanged. Rounding still happens only in the formatters (hard rule 4).
2. **The record cabinet puts leg mortises outside the leg** when the apron and its setback are wider than the leg (#561). The mortise-and-tenon joint refuses those parameters; the template makes the plan.
3. **The record cabinet sizes a one-board door panel's tongue from `panelThickness`**, not from the board, so the tongue is too thick for its groove (#562). The floating-panel joint sizes it from the stock.
4. **The record cabinet's door thickness and tracks come from the board** even when the stiles and rails are glued up and flattened thinner (#563). The tracks are too wide and the frame's parts are placed on different planes. The floating-panel joint refuses a frame whose grooves are not in one plane.

The last three were bugs in the template on `main`. They are fixed there (#565, #566, #567), and with `main` merged in, the sweep runs every draw with nothing left out.

A fifth came up once those draws were back: a dado that starts at the very end of its housing, such as the case bottom's for the left side, came out at −1.1e-16 instead of 0. That is inside the tolerance, so the results matched, but the cut detail could not show a negative length. Only the shown plan of that draw caught it. `entering` now puts an outline that reaches an edge of the housing on the edge. The sweep compares the shown plan on every tenth draw, and a one-off run on every draw (about 15 s) found nothing more.

## Where it ended, November 3, 2026

Both templates reach parity. From the joints: every part's length, end cuts, and placement, and every hole, grip, dado, notch, mortise, tenon, groove, rabbet, and screw hole. Still from the template:
- single-part features: the swing set's flush cut, the cabinet's leg tapers, door tracks, and finger recesses
- where each part stands, and each joint's size
- the swing set's ply-bolt and horizontal-hanger grips, and the grips printed in its notes and flags
- the beam's deeper-stock comparison and the starting questions' bolt suggestions, which call the swing set's own design

One inconsistency surfaced: the cabinet's leg mortises record `withPart: 'apron'`, the aprons' role, where every other joint feature records a part ID. Nothing reads `withPart` outside the templates, so it shows nowhere. The joint-based design keeps the role, for parity.

### What adopting it would take

1. **A decision record.** It changes how templates are written (0008), so it is the owner's call (rule 13).
2. **Move the joints into core,** under `packages/core/src/joints/`. They are generic already; the generic-code scan covers them where they are.
3. **Rewrite each template's parts and placements as joint declarations,** from its joint-based design here, and delete the per-part features and formulas the joints replace. The template specs would describe the joints, and their hand-checked worked examples stay.
4. ~~Fix #561 to #563 on `main` first.~~ Done (#565, #566, #567).
5. **Decide what "the same output" means for the swing set.** The cabinet's joint-based output is identical to the last bit for its worked examples, since its sizes are binary fractions. The swing set's differs in the last bits in 33 values per worked example (part lengths, marked edges, hole positions, origins), because its trigonometry is computed another way. Core's fixture lock compares exactly, so adopting it as is means a template version bump (0008). Every stored swing-set plan would then say the current template gives different numbers, with no difference anyone can see. Three ways out:
   - accept the bump
   - have the version report ignore differences below the display's rounding
   - arrange the joint math to reproduce the template's formulas bit for bit, which the trims could do for level cuts
6. **Bring the formatters' rounding to `main`** with the joints, or the swing set's displayed angles can flip at half steps.
7. **Remove the `generateWith` seams,** or keep them for the next experiment.

## The workbench, built joint-first (#577), November 4, 2026

The third template was the deciding test (#576): written from its spec with the joints from the start, not ported to parity. It lives in `packages/model/src/templates/workbench/` and is not in the app. As the owner chose, it covers what #577 asks for: the design, the structural review and movement, a sweep, and the edge-of-range examples. The definition, form, drawings, and build steps wait for the adoption decision. It was built in five stages, each its own pull request (#601, #607, #614, #617, #619), and this one.

The four measures #576 set out before the build:

### 1. Size

| | Lines | Parts | Placements | Features cut |
|---|---|---|---|---|
| Record cabinet, hand-written (`parts.ts`, `geometry.ts`) | 889 | 14 | 29 | 44 |
| Workbench, joint-first (`design.ts`) | 1,149 | 34 | 50 | 123 |

Per part, the workbench takes 34 lines and the cabinet 64. Per feature cut (mortises, tenons, dadoes, notches, grooves, rabbets, dovetails, bored holes, hinge plates), it takes 9 and the cabinet 20. So it is about half the size of hand-written code for the same amount of design, though not smaller outright. The comparison is rough: `geometry.ts` holds the cabinet's validation, and `design.ts` the workbench's refusals, but the cabinet's part notes and board-selection text are in `parts.ts`, and the workbench has none yet.

### 2. Hand-derived formulas

About 35 remain, all of one kind: where a part stands or how big a joint is. They are:
- the derived geometry the spec lists (the top's underside, the base outside the legs, the legs' corners)
- the case's place on the low rails
- the shelves' heights from the band split
- the back's plane from its groove inset
- each drawer box's place in its opening
- each door's size from its gaps
- the vises' screw heights
- the dog-hole rules
- the gap rules
- the span the top's deflection is taken over

The joints and core's hardware helpers give the rest: every part's length and end cuts, every origin, and all 123 features. Two of the remaining formulas are sizes: the door panel's width, which `floatingPanel` checks rather than gives, and the middle and lower shelves' depth, from the back's plane. The rest are positions. On the cabinet, lengths worked out by hand from other parts' positions are what went wrong (#561 to #563).

### 3. New joints

Four, each a small addition with hand-checked tests and a mutation that fails them:
- **The through tenon:** a mortise as deep as the part, optionally left long on one side. About 10 minutes.
- **A panel floating in grooves cut into faces:** about 12 minutes. A sign mutation survived the first tests, so a turned-part case was added.
- **That panel open on one side,** and **flush with one wall:** about 10 minutes each.
- **Through dovetails at a corner,** across the width the boards share: about 15 minutes. Core's fit checks accepted its cuts the first time.

`joinery.ts` grew from 274 lines to 540. The doors needed no new joint: they reuse the record cabinet's `floatingPanel` and `tenonInGroove`, and core's hinge placement.

### 4. Bugs the fit checks caught

While the template was written, before any sweep, the fit checks caught one template bug. The top's and feet's mortises named `leg`, but the legs are two mirror-image parts, so no part had that ID or role.

They also found four things wrong with the fit checks themselves, each fixed on `main` first:
- a tongue held across two grooves at a panel's corners (#605)
- a tongue rabbeted from one face (#612)
- a groove cut into a face (#603)
- a hinge cup matched to a plate on the far side of a pair of doors (#615), which was a bug

The sweep (800 draws, `sweep.test.ts`) then found three more template problems that the hand-checked examples could not:
- the doors were placed at y = 0 rather than at the case's front, which only differs when the top overhangs the front legs
- the movement gaps outgrow their grooves on a long or deep bench
- a short case leaves doors too short for their hinges

The last two needed refusals the spec had not listed. The edge-of-range example hits the third. Once the fit checks could see parts that overlap and holes that come out into another part (#618), the sweep found three more: the face vise's screw running into the end rail, the end vise's guide bars running into the right legs, and an end rail as thick as the legs in the end vise screw's way. Each is now refused.

### What else the build showed

- **Core gaps.** Seven generic gaps landed on `main` before the template could use them: #599, #603, #605, #608, #609, #612, and #615. The joints asked questions the hand-written templates never did: room left in a mortise, part-width dovetails, planing to thickness, panels in face grooves. Most of the time went there, not into the joints.
- **One gap is open.** #618: the fit checks never check that two parts don't occupy the same space. A dog hole bored through the top into a leg would pass them. A template rule and a test guard against it here.
- **Shared parts.** Every instance of a part must come out of its joints with the same features, or the design throws. That check caught two mutations, and it is how the two upper drawers, the two doors, and the end rails were confirmed to be one part each.

### Against #576's rule

#576 said to adopt if the template is clearly smaller, needs few hand-derived formulas, and its new joints were small additions, and not to if it fights the joints. Measured:
- **Size:** smaller per part and per feature, but not outright.
- **Formulas:** the ones that remain are almost all positions, with two sizes.
- **Joints:** the new ones were small.
- **Fighting the joints:** nothing did. The effort went into core, which the hand-written way would have needed too.

The decision is the owner's.

## Adopted, November 4, 2026

The owner adopted option C in decision 0020 (#543). It was moved to `main` in five steps, each its own pull request, and this exploration ended there. What became of each item in "What adopting it would take":

1. **The decision record:** 0020, which amends 0008.
2. **The joints moved into core** (#624): `trim`, `boltedLap`, `housedEnd`, the joinery (`mortiseAndTenon`, `throughTenon`, `tenonInGroove`, `floatingPanel`, `panelInFaces`, `slottedScrews`, `throughDovetails`), and `compare`, in `packages/core/src/joints/`. The dovetail layout rules are in `packages/core/src/joinery/`.
3. **Each template declares its joints:**
   - The record cabinet (#625) in `templates/record-cabinet/joints.ts`. Its output was unchanged to the last bit, so it kept version 21. Its stock is sized from the joints' lengths (#632).
   - The swing set (#626) in `templates/swing-set-a-frame/joints.ts`, as version 38. Its legs', crossbars', and gussets' lengths (#642, version 39) and its bolt grips (#644, no output change) come from the joints alone.
   - The workbench (#627) joined the app as the third template, joint-first in `templates/workbench/design.ts`, at version 1.
4. **#561 to #563:** fixed on `main` before adoption (#565, #566, #567).
5. **The swing set's last bits:** the owner accepted the version bump. Older plans say a newer version exists, with no visible change.
6. **The formatters' rounding:** on `main`. `formatAngle` and `toSixteenths` round a value within float error of a half step as its exact value would.
7. **The `generateWith` seams** never came to `main`, so there was nothing to remove.

The open fit-check gap the workbench build found, parts that occupy the same space, closed with the overlap and through-hole checks (#618). The cabinet's leg mortises still record the aprons' role in `withPart`, and the fit checks match a mortise's tenon by ID or role.

`docs/ARCHITECTURE.md` (`joints/`) and `docs/templates/README.md` describe how templates are written now. Each template spec has a section on its joints.

Not carried to `main`:
- The parity harness and its tolerance. Parity was the exploration's test; on `main`, each template's worked examples, snapshot fixtures, fit checks, and sweep are.
- The test-only solver. It was never filed.
