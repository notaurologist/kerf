# Brand

Kerf's wordmark and icons, chosen in #166. How they were reached, with the directions set aside, is in `brand.html` (three rounds) and in `README.md`, Stage 8.

## The wordmark

"kerf" in lowercase, in Atkinson Hyperlegible Next at weight 700 (decision 0015), with one change: the top of the k's stem is cut at 45° from square, high on the right, the way a board's end is cut at a miter-saw setting. The cut drops by exactly the stem's width.

The letters are outlined, not set as text, so the spacing and the cut stay fixed wherever it appears. The spacing starts from the font's own kerning and evens the gaps at display size (in font units, 1000 to the em):

| Pair | Font's kerning | Wordmark |
|---|---|---|
| k–e | −32 | −30 |
| e–r | 0 | −14 |
| r–f | +30 | +22 |

In the app, use the `Wordmark` component (`apps/web/src/ui/Wordmark.tsx`). It is sized in em, so it takes the size of the type around it, sits on the text baseline, takes the current text color, and is named "Kerf" to assistive technology. It is used in the header (at 29 px, so the k is 20.5 px tall) and as the heading of the login and connection screens. In running text, the name is written "Kerf", as a word.

## The icon

The k alone, with the same cut. At small sizes it is fitted to a 16-unit grid: the stem is 3 units wide (x 3 to 6), the top of the arm sits on the x-height at y 5, the stem's top reaches y 1, and the cut drops 3 units. Every straight edge then lands on whole pixels at 16 and 32 px. Larger copies (the home-screen icon) use the font's outline.

## Files

All in `apps/web/public`, linked from `apps/web/index.html`, and made by `brand/make_brand.py` (how to run it is at the top of the script):

| File | What it is | Where it is used |
|---|---|---|
| `favicon.svg` | The fitted k, graphite in a light system theme and chalk in a dark one | Browser tabs in browsers that support SVG icons |
| `favicon.ico` | The fitted k on a paper tile, 32 and 16 px | Browsers without SVG icons. The tile keeps it visible on a dark tab bar, since an ICO cannot change color. |
| `apple-touch-icon.png` | 180 px, the k on paper, 60% of the height | A phone's home screen. Opaque, since iOS fills transparency with black; iOS rounds the corners. |
| `og.png` | 1200 by 630, the wordmark and "Plans for woodworking projects" | The preview when a link is shared. `index.html` names it by its production URL, as link previews need an absolute address. |
| `../src/ui/wordmark-outline.ts` | The wordmark's outline | The `Wordmark` component |

The icons for installable web apps (192 and 512 px, and a manifest) are left out: installable web apps are a non-goal in `PRODUCT.md`.

To change the wordmark or icons, change the script and run it again; never edit the generated files.

## Use

- **Color.** The text color only: graphite on light, chalk on dark. Not the accent blue, which marks links and input in the app (#43).
- **Clear space.** Keep at least the width of the k's stem clear on every side. In the header, the header's own padding gives more.
- **Minimum size.** The wordmark's k at least 12 px tall (the wordmark at about 17 px type). Below that, use the icon.
- **Do not** stretch, outline, or add effects to it, set "kerf" in the font as a stand-in, or bring back the directions set aside in `brand.html` (the slot through the k, the saws).
