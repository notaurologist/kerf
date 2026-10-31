# Content guide

How Kerf's text is written: method text, common mistakes, expert checks, checklist items, errors, buttons, and everything else on screen or in print. Chosen in #68 (October 2026); the reasons and rejected voices are in `README.md`, Stage 5b, and the samples are in `words.html`.

Numbers in the examples are strings from the swing set's worked example (`snapshots/v2.json`, the first example). M6's method and flag text is written against this guide. When a pattern here does not fit a new kind of text, add one here in the same change.

## What no text changes

- **Numbers come from core.** Text never contains a number core did not produce, and never rounds or rewrites one (hard rules 1 and 4). The words around a number carry the voice; the number does not.
- **Margins, not verdicts.** "margin 1.1x under these assumptions", never safe, unsafe, pass, fail, or an adjective that judges (hard rule 2).
- **Nothing filled in.** Text never suggests a value for a structural input or calls one a default (hard rule 3).
- **Generic tools.** Tool types, never brands or products (hard rule 11).
- **Angles with their reference.** "Saw at 20.0°" or "20.0° to the edge", never a bare "20° cut" (DOMAIN.md, Units).
- **Sources stay.** Safety-relevant text keeps its source and page, such as "(CPSC Pub. 324, p. 3)" (hard rule 5).

## Voice

The shop voice: plain and direct.

- Write to the reader as "you", in the active voice, with the verb first in instructions.
- Kerf is "Kerf" when it says what it did ("Kerf could not reach the server"), never "we" or "I".
- Write "cannot", not "can't".
- Sentence case everywhere, including buttons and headings.

## Two registers

Everything a person acts on (steps, methods, flags, checklist items, errors, buttons) is in the shop voice. The structural working (assumptions, formulas, intermediate steps, factor reasons) keeps its exact, impersonal register, because it is a record of a calculation: "Supported at the two frame centerlines, 13-3/4" and 106-1/4" from the left end."

## Patterns

**Method steps.** One action per step: the verb, then the number, then the reference ("from the top cut", "on the outside face"). A reason, if the step needs one, follows in its own sentence.

> Set the miter saw to 20.0°.
> From the top cut, mark 130-1/4" along each edge.

**Common mistakes.** The mistake as it happens, then how to avoid it, in two sentences.

> Marking the overall length, 131-1/2", along an edge leaves the leg too long. Mark 130-1/4" along each edge from the top cut.

**Numbers in method text.** A method is written once for every part, so it names the operation's numbers as `{setting}`, `{thickness}`, and so on, and core fills them in (`knowledge/methods.ts`). The sentence reads the same with the number in place: "Set the miter saw to {setting}, turned the way the cut detail shows."

**Safety notes.** The hazard as it happens, then what to do about it, with the source. No signal word in front.

> A circular saw kicks back toward you when the blade pinches in the cut. Support the board and both pieces of it, so neither drops into the blade as the cut finishes, and keep your hands out of the line of the cut. (OSHA Woodworking eTool, Handheld Circular Saws)

**Expert checks.** The label "Expert check", then what to ask an experienced builder, as "Ask whether..." or "Confirm...", naming the numbers involved. Then "Why:" and one sentence on what the element does. Never the answer, never "make sure it is fine".

> **Expert check** Ask an experienced builder whether 24" is deep enough for your soil, and whether the leg lumber is rated for ground contact.
> Why: buried legs keep the frame from lifting and walking, and wood decays fastest at the ground line.

**Checklist items.** The element, then what to confirm, then why: the three parts core already produces.

**Margins.** "margin 1.1x under these assumptions", with no adjective, no color (#43, rule 1), and no comparison word such as "only" or "plenty". The page says once what a margin is.

**Input needed.** "Input needed", then the input's name, then what it decides.

> Input needed: deflection limit. It decides the deflection check.

**Errors.** Say what to enter, not what went wrong; name the field; give a limit in the plan's own format (#67). No blame.

- Empty required field: "Enter a project name."
- Out of range: "Beam height must be from 5' 0" to 12' 0"."
- Not readable: the format, with an example (#67's messages).

**Connection and server problems.** What happened, from Kerf's side, what to do next, and what is kept.

> Not saved. Kerf could not reach the server. Your changes are still here.

**Empty screens.** What is missing, then how to start.

> No projects yet. Start one with a New button above.

**Buttons and links.** A verb and the thing it acts on, the same words for the same action everywhere: "Save changes", "Delete project", "Start building". A destructive button names what it destroys.

**Status.** Short, saying what is happening or happened: "Saving…", "Saved.", "Loading project…". The ellipsis is one character.

**Definitions.** A glossary entry (`knowledge/glossary.ts`) is the term, then one or two sentences: what the thing is, then, if the reader needs it, where Kerf shows it or how to work with it. No "a term for", no "refers to", and no examples a reader could mistake for a value.

> **Long point** The end of an angled cut where the part is longest. A part's length in the cut list is measured from long point to long point.

Text marks only the first use of a term on a screen, not every use. Each plan section, each Building step, and each other screen is its own screen for this. The text that takes part: section intros, flags, check names and load cases, the confirmation checklist, the cut list's end cuts, the shopping list's notes and board selection guides, and method setup, technique, and common mistakes. Text inside a closed disclosure, such as "Show the working", is not marked, so it cannot claim a first use while hidden. A term inside a tool's name ("miter saw", "sliding bevel") is the tool, not the term, and is never marked. On paper no definition can open, so the printed plan ends with "Terms used in this plan": every term its text uses, alphabetical, with its definition.

**Headings.** Nouns for what the section holds: "Cut list", "Structural review", "Beam".

## Word list

Use DOMAIN.md's terms, the same way every time: part, stock, board, offcut, end cut, saw at (setting), angle to the edge, long point, grip, method, tool type, build step, plan, template, regenerate, margin, structural check, Expert check, Input needed.

| Never | Why |
|---|---|
| safe, unsafe, pass, fail; OK, good, fine, strong enough, adequate, plenty, only (about a structural result) | Hard rule 2: margins, not verdicts. |
| approved, certified, code-compliant, engineered, guaranteed | Kerf is not an engineer and does not check codes. "Not an engineered design" is the one use of "engineered". |
| warning, danger, caution as labels | The ANSI Z535 hazard signal words (#43). A flag is a question for an experienced builder, labeled "Expert check". |
| default, suggested value (for a structural input) | Hard rule 3: nothing is filled in. |
| invalid, error, oops (in messages to the reader) | Say what to enter instead (NN/g, GOV.UK). |
| simply, just, easy, obviously, please | Filler; what is easy for one person is not for another (Google developer documentation style guide). |
| sanity check | Vague about what is checked (Google developer documentation style guide). Say "structural check". Decision 0001 keeps its original wording. |
| brand or product names | Hard rule 11. |

Approximation words ("about") appear only where core marks a value as approximate, such as the offcut after saw cuts.

## Sources

- digital.gov, [Writing for understanding](https://digital.gov/guides/plain-language/writing) (formerly plainlanguage.gov): active voice, direct address.
- GOV.UK Design System, [Error message](https://design-system.service.gov.uk/components/error-message/).
- NN/g, [Error-message guidelines](https://www.nngroup.com/articles/error-message-guidelines/) and [The four dimensions of tone of voice](https://www.nngroup.com/articles/tone-of-voice-dimensions/).
- Google developer documentation style guide, [word list](https://developers.google.com/style/word-list).
- CPSC, [Outdoor Home Playground Safety Handbook](https://www.cpsc.gov/s3fs-public/324.pdf), p. 5, for imperative checks written to a builder.
