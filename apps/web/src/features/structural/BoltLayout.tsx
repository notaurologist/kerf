import { formatLength, jointSuggestions, type SuggestedItem, structural } from '@kerf/core';
import {
  Length,
  List,
  MeasureTable,
  PlainList,
  Readings,
  ResultLine,
  Row,
  Rows,
  Stack,
  Text,
} from '../../ui/index.ts';
import { SourceToggle } from './Citation.tsx';

// Bolt distances at each joint (#93, decision 0016): where Kerf put each bolt, and the NDS 2024
// rows each distance is measured against. Geometry for the conversation with an experienced
// builder, not a capacity check; every number comes from core. A joint whose bolt size or count is
// Kerf's suggestion, not yet confirmed, says so on its line (#417).

type BoltJoint = structural.BoltJoint;
type BoltDistance = structural.BoltDistance;
const { formatDiameters, shortfalls } = structural;

export function BoltLayout(props: {
  joints: readonly BoltJoint[];
  /** The project's suggested values, to mark the bolts they size. */
  suggested?: readonly SuggestedItem[];
}) {
  if (props.joints.length === 0) return null;
  return (
    <>
      <h3>Bolt layout</h3>
      <Text tone="muted">
        Where each bolt goes, and its distances to the ends and edges, measured against NDS 2024. A
        distance under a row's value means the joint is designed for less load, or not at all for a
        minimum. Judge each one with an experienced builder.
      </Text>
      <Rows>
        {props.joints.map((joint) => (
          <Row key={joint.title} as="section">
            <Joint joint={joint} suggested={props.suggested ?? []} />
          </Row>
        ))}
      </Rows>
    </>
  );
}

/** Whether every distance at a joint is within its NDS 2024 values, in words, for its line. */
function jointSummary(joint: BoltJoint): string {
  const outside = joint.distances.filter((d) => shortfalls(d).length > 0).length;
  if (outside === 0) return 'Every distance within its NDS 2024 values';
  return `${outside} of ${joint.distances.length} distances outside an NDS 2024 value`;
}

/** One joint as a line (Stage 15, #359), opening to its distances. */
function Joint(props: { joint: BoltJoint; suggested: readonly SuggestedItem[] }) {
  const { joint } = props;
  const unconfirmed = jointSuggestions(joint, props.suggested).filter((s) => !s.confirmed);
  return (
    <ResultLine
      title={joint.title}
      detail={jointSummary(joint)}
      result={
        <>
          {joint.bolts} × <Length>{formatLength(joint.diameter)}</Length>
          {unconfirmed.length > 0 && ', suggested'}
        </>
      }
    >
      <Stack gap="xs">
        {unconfirmed.length > 0 && (
          <Text>
            Suggested by Kerf, not confirmed yet:{' '}
            {unconfirmed.map((s, i) => (
              <span key={s.key}>
                {i > 0 && '; '}
                {s.label}, <Readings text={s.text} />
              </span>
            ))}
            . Confirm {unconfirmed.length === 1 ? 'it' : 'them'} under To do, or change{' '}
            {unconfirmed.length === 1 ? 'it' : 'them'} in Edit.
          </Text>
        )}
        <MeasureTable
          caption={`${joint.title} distances`}
          captionHidden
          rows={joint.distances}
          rowKey={(d) => `${d.member}/${d.label}`}
          columns={[
            {
              key: 'what',
              label: 'Distance',
              cell: (d) => (
                <>
                  <b>{d.member}</b> {d.label.charAt(0).toLowerCase() + d.label.slice(1)}
                </>
              ),
            },
            {
              key: 'value',
              label: 'Laid out',
              numeric: true,
              cell: (d) => (
                <>
                  <b>
                    <Length>{formatLength(d.value)}</Length>
                  </b>{' '}
                  {formatDiameters(d.value, joint.diameter)}
                </>
              ),
            },
            { key: 'nds', label: 'NDS 2024', cell: (d) => <Requirements distance={d} /> },
          ]}
        />
        <List>
          {joint.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </List>
      </Stack>
    </ResultLine>
  );
}

function Requirements(props: { distance: BoltDistance }) {
  const { distance } = props;
  const short = new Set(shortfalls(distance));
  return (
    <Stack gap="2xs">
      <PlainList gap="xs">
        {distance.requirements.map((r) => (
          <li key={`${r.condition}/${r.multiple}`}>
            {short.has(r) && <b>{r.gives === 'maximum' ? 'Over: ' : 'Under: '}</b>}
            {r.multiple} (<Length>{formatLength(r.value)}</Length>) for {r.gives}, {r.condition}
          </li>
        ))}
      </PlainList>
      <SourceToggle
        citations={[
          ...new Map(distance.requirements.map((r) => [r.citation.locator, r.citation])).values(),
        ]}
      />
    </Stack>
  );
}
