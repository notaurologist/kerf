import { WORDMARK } from './wordmark-outline.ts';

// Kerf's wordmark (#166, docs/design/brand.md): "kerf" in Atkinson Hyperlegible Next at bold with
// the k's top cut at 45°, outlined so its spacing and cut are fixed. It is sized in em to match the
// type it replaces, sits on the text baseline (the e's overshoot hangs below it, set in
// components.css), and takes the current text color. Its name is "Kerf".

const EM = 1000;
const { width, top, overshoot } = WORDMARK;

export function Wordmark() {
  return (
    <svg
      className="k-wordmark"
      role="img"
      aria-label="Kerf"
      viewBox={`0 ${-top} ${width} ${top + overshoot}`}
      width={`${width / EM}em`}
      height={`${(top + overshoot) / EM}em`}
      focusable="false"
    >
      <path fill="currentColor" d={WORDMARK.d} />
    </svg>
  );
}
