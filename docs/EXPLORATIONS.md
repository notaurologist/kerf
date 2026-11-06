# Explorations

Status: Draft v0.1 (November 2026)

Kerf's MVP is in place. These are larger directions the owner chose to keep for learning, beyond what the swing set and record cabinet need. They sit outside the milestone order in `MILESTONES.md`: their issues carry the `exploration` label and the Explorations milestone, and agents do not pick them up unless the owner names one.

## Keeping the deployed app apart

- Only `main` deploys (`vercel.json`), and production secrets exist only in Vercel's Production environment, so a branch cannot reach the live app or its database.
- An exploration's code lives in its own package and on its own long-lived branch (`explore/<name>`). Its pull requests target that branch, not `main`.
- Nothing in `apps/api` or `apps/web` imports an exploration's package until the owner decides to adopt it, with a decision record.
- The hard rules in `AGENTS.md` apply to explorations as to everything else. An exploration that would change one asks first.

## Directions

| Direction | Issue | What it teaches |
|---|---|---|
| Joint-based parametric model (first; adopted, decision 0020) | #543 | Constraint solving, parametric modelling, designing a small language |
| Cut optimization (done; adopted, decision 0021) | #544 | Cutting stock, integer programming, column generation |
| Frame analysis (done; push adopted as statics, 0022) | #545 | The direct stiffness method, the basis of frame analysis software |
| Fabrication outputs (done; adoption after the printed check) | #546 | Full-size printed templates, DXF and G-code, 3D rendering |
| AI as author, code as verifier | #547 | Building gates and evals around generated code |

### Joint-based parametric model

Adopted in decision 0020 (November 4, 2026). Templates now place their parts and declare the joints between them, and the joints in `packages/core/src/joints/` give each part's length, end cuts, and features, and each bolt's grip. All three templates are written this way.

The exploration asked whether a template could be a declaration of parts and the joints between them, with the geometry following from the joints instead of being written in each template. Its code was `packages/model` on `explore/joint-model`, which is kept and not merged. The owner chose joints declared between placed parts over a constraint solver (#548). Both existing templates reached parity with their hand-written versions, and the workbench, built joint-first, was the deciding test. `docs/explorations/joint-model.md` is the record: the design, the parity sweep and what it found, the workbench's measures, and what came to `main`.

### Cut optimization

Done, November 4, 2026; adopted in decision 0021 (#677), with the work in the Cut optimization adoption milestone (#684 to #686). The exploration asked how far the shopping list's grouping, first-fit decreasing, is from the fewest feet of lumber that hold the same pieces. Its code is `packages/cutting` on `explore/cut-optimization`, not merged: a material bound, the linear relaxation by column generation with a simplex and knapsack written in the package, and branch-and-bound over boards. On 260 instances from all three templates the grouping buys 2.0% more than the exact method, which proves 253 of them optimal. The gain is in board stock (6% of the cherry on the record cabinet's worked example, 2.6% on the workbench's), and the swing set barely changes. `docs/explorations/cut-optimization.md` on that branch is the record: the method, the results, where the time went, and what adopting it would take. 2D cutting for sheet goods would follow a plywood template.

### Frame analysis

Analyse the whole frame for member forces, reactions, and sway. `PRODUCT.md` principle 2 keeps racking, connections, and tipping on the checklist, so this would only ever be a labeled exploratory view beside the sourced checks.

Done, November 5, 2026. Its code is `packages/frame` on `explore/frame-analysis`, not merged, with no new dependency: plane and space frame elements and a Cholesky solver written in the package, checked against McGuire, Gallagher and Ziemian, one A-frame and then the whole swing set in 3D, with bolted joints run pinned and rigid, and a sweep over the template's examples and seeded draws. Where it overlaps the per-member checks it agrees with them. It finds that the swing's push toward the front and back, which the leg check leaves out, loads one leg well over the check's load at narrow splays. Along the beam the result depends mostly on the joint assumption, and on pads with pinned joints the frame is a mechanism. No source gives a load along the beam or a sway limit, so none of that becomes a margin. `docs/explorations/frame-analysis.md` on that branch is the record. It proposes adding the push to the leg check as statics, cross-checked against the analysis, and not showing the analysis in the app. The owner adopted that on November 6, 2026 (decision 0022): the leg check takes the push by statics, which read up to 2.17% under the frame analysis for buried legs and up to 4.52% under it on pads, and the checklist's racking item says what holds the frames along the beam. The analysis itself stays on its branch.

### Fabrication outputs

Full-size printable templates for angled cuts and gussets, DXF or G-code for a CNC router, and a real 3D view or hidden-line removal for the isometrics.

Done, November 5, 2026. Its code is `packages/fabrication` on `explore/fabrication`, not merged, with no new dependency: full-size templates tiled across letter pages with a check square and registration marks, end templates for long parts, hole centers and joinery marks, a DXF per part, and hidden-line removal for the isometric and exploded views. The owner chose DXF without G-code unless a CNC router arrives, hidden-line removal before any WebGL view, and letter paper only (#546). `docs/explorations/fabrication.md` on that branch is the record and proposes adopting the full-size templates once the owner prints the gusset and it measures true.

### AI as author, code as verifier

A model drafts a template from photos and a brief (extending 0019), and Kerf's existing gates decide whether it is accepted. The model writes code that is checked and never supplies numbers (hard rule 1). The explanation layer from `PRODUCT.md` belongs here too.

## Considered and set aside for now

A fork of the repository, which would allow revisiting the one-user and no-offline choices (local-first sync would reverse 0005). The owner chose the same repository, since the joint model needs neither.
