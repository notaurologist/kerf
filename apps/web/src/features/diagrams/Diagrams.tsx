import type { CutListRow, geometry } from '@kerf/core';
import { cutDetailHeadingId, cutDetailId } from '../../lib/show.ts';
import {
  Diagram,
  Stack,
  StatusLine,
  sharedFrame,
  Text,
  useAssemblyMotion,
  type View,
  ViewSwitch,
} from '../../ui/index.ts';

// The plan's drawings (#91), drawn from the primitives core made from the stored snapshot (#90).
// Each is labeled with core's description of it, which the template words for its own views,
// plus the part letters or dimensions; the cut list is the long description. Nothing here knows
// a template.
// Tapping a part selects it in every drawing (#39, Q3), and a link opens it in the cut list, which
// is its own section (#156).

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
  /** The cut list with this part selected. */
  partHref: (partId: string) => string;
}) {
  const { drawings, rows } = props;
  const common = {
    describedBy: props.describedBy,
    selected: props.selected,
    onSelect: props.onSelect,
  };
  const parts = `Parts ${lettersOf(rows)}, lettered as in the cut list.`;
  const chosen = rows.find((r) => r.partId === props.selected);
  const motion = useAssemblyMotion();
  // Both views at one scale, so a part can slide from one to the other.
  const frame =
    drawings.isometric && drawings.exploded
      ? sharedFrame(drawings.isometric.bounds, drawings.exploded.bounds)
      : undefined;
  const assembly: View[] = [];
  if (drawings.isometric) {
    assembly.push({
      id: 'assembled',
      label: 'Assembled',
      content: (
        <Diagram
          {...common}
          page="landscape"
          frame={frame}
          motion={frame && motion.assembled}
          drawing={drawings.isometric}
          label={`Isometric view. ${drawings.isometric.description} ${parts}`}
        />
      ),
    });
  }
  if (drawings.exploded) {
    assembly.push({
      id: 'exploded',
      label: 'Exploded',
      content: (
        <Diagram
          {...common}
          page="landscape"
          frame={frame}
          motion={frame && motion.exploded}
          drawing={drawings.exploded}
          label={`Exploded view. ${drawings.exploded.description} ${parts}`}
        />
      ),
    });
  }
  return (
    <Stack gap="l">
      <Text tone="muted">
        Tap a part to select it in every drawing, then open it in the cut list. A part's name in the
        cut list opens it here.
      </Text>
      {chosen && (
        <StatusLine>
          {chosen.letter} · {chosen.name} selected.{' '}
          <a href={props.partHref(chosen.partId)}>Show it in the cut list</a>
        </StatusLine>
      )}
      {assembly.length > 0 && (
        <ViewSwitch label="Assembly view" views={assembly} control={frame && motion.control} />
      )}
      <h3>Cut details</h3>
      {drawings.cutDetails.map((detail) => (
        <Stack
          gap="xs"
          key={detail.title}
          id={detail.partId ? cutDetailId(detail.partId) : undefined}
        >
          {/* Focusable, so a link to the part can move focus here (#156). */}
          <h4
            id={detail.partId ? cutDetailHeadingId(detail.partId) : undefined}
            tabIndex={detail.partId ? -1 : undefined}
          >
            {detail.title}
          </h4>
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
