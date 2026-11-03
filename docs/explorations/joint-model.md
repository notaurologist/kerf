# Joint-based model: design proposal

Status: Accepted (November 3, 2026). The owner chose option C. Issue #548, part of #543.

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

## Still open

- The parity test's tolerance (exact display, 1e-9 before display) is used as written until the owner changes it.
- The test-only solver is not filed. It can be once option C is further along.
