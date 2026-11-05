# Fabrication outputs

Status: Built, awaiting the owner's review and a garage check (November 5, 2026). Issue #546; its scope is proposed and its four questions are open.

Outputs for the shop beyond the plan's drawings: full-size paper templates to trace or stick on a board, DXF files for a CNC router's CAM program, and hidden-line removal for the isometric views. Code lives in `packages/fabrication` on `explore/fabrication`. Nothing in `apps/` imports it.

## What it starts from

Core already gives everything a template needs, exactly, in inches:

- `geometry.partOutline(part)` is a part's face outline in its own frame (u along it from the first end's long point, v across from the reference edge), after end cuts, tapers, notches, cutouts, and tenon shoulders.
- `geometry.edgeLengths(part)` is the length of each long edge.
- `cutList([part])` formats each end's description, saw setting, and angle to the edge, and the part's stock and quantity.

The package adds no numbers about the wood (hard rule 1). It lays core's drawing out on paper and writes labels through core's formatters, so nothing is rounded before display (hard rule 4).

## Which parts get a template

In the three templates' worked examples, the parts with a shaped outline are:

| Template | Part | Size | Shape |
|---|---|---|---|
| Swing set | Gusset | about 19-1/2" by 7-1/4" | Trapezoid, both ends 20° toward each other |
| Swing set | Crossbar | about 59" by 5-1/2" | Trapezoid, both ends 20° |
| Swing set | Legs | about 131" and 138" by 3-1/2" | Parallelogram, 20° level cuts, a taper at the top |
| Record cabinet | Sides, partitions | panels, 13-5/8" long | Square ends, two notches |
| Record cabinet | Legs | 7-1/2" long | Square ends, two tapers |
| Workbench | Drawer shelves, divider | panels | Square ends, two notches |

The gusset prints whole on 3 pages. The crossbar would take 8 and the legs far more, so they get a template at each angled end. The cabinet's and workbench's parts have square ends, so their templates show only a notch, a taper, or a tenon's shoulders.

## Whole parts and end templates

A part with two plain square ends gets no template. Otherwise it prints whole when it fits on 6 pages and its end templates would cover at least half its length anyway; the gusset and the cabinet's short legs print whole. Every other part gets one template per shaped end.

An end template shows the end as far in as its shape reaches (from the long point to the short point of an angled cut, to the start of a taper, or the depth of a notch, cutout, or tenon shoulder), then 3" more or the part's width if less, and stops at a zigzag break. It marks:

- the cut line, from core's outline, left open at the break;
- the long point with a dot and a dashed line square across the part from it, measured from the blank, so a long point that a taper later removes is still on the sheet; the taper's waste is dashed;
- in the notes, the end's description, saw setting, and angle to the edge from the cut list; which edge the long point is on and how far along the other edge the cut meets it; the reference edge; and the part's full length.

The distance from the square line to the short point is the difference between two of the blank's corners from core's `blankOutline`, rounded by `formatLength`. The package does no trigonometry of its own.

Written from each template's first worked example, the swing set needed 9 pages at this step (gusset 3, crossbar ends 2, leg ends 4), the record cabinet 21, and the workbench 26. The cabinet's sides and the workbench's drawer shelves are 13" to 17" wide, so each notched end takes 2 pages for a 3/16" by 1/2" notch that is quicker to lay out with a square. Leaving out notches that small is a question for the write-up.

## Printing

Each page is an SVG whose width and height are in inches and whose viewBox spans the same numbers, so one user unit prints one inch at 100%. Tests read the attributes back and measure the check square and scale bar in user units.

- **Paper:** US letter, portrait or landscape, whichever needs fewer pages for the part (portrait on a tie). A 1/2" margin on every edge, which most printers can reach, and a 1.4" footer. The drawing area is 7-1/2" by 8.6" portrait and 10" by 6.1" landscape.
- **Tiling:** the drawing is centered in a grid of drawing areas. Pages butt together: each internal edge is a dashed trim line, and registration marks (a circle and cross) sit on the trim lines at every shared corner and halfway along every join, half on each page.
- **Scale check:** every page has a 1" check square and a 6" scale bar with a tick at each inch. A printer set to fit the page shrinks it by a few percent; on 6" that is about 3/16", easy to see against a tape.
- **Footer:** the part's letter, name, stock, and quantity; the printing instructions; the checks; a small map of the sheet with this page filled in; and the page's row and column.
- **File:** one HTML file holds every page, each on its own sheet, with named `@page` rules turning the landscape ones. `pnpm --filter @kerf/fabrication write-templates <template-id> <part letter>...` writes it to `packages/fabrication/out/` from the template's first worked example.

## Holes and joinery marks

Templates mark what goes on the face the drawings show (the far face, as in the cut details):

