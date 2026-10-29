import { Fragment } from 'react';

// Text from core with lengths and angles in it, such as `Each edge: 130-1/4"`. A browser may break
// a line at the hyphen in 130-1/4", which reads as two numbers, so each length and angle is kept
// on one line. The text itself is shown exactly as core formatted it.

const MEASURE = /\d+' \d+(?:-\d+\/\d+)?"|\d+(?:-\d+\/\d+)?"|\d+\/\d+"|\d+(?:\.\d+)?°/g;

export function Measured(props: { text: string }) {
  const parts: (string | { measure: string })[] = [];
  let last = 0;
  for (const match of props.text.matchAll(MEASURE)) {
    const at = match.index ?? 0;
    if (at > last) parts.push(props.text.slice(last, at));
    parts.push({ measure: match[0] });
    last = at + match[0].length;
  }
  if (last < props.text.length) parts.push(props.text.slice(last));
  return (
    <>
      {parts.map((part, i) =>
        typeof part === 'string' ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: parts of one fixed string, in order.
          <Fragment key={i}>{part}</Fragment>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: parts of one fixed string, in order.
          <span key={i} className="nowrap">
            {part.measure}
          </span>
        ),
      )}
    </>
  );
}
