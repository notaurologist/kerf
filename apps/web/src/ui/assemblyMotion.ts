import type { geometry } from '@kerf/core';
import { useEffect, useRef, useState } from 'react';

// The move between an assembled and an exploded drawing (#200): each part slides from where it
// sits to where the exploded view draws it, by the shift core gives with the drawing, while the
// part letters and guidelines fade out and back in, since each view lays them out on its own.
// Parts slide in the exploded view's paint order, so one can pass in front of another it should
// be behind for part of the move. Under reduced motion the views swap at once.

/** How long the parts take to slide, matching `--duration-move`. */
export const MOVE_MS = 400;

type Bounds = geometry.Drawing['bounds'];
export type AssemblyView = 'assembled' | 'exploded';

/** What a drawing in the move shows now. */
export interface Motion {
  /** Parts drawn where they sit in the assembled view. */
  collapsed: boolean;
  /** Part letters and guidelines shown. */
  labels: boolean;
  /** No transition: the drawing jumps to this state, such as while it is hidden. */
  instant: boolean;
}

interface State {
  pressed: AssemblyView;
  shown: AssemblyView;
  exploded: Motion;
  assembledLabels: boolean;
}

const AT_REST = (view: AssemblyView): State => ({
  pressed: view,
  shown: view,
  exploded: { collapsed: false, labels: true, instant: true },
  assembledLabels: true,
});

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

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

/** Runs the switch between the two views; `press` starts a move, or swaps under reduced motion. */
export function useAssemblyMotion() {
  const [state, setState] = useState<State>(AT_REST('assembled'));
  const timers = useRef<number[]>([]);
  const clear = () => {
    for (const t of timers.current) window.clearTimeout(t);
    timers.current = [];
  };
  const later = (ms: number, next: (s: State) => State) => {
    timers.current.push(window.setTimeout(() => setState(next), ms));
  };
  useEffect(
    () => () => {
      for (const t of timers.current) window.clearTimeout(t);
    },
    [],
  );

  const press = (id: string) => {
    const to: AssemblyView = id === 'exploded' ? 'exploded' : 'assembled';
    if (to === state.pressed) return;
    clear();
    if (reducedMotion()) {
      setState(AT_REST(to));
      return;
    }
    if (to === 'exploded') {
      // Shown with every part home, then, a frame later, sliding out; letters follow.
      setState({
        pressed: to,
        shown: to,
        exploded: { collapsed: true, labels: false, instant: true },
        assembledLabels: true,
      });
      later(20, (s) => ({ ...s, exploded: { collapsed: false, labels: false, instant: false } }));
      later(20 + MOVE_MS, (s) => ({ ...s, exploded: { ...s.exploded, labels: true } }));
    } else {
      // Letters out and parts home, then the assembled drawing, whose letters fade in.
      setState((s) => ({
        ...s,
        pressed: to,
        exploded: { collapsed: true, labels: false, instant: false },
      }));
      later(MOVE_MS, () => ({
        pressed: to,
        shown: to,
        exploded: { collapsed: false, labels: true, instant: true },
        assembledLabels: false,
      }));
      later(MOVE_MS + 20, (s) => ({ ...s, assembledLabels: true }));
    }
  };

  return {
    control: { pressed: state.pressed, shown: state.shown, press },
    exploded: state.exploded,
    assembled: { collapsed: false, labels: state.assembledLabels, instant: false } as Motion,
  };
}
