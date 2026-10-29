# 0016: Bolts placed by a stated rule, with distances reported against NDS 2024

Status: Accepted (October 2026). Decided by the owner on #93.

## Context
Until template version 6, each crossbar, gusset, and beam-ply joint gave only its bolt count and the area its bolts go in (#50), so the builder laid the bolts out with an experienced builder. Cut details and build steps could not show exact holes. #93 compared three options: place bolts at NDS minimums, a plain geometric layout aid, or keep the areas.

Reading NDS 2024 section 12.5.1 (Tables 12.5.1A to 12.5.1D, pp. 98 to 99) against the worked example showed that, with the crossbar and gusset flush with the legs, no bolt position in a 4x4 leg gives a 1/2" bolt the 7D end distance NDS sets for full design value when the bolt bears toward the board's end (softwood). The owner chose to report distances against NDS (option A), and asked that the design be improved where the review shows it can be, rather than copying an earlier build.

## Decision
- **Bolts are placed by a stated rule** (template spec, Bolt layout): on the leg's centerline, one in the middle of each equal strip across the board. They are part data as holes in the board and the leg.
- **The crossbar and gusset run past the legs** by 7D − w / (2·cos α), so every bolt has the full-value end distance whichever way it bears. Ends stay parallel to the legs. This is the design change the review pointed to.
- **Every distance is reported against the NDS 2024 rows that could apply**, with the table and page, and the assumptions that choose the rows (load along the board's grain, across the leg's and beam's grain; softwood). End distances list both load directions. A distance under a row's value raises an expert check naming it. The values live in generic code (`structural/boltDistances.ts`); only the template knows which joints it has.
- **No capacity is computed.** Connections stay on the confirmation checklist (PRODUCT.md, non-goals). This is geometry measured against published minimums, written as facts, never as a verdict (hard rule 2).
- **Bolt sizes stay the owner's input** (hard rule 3). Kerf reports what a size gives, such as a 1/2" bolt's 1.75" leg edge distance under 4D, and does not pick another size.
- **Beam-ply bolts stay an area** for a built-up beam until there is a published source for their spacing along the beam. The owner's project uses a solid beam.

## Consequences
- Template version 6 and snapshot shape 6. Crossbars and gussets are about 3-1/4" longer in the worked example; the crossbars still come from one 10' 2x6.
- The crossbar and gusset ends project past the legs at about 3 to 8 feet up, where children reach. Their edges are eased like every other part, and the projection is a question for the experienced builder.
- With 4x4 legs and 1/2" bolts, the leg edge distance stays under 4D at both joints. The expert check states it; a 3/8" bolt or a 4x6 leg would meet it.
- Drawings (#90, #91) show holes rather than areas.
