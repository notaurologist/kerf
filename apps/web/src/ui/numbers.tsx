import { Fragment, type ReactNode } from 'react';

// Numbers as #42 sets them. Every value here is a string core formatted (hard rule 1); these
// components only decide how it is shown.

/** A length or angle that never breaks across lines: browsers break at the hyphen in 138-3/8. */
export function Length(props: { children: string }) {
  return <span className="k-length">{props.children}</span>;
}

/**
 * A value core formatted with a second reading in parentheses, such as `92.5 in (92-1/2")`. Each
 * reading stays on one line, and a narrow column can break between them (#152).
 */
export function Readings(props: { text: string }) {
  const at = props.text.indexOf(' (');
  if (at < 0) return <Length>{props.text}</Length>;
  return (
    <>
      <Length>{props.text.slice(0, at)}</Length> <Length>{props.text.slice(at + 1)}</Length>
    </>
  );
}

const MEASURE = /\d+' \d+(?:-\d+\/\d+)?"|\d+(?:-\d+\/\d+)?"|\d+\/\d+"|\d+(?:\.\d+)?°/g;

/**
 * Text from core with lengths and angles in it, such as `Each edge: 130-1/4"`, shown exactly as
 * core formatted it, with each length and angle kept on one line.
 */
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
          <Length key={i}>{part.measure}</Length>
        ),
      )}
    </>
  );
}

/**
 * A part's letter, as the cut list and every drawing show it (#44, #66): a dark rounded square
 * with the letter in the page color. The letter comes from core; it is read out as written.
 */
export function PartLetter(props: { children: string }) {
  return <span className="k-part-letter">{props.children}</span>;
}

/** The length you cut to, readable from across the bench: 51 px bold (#42, glance distance). */
export function Glance(props: { children: string }) {
  return <span className="k-glance">{props.children}</span>;
}

/**
 * A saw setting with the angle to the edge (#42, DOMAIN.md, Units): never the same size. The
 * setting is larger, bold, and boxed; the edge angle smaller and labeled.
 */
export function SawSetting(props: { setting: string; toEdge: string }) {
  return (
    <div className="k-saw">
      <div className="k-saw__setting">
        <span className="k-saw__label">Saw at</span>
        <b>{props.setting}</b>
      </div>
      <div className="k-saw__edge">
        <span className="k-saw__label">To the edge</span>
        <span>{props.toEdge}</span>
      </div>
    </div>
  );
}

/**
 * A structural margin: "margin 1.1x under these assumptions", in the text color (#43, rule 1).
 * In a preview, `was` is the saved plan's margin, or its words when it had none (#56).
 */
export function MarginLine(props: { margin: string; was?: string }) {
  return (
    <p className="k-margin" data-changed={props.was !== undefined ? '' : undefined}>
      {props.margin} under these assumptions
      {props.was !== undefined && <Was text={props.was} />}
    </p>
  );
}

/**
 * A value in a preview that differs from the saved plan (#56), with the saved value under it in
 * words, so the change never rests on the mark alone. `was` is null for a value the saved plan
 * did not have.
 */
export function Changed(props: { was: string | null; children: ReactNode }) {
  return (
    <span className="k-changed">
      {props.children}
      {props.was === null ? <span className="k-was">new</span> : <Was text={props.was} />}
    </span>
  );
}

function Was(props: { text: string }) {
  return (
    <span className="k-was">
      was <Measured text={props.text} />
    </span>
  );
}
