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

The gusset prints whole on 3 pages. The crossbar would take 8 and the legs far more, so they get a template at each angled end (#667). The cabinet's and workbench's square-ended parts are laid out with a square; a template helps only with a notch or taper.

## Printing

Each page is an SVG whose width and height are in inches and whose viewBox spans the same numbers, so one user unit prints one inch at 100%. Tests read the attributes back and measure the check square and scale bar in user units.

- **Paper:** US letter, portrait or landscape, whichever needs fewer pages for the part (portrait on a tie). A 1/2" margin on every edge, which most printers can reach, and a 1.4" footer. The drawing area is 7-1/2" by 8.6" portrait and 10" by 6.1" landscape.
- **Tiling:** the drawing is centered in a grid of drawing areas. Pages butt together: each internal edge is a dashed trim line, and registration marks (a circle and cross) sit on the trim lines at every shared corner and halfway along every join, half on each page.
- **Scale check:** every page has a 1" check square and a 6" scale bar with a tick at each inch. A printer set to fit the page shrinks it by a few percent; on 6" that is about 3/16", easy to see against a tape.
- **Footer:** the part's letter, name, stock, and quantity; the printing instructions; the checks; a small map of the sheet with this page filled in; and the page's row and column.
- **File:** one HTML file holds every page, each on its own sheet, with named `@page` rules turning the landscape ones. `pnpm --filter @kerf/fabrication write-templates <template-id> <part letter>...` writes it to `packages/fabrication/out/` from the template's first worked example.

## Steps

1. #666 Package and whole-part templates
2. #667 End templates for long parts
3. #668 Hole centers and joinery marks
4. #669 DXF of part outlines
5. #670 Hidden-line removal for the isometrics
6. #671 Write-up and adoption proposal

G-code and a WebGL view wait for the owner's answers in #546.
