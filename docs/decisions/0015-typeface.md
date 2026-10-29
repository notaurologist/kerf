# 0015: Atkinson Hyperlegible, self-hosted

Status: Accepted (October 2026)

## Context
Numbers are most of what Kerf shows, and the shop modes are read at arm's length and from across a bench in poor light (`docs/design/README.md`, stages 2 and 3). Design stage #42 measured each candidate typeface from its font files and compared three directions: Atkinson Hyperlegible, B612, and the system font. The system font cannot be bundled (Apple's license limits SF Pro to Apple devices), so a printed plan would change face from one computer to another. A web font is a new dependency, which needs the owner's permission (AGENTS.md, hard rule 13).

## Decision
- **Typeface:** Atkinson Hyperlegible Next for all text and numbers, with tabular figures where numbers align; Atkinson Hyperlegible Mono for formulas. Both by Applied Design Works with the Braille Institute, designed so similar characters are distinct for low-vision readers.
- **Version and source:** version 2.001 of both, from the Google Fonts repository (`ofl/atkinsonhyperlegiblenext` and `ofl/atkinsonhyperlegiblemono`, commit `95f4904`). License: SIL Open Font License 1.1.
- **Self-hosted:** the variable fonts subset to Latin and saved as `woff2` (about 30 KB and 15 KB) in `apps/web`, with the license file beside them. No npm package and no request to Google Fonts at runtime.
- **Fallback:** `system-ui, sans-serif` and `ui-monospace, monospace`.
- The owner approved adding the font in #42.

## Consequences
- Updating the font is a manual step: download the new version, subset it the same way, record the new version here.
- The subset keeps the features Kerf uses (`kern`, `liga`, `calt`, `tnum`, `frac`, `zero`, `case`) and the characters it prints, including primes, the degree sign, and the multiplication sign. Characters outside the subset fall back to the system font.
- Shop sizes are set from this face's measured digit height (0.694 of the font size): read 20 px, glance 51 px on a phone. Changing the typeface means redoing them.
