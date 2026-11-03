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
| Joint-based parametric model (first) | #543 | Constraint solving, parametric modelling, designing a small language |
| Cut optimization | #544 | Cutting stock, integer programming, column generation |
| Frame analysis | #545 | The direct stiffness method, the basis of frame analysis software |
| Fabrication outputs | #546 | Full-size printed templates, DXF and G-code, 3D rendering |
| AI as author, code as verifier | #547 | Building gates and evals around generated code |

### Joint-based parametric model

A template becomes a declaration of parts, the joints between them, and constraints, and a solver turns it into geometry. The cut list, operations, fit tests, and diagram placements follow from the joints instead of being written in each template. Code goes in `packages/model` on `explore/joint-model`.

The goal is parity: both current templates, declared as joints, produce the same parts, lengths, end cuts, and placements as today's template code for every worked example, compared before display rounding. The design is proposed first (#548), in `docs/explorations/joint-model.md`.

### Cut optimization

Fit parts into buyable boards to use less lumber: the current grouping, then first-fit decreasing, then an exact method, compared on both templates. 2D cutting for sheet goods would follow a plywood template.

### Frame analysis

Analyse the whole frame for member forces, reactions, and sway. `PRODUCT.md` principle 2 keeps racking, connections, and tipping on the checklist, so this would only ever be a labeled exploratory view beside the sourced checks.

### Fabrication outputs

Full-size printable templates for angled cuts and gussets, DXF or G-code for a CNC router, and a real 3D view or hidden-line removal for the isometrics.

### AI as author, code as verifier

A model drafts a template from photos and a brief (extending 0019), and Kerf's existing gates decide whether it is accepted. The model writes code that is checked and never supplies numbers (hard rule 1). The explanation layer from `PRODUCT.md` belongs here too.

## Considered and set aside for now

A fork of the repository, which would allow revisiting the one-user and no-offline choices (local-first sync would reverse 0005). The owner chose the same repository, since the joint model needs neither.
