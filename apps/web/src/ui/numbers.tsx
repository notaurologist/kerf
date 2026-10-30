import { findTerms, type GlossaryId } from '@kerf/core';
import { Fragment, type ReactNode } from 'react';
import { Term, useEntryHref, useFirstUses } from './Term.tsx';

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
 * core formatted it, with each length and angle kept on one line. With `terms`, the first use of
 * each glossary term in the scope opens its definition (`Term`).
 */
export function Measured(props: { text: string; terms?: boolean }) {
  const uses = props.terms ? findTerms(props.text) : [];
  const marked = useFirstUses(uses);
  const entryHref = useEntryHref();
  const parts: (string | { measure: string } | { term: GlossaryId; words: string })[] = [];
  let last = 0;
  const spans = [
    ...[...props.text.matchAll(MEASURE)].map((m) => ({
      start: m.index,
      end: m.index + m[0].length,
      part: { measure: m[0] },
    })),
    ...[...marked].map((u) => ({
      start: u.start,
      end: u.end,
      part: { term: u.id, words: props.text.slice(u.start, u.end) },
    })),
  ].sort((a, b) => a.start - b.start);
  for (const span of spans) {
    if (span.start > last) parts.push(props.text.slice(last, span.start));
    parts.push(span.part);
    last = span.end;
  }
  if (last < props.text.length) parts.push(props.text.slice(last));
  return (
    <>
      {parts.map((part, i) =>
        typeof part === 'string' ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: parts of one fixed string, in order.
          <Fragment key={i}>{part}</Fragment>
        ) : 'measure' in part ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: parts of one fixed string, in order.
          <Length key={i}>{part.measure}</Length>
        ) : entryHref ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: parts of one fixed string, in order.
          <Term key={i} id={part.term} href={entryHref(part.term)}>
            {part.words}
          </Term>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: parts of one fixed string, in order.
          <Fragment key={i}>{part.words}</Fragment>
        ),
      )}
    </>
  );
}

/**
 * A part's letter, as the cut list and every drawing show it (#44, #66): a dark square with eased corners
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
