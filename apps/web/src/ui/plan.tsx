import { FLAG_CATEGORY_LABELS, type Flag, structural } from '@kerf/core';
import { ExpertCheck, InputNeeded } from './feedback.tsx';
import { Changed, MarginLine, Measured } from './numbers.tsx';
import { PlainList } from './text.tsx';

// Pieces of a plan that more than one screen shows: its expert checks and the state of a
// structural check. They know core's flag and check shapes but no template (ARCHITECTURE.md,
// principle 6); every word and number in them comes from core.

/** A plan's or a step's expert checks, each labeled with its category (#43, rule 3). */
export function FlagList(props: { flags: readonly Flag[] }) {
  if (props.flags.length === 0) return null;
  return (
    <PlainList>
      {props.flags.map((flag) => (
        <li key={`${flag.category}/${flag.ask}`}>
          <ExpertCheck
            label={`Expert check · ${FLAG_CATEGORY_LABELS[flag.category]}`}
            why={<Measured text={flag.why} terms />}
          >
            <Measured text={flag.ask} terms />
          </ExpertCheck>
        </li>
      ))}
    </PlainList>
  );
}

/**
 * Where a structural check stands: its margin, input needed, or not computed with the reason. In a
 * preview, `was` is the saved plan's margin, or its words when it had none (#56).
 */
export function CheckStatus(props: { check: structural.CheckResult; was?: string }) {
  const { check, was } = props;
  switch (check.status) {
    case 'computed':
      return <MarginLine margin={structural.formatMargin(check.margin)} was={was} />;
    case 'input-needed':
      return (
        <p>
          {was === undefined ? (
            <InputNeeded />
          ) : (
            <Changed was={was}>
              <InputNeeded />
            </Changed>
          )}
        </p>
      );
    case 'not-computed':
      return (
        <p>
          <b>Not computed.</b> {check.reason}
        </p>
      );
  }
}
