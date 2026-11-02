# 0019: Templates are made in Claude Code, starting from the owner's pictures

Status: Accepted (November 2026, #100). Amends 0008.

## Context
The owner wanted to make new templates without writing code: share pictures of something they like, clarify it, agree on a design, and have it become a template. #100 asked whether that should happen inside the app, which would mean revisiting 0008.

A template is about 3,000 lines of TypeScript besides its tests. Most of it isn't dimensions: refusals, structural checks, starting questions, the form, build-step order, exploded-view directions, worked examples, and snapshot upgrades. All of it is checked against hand-worked examples (hard rule 9).

Three ways to do it in the app were considered (research on #100):

- **Composed from parts:** a template as data built from generic blocks, as in PolyBoard's parametric cabinets. It can't express what the blocks don't cover, such as the swing set's splayed legs.
- **A formula language,** as in SketchUp Dynamic Components or Fusion parameters. It covers dimensions, but checks, steps, questions, and versions would each need their own editor, and covering both templates grows toward a full language, as Onshape's FeatureScript did.
- **An AI model in the app** reading pictures and writing the template. The app would have to call the Claude API, which is billed per token apart from the owner's subscription. Reading pictures costs little, but writing and testing a template takes many long sessions, which the owner judged too costly. Code written in the app would also reach a cut list with no review or tests.

## Decision
- Templates stay TypeScript in `packages/core/src/templates/<template-id>/` (0008 is otherwise unchanged).
- They are made in Claude Code, under the owner's subscription, with the `kerf-template` skill. The skill starts from the owner's pictures when there are any: describe what they show, ask for one real size to scale from, check whether an existing template already covers it, and agree on a sketch before the spec.
- They reach the app by pull request and deploy, like any other change.
- Nothing in the app makes templates, so there is no milestone for it.

## Consequences
- Hard rules 1 and 9 hold unchanged: every number comes from reviewed, tested template code.
- Proportions read from a picture are suggestions with the `example` basis, recorded in the spec as from the owner's photo. Absolute sizes come from the owner or from scaling to one size they give.
- Each new template still needs the owner's review at the skill's stops, so it takes days, not minutes.
- The more an existing template covers, the more often a picture becomes a project instead of a template. Generalizing templates into families (a case for bookshelves and boxes, a leg-and-apron frame for benches and workbenches) is a candidate in `PRODUCT.md`, not decided here.
- If a cheap, reviewable way to do this in the app appears later, a new record supersedes this one.
