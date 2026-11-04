import { type CutListRow, geometry } from '@kerf/core';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { type ApiResult, CONNECTION_MESSAGE, describeError, failureOf } from '../../lib/api.ts';
import type { DrawingsState, StepDrawingState } from '../../lib/drawings.ts';
import { useLatest } from '../../lib/latest.ts';
import { cutDetailHeadingId, cutDetailId } from '../../lib/show.ts';
import type { CornerViews } from '../../lib/views.ts';
import {
  Button,
  Cluster,
  CompactSelect,
  Diagram,
  drawingInMove,
  Notice,
  Skeleton,
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
  /**
   * The views from the other corners (#364), fetched when asked for and kept until `key`, the
   * plan they were drawn from, changes. The plan's own drawings are from the front left.
   */
  corners?: {
    key: string;
    load: (corner: geometry.Corner) => Promise<ApiResult<CornerViews>>;
  };
}) {
  const { rows } = props;
  const common = {
    describedBy: props.describedBy,
    selected: props.selected,
    onSelect: props.onSelect,
  };
  const parts = `Parts ${lettersOf(rows)}, lettered as in the cut list.`;
  const chosen = rows.find((r) => r.partId === props.selected);
  const corner = useCorner(props.drawings, props.corners);
  const drawings = { ...props.drawings, ...corner.views };
  const motion = useAssemblyMotion(drawings.exploded?.stages);
  // Both views at one scale, so a part can slide from one to the other. Kept between renders, so
  // a stage of the move redraws only the two views that move.
  const isometricBounds = drawings.isometric?.bounds;
  const explodedBounds = drawings.exploded?.bounds;
  const frame = useMemo(
    () =>
      isometricBounds && explodedBounds ? sharedFrame(isometricBounds, explodedBounds) : undefined,
    [isometricBounds, explodedBounds],
  );
  const assembled: View | null = drawings.isometric && {
    id: 'assembled',
    label: 'Assembled',
    action: 'Assemble',
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
  };
  const exploded: View | null = drawings.exploded && {
    id: 'exploded',
    label: 'Exploded',
    action: 'Explode',
    content: (
      <Diagram
        {...common}
        page="landscape"
        frame={frame}
        motion={frame && motion.exploded}
        drawing={
          drawings.isometric
            ? drawingInMove(drawings.isometric, drawings.exploded, motion.at)
            : drawings.exploded
        }
        label={`Exploded view. ${drawings.exploded.description} ${parts}`}
      />
    ),
  };
  const lone = assembled ?? exploded;
  const assembly =
    assembled && exploded ? ([assembled, exploded] as const) : lone && ([lone] as const);
  return (
    <Stack gap="l">
      <Text tone="muted" screenOnly>
        Tap a part to select it in every drawing, then open it in the cut list. A part's name in the
        cut list opens it here.
      </Text>
      {chosen && (
        <StatusLine>
          {chosen.letter} · {chosen.name} selected.{' '}
          <a href={props.partHref(chosen.partId)}>Show it in the cut list</a>
        </StatusLine>
      )}
      {assembly && (
        <ViewSwitch
          views={assembly}
          control={frame && motion.control}
          tools={
            props.corners && (
              <CompactSelect
                label="Seen from"
                value={corner.asked}
                options={geometry.CORNERS.map((c) => ({ value: c, label: CORNER_LABELS[c] }))}
                onChange={(c) => corner.choose(c as geometry.Corner)}
              />
            )
          }
        />
      )}
      {corner.status}
      {(drawings.elevations ?? []).length > 0 && (
        <>
          <h3>Elevations and sections</h3>
          {(drawings.elevations ?? []).map((view) => (
            <Stack gap="xs" key={view.title}>
              <h4>{view.title}</h4>
              <Diagram
                {...common}
                drawing={view}
                minWidth={560}
                label={`${view.description} Dimensions ${dimensions(view).join(', ')}.`}
              />
            </Stack>
          ))}
        </>
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

/** Where the drawings go while they load, or why they did not, with a way to ask again. */
export function DrawingsWaiting(props: { state: DrawingsState | StepDrawingState }) {
  const { state } = props;
  if (state.state === 'ready') return null;
  const retry = (problem: ReactNode, connection: boolean) => (
    <Stack gap="xs">
      <Notice icon={connection ? 'connection' : 'error'}>{problem}</Notice>
      {state.retry && (
        <Cluster>
          <Button onClick={state.retry}>Try again</Button>
        </Cluster>
      )}
    </Stack>
  );
  if (state.state === 'loading') {
    return (
      <Skeleton label="Loading drawings…" stuck={retry(CONNECTION_MESSAGE, true)} shape="page" />
    );
  }
  const failure = failureOf(state.error);
  return retry(`The drawings could not be loaded. ${failure.message}`, failure.connection);
}

const CORNER_LABELS: Record<geometry.Corner, string> = {
  'front-left': 'From the front left',
  'front-right': 'From the front right',
  'back-right': 'From the back right',
  'back-left': 'From the back left',
};

/**
 * Which corner the assembled and exploded views are seen from (#364): the plan's own from the
 * front left, another fetched the first time it is chosen. The drawings on screen stay until the
 * new ones arrive, and only the corner chosen last is shown.
 */
function useCorner(drawings: Drawings, corners: Parameters<typeof Diagrams>[0]['corners']) {
  const [asked, setAsked] = useState<geometry.Corner>('front-left');
  const [shown, setShown] = useState<geometry.Corner>('front-left');
  const [loaded, setLoaded] = useState<{ key?: string; views: Map<geometry.Corner, CornerViews> }>({
    views: new Map(),
  });
  const [failure, setFailure] = useState<string | null>(null);
  const key = corners?.key;
  const plan = useRef(key);
  plan.current = key;
  // Each corner's request in flight, shared by every choice of that corner until it arrives.
  const pending = useRef(new Map<geometry.Corner, Promise<ApiResult<CornerViews>>>());
  const latest = useLatest();
  // A changed plan is drawn afresh from the front left.
  useEffect(() => {
    if (key === undefined) return;
    latest.supersede();
    pending.current = new Map();
    setAsked('front-left');
    setShown('front-left');
    setFailure(null);
  }, [key, latest]);
  const views = loaded.key === key ? loaded.views : new Map<geometry.Corner, CornerViews>();
  const request = (
    corner: geometry.Corner,
    load: (corner: geometry.Corner) => Promise<ApiResult<CornerViews>>,
  ) => {
    const requests = pending.current;
    const inFlight = requests.get(corner);
    if (inFlight) return inFlight;
    const made = load(corner).then((result) => {
      requests.delete(corner);
      // Kept even when another corner has been chosen since, so choosing this one is instant.
      if (result.ok && plan.current === key) {
        setLoaded((l) => ({
          key,
          views: new Map(l.key === key ? l.views : []).set(corner, result.value),
        }));
      }
      return result;
    });
    requests.set(corner, made);
    return made;
  };
  const choose = async (corner: geometry.Corner) => {
    const isLatest = latest.start();
    setAsked(corner);
    setFailure(null);
    if (corner === 'front-left' || views.has(corner) || !corners) {
      setShown(corner);
      return;
    }
    const result = await request(corner, corners.load);
    // Another corner was chosen, or the plan changed, while this one was drawn.
    if (!isLatest()) return;
    if (!result.ok) {
      setFailure(describeError(result.error));
      setAsked(shown);
      return;
    }
    setShown(corner);
  };
  const own = { isometric: drawings.isometric, exploded: drawings.exploded };
  const current = shown === 'front-left' ? own : (views.get(shown) ?? own);
  return {
    asked,
    choose,
    views: current,
    status:
      failure !== null ? (
        <StatusLine tone="error">
          The view from that corner could not be drawn. {failure}
        </StatusLine>
      ) : asked !== shown ? (
        <StatusLine tone="working">
          Drawing the view {CORNER_LABELS[asked].toLowerCase()}…
        </StatusLine>
      ) : null,
  };
}