- Each hole or bored hole square to the faces gets a circle at its diameter and center lines past it, to prick through with an awl, labeled with its diameter. Its circle is dashed when it stops short of the face shown. Holes alike share one note: how many, the diameter, what for, and which face the bit enters.
- Each dado and face mortise is outlined, solid in the face shown and dashed in the other, labeled D1, M2, and so on, with its width or size and depth in the notes.
- Holes and mortises in an edge or end are counted in a note pointing to the cut detail, since a face template cannot show them.

An end template takes in each face hole whose circle starts within two widths of what it already shows, nearest first, as the cut detail merges its pieces, so a joint's bolts stay on one template. The swing set's leg tops now run to 15.56", past both leg-to-beam bolts, and take 2 landscape pages each. The swing set needs 13 pages, the record cabinet 21, and the workbench 28.

Notes wrap at 7", and a drawing that spans pages starts at the first page's left edge (one that fits across a page is centered), so no note crosses a vertical trim line. A note can still straddle a horizontal one on a sheet more than one page tall.

## DXF

`partDxf(part)` writes one ASCII DXF file per part for a CAM program: the face outline as one closed polyline on layer `OUTLINE`, and each hole square to the faces as a circle on `THROUGH_HOLES`, `STOPPED_HOLES` (bored into the face shown), or `BACK_HOLES` (bored into the other face, cut with the part turned over). Coordinates are core's, unrounded, in inches: x along the part from the first end's long point, y from the reference edge, looking at the face the drawings show. `pnpm --filter @kerf/fabrication write-dxf <template-id> [part letter...]` writes them to `packages/fabrication/out/dxf/`.

The group codes were checked against Autodesk's DXF Reference for AutoCAD 2024 (help.autodesk.com: HEADER Section Group Codes, POLYLINE, VERTEX, CIRCLE, and Writing a DXF File):

- `$ACADVER` is code 1, and AC1009 means R11 and R12. `$INSUNITS` is code 70, and 1 means inches.
- POLYLINE: 66 is the old "entities follow" flag (now ignored if present), 10/20/30 a dummy point, 70 bit 1 closed; then VERTEX entities with 10/20/30 and a SEQEND.
- CIRCLE: center 10/20/30 and radius 40. Code 8 names the layer.
- The HEADER may be omitted, layers named in ENTITIES are created when read, and the file must end with EOF.

The file is labeled R12, since nearly every DXF reader takes its POLYLINE. LWPOLYLINE and object handles came later and would need the newer structure. `$INSUNITS` is newer than R12, and a reader that does not know it ignores it. Dadoes, mortises, and tapers that take off thickness are not written; each would need a depth, which a 2D DXF can only carry by layer name.

No CAD viewer was available to open the files in, so that check is left for the owner. G-code waits on #546's first question.

## Hidden-line removal

Core's isometric and exploded views paint every face toward the viewer back to front (a BSP tree in `views.ts`), each followed by its own edges, so on screen a nearer face's fill covers the edges behind it. Every edge is still in the drawing, whole. `removeHiddenLines(drawing)` works on that output in 2D: each visible edge is split where a face painted after it strictly covers it on the page, and the covered pieces are dropped or kept as hidden (dashed) lines. The face fills are removed, and letters, leaders, grade lines, and phantom lines are kept. An edge on a later face's boundary, such as the one two faces of a box share, is not covered. The result is line art with no fills, for a pen plotter, a laser, or a print without tones.

It needs nothing new from core, since paint order already settles which face is in front, and it adds no dependency. Each edge is cut where it crosses the outline of a later face whose bounding box overlaps it, and each piece is tested at its middle.

