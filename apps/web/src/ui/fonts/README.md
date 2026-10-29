# Fonts

Atkinson Hyperlegible Next and Atkinson Hyperlegible Mono, version 2.001, by Applied Design Works with the Braille Institute (decision 0015). Licensed under the SIL Open Font License 1.1; each font's license is beside it.

| File | Source | Size |
|---|---|---|
| `AtkinsonHyperlegibleNext-Latin.woff2` | `ofl/atkinsonhyperlegiblenext/AtkinsonHyperlegibleNext[wght].ttf` | 33.6 kB |
| `AtkinsonHyperlegibleMono-Latin.woff2` | `ofl/atkinsonhyperlegiblemono/AtkinsonHyperlegibleMono[wght].ttf` | 17.5 kB |

Both are from the Google Fonts repository, `github.com/google/fonts`, at commit `95f4904`. The `.ttf` files there have SHA-256 `5a455d1c…` (Next) and `5ce8b169…` (Mono).

## How they were made

With fontTools 4.68.0 and brotli (a Python virtual environment outside the repository; nothing is added to the project):

```bash
U="U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD"
pyftsubset "AtkinsonHyperlegibleNext[wght].ttf" --unicodes="$U" --layout-features+=tnum,frac,zero,case --flavor=woff2 --output-file=AtkinsonHyperlegibleNext-Latin.woff2
pyftsubset "AtkinsonHyperlegibleMono[wght].ttf" --unicodes="$U" --layout-features+=tnum,frac,zero,case --flavor=woff2 --output-file=AtkinsonHyperlegibleMono-Latin.woff2
```

The Unicode ranges are Google Fonts' "latin" subset. They keep the degree sign, the multiplication sign, curly quotes, dashes, the ellipsis, and the minus sign. The layout features keep pyftsubset's defaults plus tabular figures, fractions, the slashed zero (Mono only), and case-sensitive forms.

Neither font has prime marks (′ ″); they fall back to the system font. Kerf prints straight foot and inch marks, as core formats them, so nothing on screen uses primes.

To update the fonts: download the new version from the same repository, run the same commands, and record the new version and commit here and in decision 0015.
