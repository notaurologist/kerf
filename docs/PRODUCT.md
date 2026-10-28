# Product Spec

Status: Draft v0.5
Name: Kerf (the width of material a saw blade removes)

## Overview

A personal planning tool for woodworking projects. Pick a project template, set its dimensions and choices, and the app generates everything needed to build it: a cut list, a shopping list including hardware, isometric and exploded diagrams, and step-by-step methods adapted to the tools I own. It flags the steps worth checking with someone experienced, and suggests (generically) when another tool would make a step easier.

The model is Fitbod for woodworking: it knows my inventory and the projects I've built, and plans around them.

## Audience

Me (Jason), for the foreseeable future. I have some experience building rudimentary projects, and access to experienced amateur and professional woodworkers for specific questions. Not designed for other users: no accounts, onboarding, sharing, or polish beyond what I need.

## Core principles

1. **Geometry is deterministic.** Every dimension, angle, and quantity comes from template math, never from AI. Wrong dimensions waste wood; the numbers must be exact and reproducible.
2. **Structural checks are transparent sanity checks, not engineered designs.** The app computes what is well understood (beam bending, deflection, shear, and hardware load vs. rating) and shows every input, formula, assumption, adjustment factor, and source. What is hard to compute reliably (connections, racking, tipping, anchoring) goes on a confirmation checklist instead. Final structural decisions rest with me, experienced people, and manufacturer specifications.
3. **Flag what warrants an expert check.** Steps and design choices in known risk categories (see `DOMAIN.md`) carry a visible flag saying what to ask about and why.
4. **Plans adapt to my tools.** Each operation (for example, an angled crosscut) can be done several ways. The app picks methods my inventory supports and explains them.
5. **Tool suggestions are generic.** "A miter saw would make these angle cuts faster and more repeatable," not specific products or brands.

## Engineering approach

- **Do it the correct way, even when it takes longer.** Choose the approach that holds up (a real backend, sourced and versioned data, tested geometry) over the quickest one that works today.
- **Do not overengineer.** Build what the current milestone needs. Leave room for known later features (offline mode, more templates, project references) without building them early.
- **Work in increments.** Each milestone is small, usable, and verified before the next one starts.

## First template: two-swing A-frame swing set

For our backyard: two swings, used by kids (7 and 10) and adults.

### Parameters (user-set)

- Top beam length and height
- Leg splay angle (or footprint width, deriving the angle). Legs splay in one plane, perpendicular to the beam; no outward lean along the beam, so end cuts are single angles, not compound.
- Lumber sizes for beam, legs, and braces. The top beam is a single solid member, or two or three 2x boards fastened face to face (a built-up beam, decision 0012).
- Joinery approach: metal A-frame brackets vs. cutting and bolting the angles directly
- Swing hanger type and positions. Each swing hangs from two hangers; positions do not have to be symmetric.
- Swing chain or rope length and seat height
- Bracing style
- Anchoring method

### Derived outputs

- Leg lengths, end cut angles, and brace dimensions and angles
- Cut list and shopping list (lumber in buyable lengths, plus hardware)
- Isometric view (assembled), exploded view, cut details for angled parts
- Site layout plan showing footprint and clearance areas
- Build steps with methods, skills, flags, and tool suggestions

## MVP features