Times on this machine, for every template example (`pnpm --filter @kerf/fabrication write-line-art`, which also writes the first example's views as SVG to `packages/fabrication/out/line-art/`):

| Template | View | Edges in | Visible lines out | Time |
|---|---|---|---|---|
| Swing set (3 examples) | Isometric | 144–178 | 126–151 | 1–2 ms |
| Swing set | Exploded | 144–178 | 153–185 | under 1 ms |
| Record cabinet (3 examples) | Isometric | 556–1023 | 126–141 | 3–10 ms |
| Record cabinet | Exploded | 472–776 | 357–547 | 2–3 ms |
| Workbench (3 examples) | Isometric | 2545–2557 | 681–691 | 27–46 ms |
| Workbench | Exploded | 1991 | 1228–1256 | 11–18 ms |

Fast enough to run on every request, so adopting it would not need caching. A 3D view in WebGL waits on #546's second question.

## What was built

Five steps, each a pull request stacked on the one before, all into `explore/fabrication`:

| Step | Issue | Pull request | What it does |
|---|---|---|---|
| 1 | #666 | #674 | A whole part full size, tiled across letter pages, with a check square, a scale bar, trim lines, and registration marks |
| 2 | #667 | #676 | Templates of a long part's shaped ends, with the long point and a square line |
| 3 | #668 | #680 | Hole centers to prick through, and dadoes and mortises outlined |
| 4 | #669 | #681 | A DXF file per part: outline and holes on layers, in inches |
| 5 | #670 | #682 | Hidden-line removal for the isometric and exploded views |

The package holds about 1,300 lines of code and scripts and 1,100 lines of tests, and adds no dependency. Every length and angle on a template comes from core: `partOutline`, `blankOutline`, `edgeLengths`, the cut list's end text, and `formatLength`. The package computes page layout and the differences between core's coordinates, such as how far a short point sits from its square line.

### What changed along the way

- **Whole part or ends.** The first rule, whole when it fits on 6 pages, would have printed the record cabinet's 17"-wide sides whole for a 3/16" notch. A part now prints whole only when its end templates would cover at least half its length anyway.
- **Notes.** Templates first sized their sheet to fit the notes, which made narrow end templates two pages wide, then let notes run across trim lines. Notes now wrap at 7", and a sheet that spans pages starts at the first page's edge. Identical end notes merge, and holes alike share one note, so the gusset still prints on 3 pages.
- **Holes on end templates.** The leg's top template first stopped at 8.85", past one of its two leg-to-beam bolts. An end template now takes in face holes near it, by the same two-widths rule the cut detail uses to merge its pieces.
- **The long point under a taper.** The swing set's flush cut removes the blank's long point. Templates place the long point and square line from the blank's corners and draw the taper's waste dashed.
- **DXF version.** The file is labeled R12 for the widest reach, with `$INSUNITS` set to inches. Group codes were read from Autodesk's DXF Reference.
- **Hidden lines in 2D.** Core already paints faces back to front, so hidden-line removal works on its drawing without any new 3D code and takes at most 46 ms on the workbench.

## Printing in the garage

Not done yet: this needs the owner. The check that matters:

1. `pnpm --filter @kerf/fabrication write-templates swing-set-a-frame E`, open the file in a browser, and print at actual size (100%).
2. Measure the check square (1") and the scale bar (6") on each page.
3. Trim on the dashed lines, butt the 3 pages so the registration marks meet, and tape them.
4. Lay the gusset on a 2x8: it should be 19-1/2" along the reference edge and 14-1/4" along the far edge, with both ends at 70° to the edges.
5. Print a leg's top template and check the short point against a square line from the long point (1-1/4" along the far edge on a 4x4).
6. Open `write-dxf swing-set-a-frame E` in a free CAD viewer and measure the same gusset.

Record here what measured off, what was hard to line up, and whether a template was quicker than laying the cut out with a square.

## Adoption proposal

The owner decides; each adoption is a separate decision issue with its own record. Proposed:

1. **Full-size templates: adopt after the garage check, if the gusset measures true.** They answer the most likely recut on the swing set: angles laid out from the wrong reference. Where: a "Print templates" action on the Diagrams page and in the printed plan, beside the cut details. What it takes:
   - Choosing a template's windows (shaped reach, the hole rule, whole or ends) is geometry, so it moves into `packages/core` as generic code (principle 6), and the API returns the sheets as drawings (principle 1).
   - Page layout (tiling, trim lines, check square) is presentation. It could stay in its own module served by the API as print-ready SVG, or move to the web app's print path. The web app must not compute numbers it presents as authoritative, and tile positions are not those numbers, but the check square's size has to stay exact, which favors the API.
   - No template version bump: templates are drawn from stored parts on read, like the cut details.
   - Tests that print scale holds through the web app's print stylesheet as well as the SVG.
2. **DXF: adopt only if the owner has or plans to use a CNC router (#546, question 1).** It is small: a download per part beside its cut card, served by an API route behind the session (hard rule 10). Dadoes and mortises would need a depth convention the owner's CAM program reads.
3. **Hidden-line removal: do not adopt now.** The app's views are toned, and on screen and in print the fills already hide what is behind. Line art matters for a plotter or a laser, which Kerf has no use for yet. Keep it on the branch. If the printed plan ever goes black-and-white without tones, it is ready and fast enough to run on every request.
4. **G-code and WebGL: not built.** Both wait on #546's questions. WebGL would need a dependency.

## Still open

- The owner's answers to #546's four questions, and the garage check above.
- Very small notches, such as 3/16" by 1/2", probably need no template; leaving them out is a one-line rule once the owner says so.
- Hinge plate screws on case sides are not marked on templates.
- On a sheet more than one page tall, a note line can straddle a horizontal trim line.

## Steps

1. #666 Package and whole-part templates
2. #667 End templates for long parts
3. #668 Hole centers and joinery marks
4. #669 DXF of part outlines
5. #670 Hidden-line removal for the isometrics
6. #671 Write-up and adoption proposal

G-code and a WebGL view wait for the owner's answers in #546.
