import type { geometry } from '@kerf/core';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

// The move between an assembled and an exploded drawing (#200, #352): each part slides from where
// it sits to where the exploded view draws it, by the shift core gives with the drawing, a stage
// at a time, while the part letters and guidelines fade out and back in, since each view lays them
// out on its own. One drawing has one paint order, so core draws each stage where it ends; the
// stage's parts slide over that drawing once they have left their joints, and over the drawing
// the stage starts from until then, so no part passes in front of one it is behind. A clock moves
// the parts by setting `--t`, how far through its stage the move is, on the drawing's element;
// React draws again only when the drawing under the parts changes. Under reduced motion the views
// swap at once.

/** How long each stage's parts take to slide. */
const MOVE_MS = 400;

type Bounds = geometry.Drawing['bounds'];
type Drawing = geometry.Drawing;
type Stage = geometry.Stage;
type AssemblyView = 'assembled' | 'exploded';

/** The drawing the moving parts slide over: the one their stage starts from, or its own. */
export type Over = 'start' | 'end';

/** What a drawing in the move shows now. */
export interface Motion {
  /** Part letters and guidelines shown. */
  labels: boolean;
  /** The parts sliding in this stage, each with how far it goes over the stage, on the page. */
  moves?: Stage['moves'];
  /** Whether `--t` slides the parts from where the stage starts them or back from where it ends. */
  over?: Over;
  /** Takes the drawing's element, to set `--t` on while the move plays. */
  track?: (element: HTMLElement | null) => void;
}

interface State {
  asked: AssemblyView;
  shown: AssemblyView;
  stage: number;
  over: Over;
  labels: boolean;
  assembledLabels: boolean;
}

const atRest = (view: AssemblyView, stages: number): State => ({
  asked: view,
  shown: view,
  stage: stages - 1,
  over: 'end',
  labels: true,
  assembledLabels: true,
});

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

/** Eased in and out within each stage, so each one starts and settles gently. */
const ease = (p: number) => (p < 0.5 ? 2 * p * p : 1 - 2 * (1 - p) * (1 - p));

/** Both drawings' bounds together, so the two are drawn at one scale and nothing jumps. */
export function sharedFrame(a: Bounds, b: Bounds): Bounds {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
}

/**
 * The exploded view as drawn at a point in the move: a stage's own drawing, or the one the stage
 * starts from, the stage before's or, for the first, the assembled view.
 */
export function drawingInMove(
  assembled: Drawing,
  exploded: Drawing,
  at: { stage: number; over: Over },
): Drawing {
  const stages = exploded.stages ?? [];
  const own = (k: number) =>
    k === stages.length - 1 ? exploded.primitives : stages[k]?.primitives;
  const primitives =
    at.over === 'end' ? own(at.stage) : at.stage === 0 ? assembled.primitives : own(at.stage - 1);
  return { ...exploded, primitives: primitives ?? exploded.primitives };
}

const NO_STAGES: readonly Stage[] = [];

/** Runs the switch between the two views; `press` starts a move, or swaps under reduced motion. */
export function useAssemblyMotion(stages: readonly Stage[] = NO_STAGES) {
  const count = Math.max(1, stages.length);
  const [state, setState] = useState<State>(atRest('assembled', count));
  // The clock reads these between renders.
  const now = { stages, count, ...state };
  const live = useRef(now);
  live.current = now;
  // Where the move is, from 0 (assembled) to `count` (exploded), and where it is going.
  const at = useRef(0);
  const target = useRef(0);
  const element = useRef<HTMLElement | null>(null);
  const frame = useRef<number | null>(null);
  const last = useRef<number | null>(null);
  const timer = useRef<number | null>(null);

  const place = () => {
    const { stages: all, count: n } = live.current;
    const k = Math.min(n - 1, Math.floor(at.current));
    const t = ease(at.current - k);
    return { stage: k, t, over: (t < (all[k]?.from ?? 0) ? 'start' : 'end') as Over };
  };
  // While the assembled view shows, the exploded one waits at rest, as it prints.
  const setT = () => {
    const t = live.current.shown === 'exploded' ? place().t : 1;
    element.current?.style.setProperty('--t', String(t));
  };
  // A change of drawing is drawn first, then its parts moved, in one paint.
  useLayoutEffect(setT);
  const track = useCallback((el: HTMLElement | null) => {
    element.current = el;
    if (el) el.style.setProperty('--t', '1');
  }, []);
  useEffect(
    () => () => {
      if (frame.current !== null) window.cancelAnimationFrame(frame.current);
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );
  // Other drawings, such as the views from another corner (#364): at rest in the view asked for.
  const drawn = useRef(stages);
  useEffect(() => {
    if (drawn.current === stages) return;
    drawn.current = stages;
    if (frame.current !== null) window.cancelAnimationFrame(frame.current);
    frame.current = null;
    last.current = null;
    const { asked } = live.current;
    at.current = asked === 'exploded' ? count : 0;
    setState(atRest(asked, count));
  }, [stages, count]);

  const step = (now: number) => {
    const dt = last.current === null ? 0 : now - last.current;
    last.current = now;
    const toward = Math.sign(target.current - at.current);
    const next = at.current + (toward * dt) / MOVE_MS;
    at.current = toward > 0 ? Math.min(next, target.current) : Math.max(next, target.current);
    const { stage, over } = place();
    const done = at.current === target.current;
    frame.current = done ? null : window.requestAnimationFrame(step);
    if (done) last.current = null;
    if (done && target.current === 0) {
      // Home: the assembled drawing, whose letters fade in.
      setState({ ...atRest('assembled', live.current.count), assembledLabels: false });
      timer.current = window.setTimeout(() => {
        setState((r) => ({ ...r, assembledLabels: true }));
      }, 20);
      return;
    }
    if (stage === live.current.stage && over === live.current.over) setT();
    setState((s) =>
      done
        ? { ...s, stage, over, labels: true }
        : s.stage === stage && s.over === over
          ? s
          : { ...s, stage, over },
    );
  };

  const press = (id: string) => {
    const to: AssemblyView = id === 'exploded' ? 'exploded' : 'assembled';
    if (to === state.asked) return;
    if (timer.current !== null) window.clearTimeout(timer.current);
    if (reducedMotion()) {
      if (frame.current !== null) window.cancelAnimationFrame(frame.current);
      frame.current = null;
      last.current = null;
      at.current = to === 'exploded' ? count : 0;
      setState(atRest(to, count));
      return;
    }
    target.current = to === 'exploded' ? count : 0;
    if (state.shown === 'assembled') {
      // Shown with every part home and no letters, then sliding out.
      at.current = 0;
      const { stage, over } = place();
      setState({ asked: to, shown: to, stage, over, labels: false, assembledLabels: true });
    } else {
      setState((s) => ({ ...s, asked: to, labels: false }));
    }
    if (frame.current === null) frame.current = window.requestAnimationFrame(step);
  };

  return {
    control: { asked: state.asked, shown: state.shown, press },
    /** Which drawing the exploded view shows now (`drawingInMove`). */
    at: { stage: state.stage, over: state.over },
    exploded: {
      labels: state.labels,
      moves: stages[state.stage]?.moves,
      over: state.over,
      track,
    } as Motion,
    assembled: { labels: state.assembledLabels } as Motion,
  };
}