1. **Tool inventory.** A list of tool types I own (for example, circular saw, drill/driver, speed square), with relevant capabilities where they matter (for example, whether a saw bevels). Edited by hand.
2. **Project from template.** Choose a template, set parameters, see validation for out-of-range or contradictory values. Each project records the template version it was generated with, and shows a notice if the current template would produce different numbers.
3. **Cut list.** Every part: name, stock (nominal and actual size), length, end cuts (miter and bevel angles), quantity. Fractions to 1/16 inch. Angles are shown as miter-saw settings (0° = square) with a small diagram of the reference face, plus the angle to the board's edge (90° minus the setting) for laying out with a protractor or sliding bevel.
4. **Shopping list.** Lumber grouped into buyable board lengths (simple grouping, not optimization), with allowance for saw kerf on each cut and for trimming factory ends. Hardware with quantities, consumables (finish, fasteners).
5. **Diagrams.** Isometric assembled view, exploded view, per-part cut details with angles, site layout with clearances. Generated from template geometry. Printable.
6. **Build steps.** Ordered steps, each listing its operations; for each operation, the method chosen from my inventory, skills involved, expert-check flags, and optional generic tool suggestions. Method content is written for the tools I own, plus one alternative per operation to support tool suggestions.
7. **Structural review.** Two parts, generated from the template and its parameters:
   - **Confirmation checklist:** specific items to confirm with an experienced builder, tied to the design (for example, "Top beam spans 10 ft carrying two swings: confirm beam size for adult use," "Leg-to-beam bolts carry swing loads: confirm bolt size, spacing, and edge distance").
   - **Sanity checks:** computed loads and margins for beams and rated hardware, with the full calculation visible and expandable. Results read as "margin 2.1x under these assumptions," never "safe." Inputs the user must supply or confirm (lumber species and grade, rider weights, dynamic factor, deflection limit) are explicit, with no hidden defaults.
8. **Project history.** Projects have a status (planned, in progress, built) and record the operations, methods, and skills each one used. In the MVP this is recorded data; later projects use it to refer back (see After the MVP).
9. **Shop-friendly.** Readable on a phone or tablet in the garage: large text, steps one at a time. Assumes reliable internet in the shop; a project that is already open stays readable if the connection drops briefly.

## Data and storage

Persisted data includes the tool inventory, projects (past, current, and planned) with their parameters, template versions, status, and the operations and methods used, structural check inputs, and settings, with photos and journal entries later.

- **Backend from the start:** a small Hono API with Postgres, matching the rowing app. The same data is available on the laptop (design) and the phone or tablet (shop) from day one; no browser-only storage and no sync layer.
- **All access goes through one data layer** (a repository interface) on the server, so the storage behind it can change without touching the rest of the app.
- **Single-user authentication.** The API is reachable from my devices, so it needs a login, but there is no account system: one user, configured at deploy time.
- **Access control lives in API code,** not database policies.
- **Backups** come from Postgres (scheduled dumps or the host's backups). A JSON export of projects and inventory is a nice-to-have, not an MVP requirement.
- **Not using hosted backend services** like Supabase or Firebase. Their database-level access rules are harder to reason about and test than plain API code.

## Non-goals (MVP)

- Free-form CAD or modeling. Templates only.
- Connection design, racking, tipping, or anchoring calculations (checklist only).
- Certifying loads or replacing manufacturer ratings.
- Brand- or product-specific recommendations.
- AI-generated dimensions or diagrams.
- Accounts, sharing, other users.
- Cut optimization (fitting parts into boards to minimize waste).
- Native apps and installable web apps (PWA).
- Offline use (see After the MVP).

## After the MVP (candidates)

- More templates: workbench, bookshelf, box, cutting board, outdoor bench.
- References to past projects: when a step uses a method or skill I've used before, the step points back to it ("you cut these angles on the swing set legs"). Built on the project history recorded in the MVP.
- Skill progression (the Fitbod-like part: what I've done, what to try next).
- Cut optimization for board yield.
- Read-only offline mode for build steps, using a service worker without installing the app, if shop connectivity turns out to be unreliable. To keep this possible without restructuring, the API returns a project as one complete snapshot (parameters, template version, and generated outputs) rather than requiring many small requests to render it.
- An AI explanation layer: answering questions about a step or technique, grounded in the knowledge base and clearly labeled, never the source of dimensions.
- Project journal with photos and notes.

## Success criteria

- I build the swing set with my dad from the app's plans.
- The cut list and diagrams match what we actually built, with no recuts from wrong numbers.
- One trip to the store covers the shopping list.

## Resolved questions

The questions this section used to list are settled in `docs/decisions/`:

- Stack: 0002, 0003, 0004.
- Hosting: 0006. Login: 0007.
- Rendering: SVG (0004).
- Knowledge base format: typed data in the repository (0009).
- Template authoring: TypeScript functions (0008).

## Open questions

- Target date for building the swing set, which sets the milestone pace.
