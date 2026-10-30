import type { CutListRow, geometry } from '@kerf/core';
import { cutDetailId, show } from '../../lib/show.ts';
import { Button, Diagram, Stack, StatusLine, Text } from '../../ui/index.ts';

// The plan's drawings (#91), drawn from the primitives core made from the stored snapshot (#90).
// Each is labeled with core's description of it, which the template words for its own views,
// plus the part letters or dimensions; the cut list is the long description. Nothing here knows
// a template.
// Tapping a part selects it here and in the cut list (#39, Q3).

type Drawings = geometry.Drawings;
type Drawing = geometry.Drawing;

/** The text of a drawing's dimensions, in the order drawn: its numbers, as core wrote them. */
const dimensions = (d: Drawing) =>
  d.primitives.flatMap((p) => (p.kind === 'text' && p.role === 'dimension' ? [p.text] : []));

/** "A to E", or the letters listed when there are a few. */
function lettersOf(rows: readonly CutListRow[]): string {
  const letters = rows.map((r) => r.letter);
  if (letters.length <= 2) return letters.join(' and ');
  return `${letters[0]} to ${letters[letters.length - 1]}`;
}

export function Diagrams(props: {
  drawings: Drawings;
  rows: readonly CutListRow[];
  /** The id of the cut list, the drawings' long description. */
  describedBy: string;
  selected: string | null;
  onSelect: (partId: string) => void;
}) {
  const { drawings, rows } = props;
  const common = {
    describedBy: props.describedBy,
    selected: props.selected,
    onSelect: props.onSelect,
  };
  const parts = `Parts ${lettersOf(rows)}, lettered as in the cut list.`;
  const chosen = rows.find((r) => r.partId === props.selected);
  return (
    <Stack gap="l">
      <Text tone="muted">
        Tap a part to find it in the cut list, or a part's name in the cut list to find it here.
      </Text>
      {chosen && (
        <StatusLine>
          {chosen.letter} · {chosen.name} selected.{' '}
          <Button variant="link" onClick={() => show(props.describedBy)}>
            Show it in the cut list
          </Button>
        </StatusLine>
      )}
      {drawings.isometric && (
        <Stack gap="xs">
          <h3>Assembled</h3>
          <Diagram
            {...common}
            page="landscape"
            drawing={drawings.isometric}
            label={`Isometric view. ${drawings.isometric.description} ${parts}`}
          />
        </Stack>
      )}
      {drawings.exploded && (
        <Stack gap="xs">
          <h3>Exploded</h3>
          <Diagram
            {...common}
            page="landscape"
            drawing={drawings.exploded}
            label={`Exploded view. ${drawings.exploded.description} ${parts}`}
          />
        </Stack>
      )}
      <h3>Cut details</h3>
      {drawings.cutDetails.map((detail) => (
        <Stack
          gap="xs"
          key={detail.title}
          id={detail.partId ? cutDetailId(detail.partId) : undefined}
        >
          <h4>{detail.title}</h4>
          <Diagram {...common} drawing={detail} minWidth={560} label={detail.description} />
        </Stack>
      ))}
      {drawings.siteLayout && (
        <Stack gap="xs">
          <h3>Site layout</h3>
          <Diagram
            {...common}
            page="landscape"
            drawing={drawings.siteLayout}
            label={`${drawings.siteLayout.description} Dimensions ${dimensions(drawings.siteLayout).join(', ')}.`}
          />
        </Stack>
      )}
    </Stack>
  );
}
