import { formatLength, structural } from '@kerf/core';
import { Card, Length, List, MeasureTable, PlainList, Stack, Text } from '../../ui/index.ts';
import { SourceToggle } from './Citation.tsx';

// Bolt distances at each joint (#93, decision 0016): where Kerf put each bolt, and the NDS 2024
// rows each distance is measured against. Geometry for the conversation with an experienced
// builder, not a capacity check; every number comes from core.

type BoltJoint = structural.BoltJoint;
type BoltDistance = structural.BoltDistance;
const { formatDiameters, shortfalls } = structural;

export function BoltLayout(props: { joints: readonly BoltJoint[] }) {
  if (props.joints.length === 0) return null;
  return (
    <>
      <h3>Bolt layout</h3>
      <Text tone="muted">
        Where each bolt goes, and its distances to the ends and edges, measured against NDS 2024. A
        distance under a row's value means the joint is designed for less load, or not at all for a
        minimum. Judge each one with an experienced builder.
      </Text>
      <Stack>
        {props.joints.map((joint) => (
          <Joint key={joint.title} joint={joint} />
        ))}
      </Stack>
    </>
  );
}

function Joint(props: { joint: BoltJoint }) {
  const { joint } = props;
  return (
    <Card as="section">
      <Stack gap="xs">
        <h4>
          {joint.title}: {joint.bolts} <Length>{formatLength(joint.diameter)}</Length> bolt
          {joint.bolts > 1 ? 's' : ''}
        </h4>
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
    </Card>
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
