import { type CutListRow, geometry } from '@kerf/core';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { type ApiResult, describeError, failureOf, SLOW_MESSAGE } from '../../lib/api.ts';
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
  scrollBelowBars,
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
  /**
   * The plan's sub-assemblies (#647), listed with its drawings, each one's views fetched when it
   * is opened and kept until `key`, the plan they were drawn from, changes. The group open is in
   * the address.
   */
  subAssemblies?: {
    key: string;
    list: readonly geometry.SubAssemblySummary[];
    load: (groupId: string) => Promise<ApiResult<geometry.SubAssemblyDrawings | null>>;
    /** The group open, from the address (#653). */
    open: string | null;
    onOpen: (groupId: string | null) => void;
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
  return (
    <Stack gap="l">
      <Text tone="muted" screenOnly>
        Tap a part, or choose it from the list of parts, to select it in every drawing, then open it
        in the cut list. A part's name in the cut list opens it here.
      </Text>
      {chosen && (
        <StatusLine>
          {chosen.letter} · {chosen.name} selected.{' '}
          <a href={props.partHref(chosen.partId)}>Show it in the cut list</a>
        </StatusLine>
      )}
      <AssemblyViews
        {...common}
        isometric={drawings.isometric}
        exploded={drawings.exploded}
        parts={parts}
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
      {corner.status}
      {(drawings.isometric || drawings.exploded) && (
        <PartPicker rows={rows} selected={props.selected} onSelect={props.onSelect} />
      )}
      {props.subAssemblies && props.subAssemblies.list.length > 0 && (
        <SubAssemblies
          {...common}
          rows={rows}
          plan={props.subAssemblies.key}
          list={props.subAssemblies.list}
          load={props.subAssemblies.load}
          open={props.subAssemblies.open}
          onOpen={props.subAssemblies.onOpen}
        />
      )}
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

type Common = {
  describedBy: string;
  selected: string | null;
  onSelect: (partId: string) => void;
};

/**
 * An assembly's assembled and exploded views in one frame, with the switch between them and the
 * staged move (`useAssemblyMotion`, which swaps them at once under reduced motion). Either view
 * alone is shown under its heading.
 */
function AssemblyViews(
  props: Common & {
    isometric: Drawing | null;
    exploded: Drawing | null;
    /** The part letters the views show, for assistive technology. */
    parts: string;
    tools?: ReactNode;
    headingLevel?: 3 | 4;
  },
) {
  const { isometric, exploded, parts, describedBy, selected, onSelect } = props;
  const common = { describedBy, selected, onSelect };
  const motion = useAssemblyMotion(exploded?.stages);
  // Both views at one scale, so a part can slide from one to the other. Kept between renders, so
  // a stage of the move redraws only the two views that move.
  const isometricBounds = isometric?.bounds;
  const explodedBounds = exploded?.bounds;
  const frame = useMemo(
    () =>
      isometricBounds && explodedBounds ? sharedFrame(isometricBounds, explodedBounds) : undefined,
    [isometricBounds, explodedBounds],
  );
  const assembled: View | null = isometric && {
    id: 'assembled',
    label: 'Assembled',
    action: 'Assemble',
    content: (
      <Diagram
        {...common}
        page="landscape"
        frame={frame}
        motion={frame && motion.assembled}
        letters="wide"
        drawing={isometric}
        label={`Isometric view. ${isometric.description} ${parts}`}
      />
    ),
  };
  const apart: View | null = exploded && {
    id: 'exploded',
    label: 'Exploded',
    action: 'Explode',
    content: (
      <Diagram
        {...common}
        page="landscape"
        frame={frame}
        motion={frame && motion.exploded}
        letters="wide"
        drawing={isometric ? drawingInMove(isometric, exploded, motion.at) : exploded}
        label={`Exploded view. ${exploded.description} ${parts}`}
      />
    ),
  };
  const lone = assembled ?? apart;
  const views = assembled && apart ? ([assembled, apart] as const) : lone && ([lone] as const);
  if (!views) return null;
  return (
    <ViewSwitch
      views={views}
      control={frame && motion.control}
      tools={props.tools}
      headingLevel={props.headingLevel}
    />
  );
}

/** A group's title, with how many the plan has when there are more than one. */
const groupTitle = (g: geometry.SubAssemblySummary) =>
  g.alike > 1 ? `${g.title} (${g.alike} alike)` : g.title;

/** The element ID of the open sub-assembly's heading, which a link to it focuses (#653). */
const OPEN_GROUP_HEADING = 'sub-assembly-heading';

/**
 * The plan's sub-assemblies (#647), each taken fully apart in a view of its own, opened from a
 * list one at a time. The group open is in the address, so a build step can link to it (#653),
 * and arriving with one scrolls to it once it is drawn. A group's views are fetched the first time
 * it is opened and kept for the plan they were drawn from. Not printed (owner's decision on
 * #647): the list and the open group are screen only.
 */
function SubAssemblies(
  props: Common & {
    rows: readonly CutListRow[];
    /** The plan the views are drawn from. */
    plan: string;
    list: readonly geometry.SubAssemblySummary[];
    load: (groupId: string) => Promise<ApiResult<geometry.SubAssemblyDrawings | null>>;
    /** The group open, from the address. */
    open: string | null;
    /** Opens a group, or closes the one open with null. */
    onOpen: (groupId: string | null) => void;
  },
) {
  const { plan, list, load, open, onOpen, rows, describedBy, selected, onSelect } = props;
  // What is loaded or failed is kept with the plan it was for, so a changed plan draws its views
  // afresh.
  const [loaded, setLoaded] = useState<{
    plan?: string;
    views: Map<string, geometry.SubAssemblyDrawings | null>;
  }>({ views: new Map() });
  const [failed, setFailed] = useState<{ plan: string; id: string; message: string } | null>(null);
  const group = list.find((g) => g.id === open);
  const views = loaded.plan === plan ? loaded.views : new Map<string, never>();
  const failure = failed?.plan === plan && failed.id === group?.id ? failed.message : null;
  const shown = group ? views.get(group.id) : undefined;
  // Each group's request in flight for this plan, so one opened again while on its way is asked
  // for once.
  const asking = useRef(new Set<string>());
  const groupId = group?.id;
  const known = groupId !== undefined && (views.has(groupId) || failure !== null);
  useEffect(() => {
    if (groupId === undefined || known) return;
    const key = `${plan}/${groupId}`;
    if (asking.current.has(key)) return;
    asking.current.add(key);
    void load(groupId).then((result) => {
      asking.current.delete(key);
      if (!result.ok) {
        setFailed({ plan, id: groupId, message: describeError(result.error) });
        return;
      }
      setLoaded((l) => ({
        plan,
        views: new Map(l.plan === plan ? l.views : []).set(groupId, result.value),
      }));
    });
  }, [plan, groupId, known, load]);
  // Arriving with a group open, as from a build step's link, scrolls to it once it is drawn.
  const arriving = useRef(open !== null);
  useEffect(() => {
    if (!arriving.current || shown === undefined) return;
    arriving.current = false;
    const heading = document.getElementById(OPEN_GROUP_HEADING);
    if (!heading) return;
    heading.focus({ preventScroll: true });
    scrollBelowBars(heading);
  }, [shown]);
  const choose = (id: string) => {
    setFailed(null);
    onOpen(open === id ? null : id);
  };
  const lettered = (d: geometry.SubAssemblyDrawings) => {
    const ids = new Set(
      d.isometric.primitives.flatMap((p) => ('part' in p && p.part ? [p.part.partId] : [])),
    );
    return `Parts ${lettersOf(rows.filter((r) => ids.has(r.partId)))}, lettered as in the cut list.`;
  };
  return (
    <section data-screen-only aria-labelledby="sub-assemblies">
      <Stack gap="s">
        <h3 id="sub-assemblies">Sub-assemblies</h3>
        <Text tone="muted">
          Each group built as a unit, taken fully apart. Alike groups are drawn once.
        </Text>
        <Cluster>
          {list.map((g) => (
            <Button
              key={g.id}
              variant="secondary"
              pressed={open === g.id}
              onClick={() => choose(g.id)}
            >
              {groupTitle(g)}
            </Button>
          ))}
        </Cluster>
        {failure !== null && (
          <StatusLine tone="error">That sub-assembly could not be drawn. {failure}</StatusLine>
        )}
        {group && failure === null && (
          <Stack gap="xs">
            {/* Focusable, so a link to the group can move focus here (#653). */}
            <h4 id={OPEN_GROUP_HEADING} tabIndex={-1}>
              {groupTitle(group)}
            </h4>
            {shown === undefined ? (
              <StatusLine tone="working">Drawing the {group.title.toLowerCase()}…</StatusLine>
            ) : shown === null ? (
              <Text tone="muted">This sub-assembly could not be drawn.</Text>
            ) : (
              // Each group opens assembled, with a move of its own.
              <AssemblyViews
                key={group.id}
                describedBy={describedBy}
                selected={selected}
                onSelect={onSelect}
                isometric={shown.isometric}
                exploded={shown.exploded}
                parts={lettered(shown)}
                headingLevel={4}
              />
            )}
          </Stack>
        )}
      </Stack>
    </section>
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
    return <Skeleton label="Loading drawings…" stuck={retry(SLOW_MESSAGE, true)} shape="page" />;
  }
  const failure = failureOf(state.error);
  return retry(`The drawings could not be loaded. ${failure.message}`, failure.connection);
}

/**
 * Every part by letter and name, to select one without finding it in a drawing: on a phone the
 * assembly views leave their letters out, and the drawings take no keyboard.
 */
function PartPicker(props: {
  rows: readonly CutListRow[];
  selected: string | null;
  onSelect: (partId: string) => void;
}) {
  const { selected, onSelect } = props;
  return (
    <div data-screen-only>
      <CompactSelect
        label="Part"
        value={selected ?? ''}
        options={[
          { value: '', label: 'Choose a part' },
          ...props.rows.map((r) => ({ value: r.partId, label: `${r.letter} · ${r.name}` })),
        ]}
        // Selecting the part already selected clears it, as tapping it again does.
        onChange={(id) => {
          if (id) onSelect(id);
          else if (selected) onSelect(selected);
        }}
      />
    </div>
  );
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
