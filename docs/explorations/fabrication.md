# Fabrication outputs

Status: In progress (November 2026). Issue #546. The scope in #546 is proposed and awaits the owner's review.

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

## Steps

1. #666 Package and whole-part templates
2. #667 End templates for long parts
3. #668 Hole centers and joinery marks
4. #669 DXF of part outlines
5. #670 Hidden-line removal for the isometrics
6. #671 Write-up and adoption proposal

G-code and a WebGL view wait for the owner's answers in #546.
