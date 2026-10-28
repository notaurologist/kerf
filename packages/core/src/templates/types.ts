import type { Stock } from '../lumber/stock.ts';

/** A problem with the parameters that stops generation. */
export interface Issue {
  code: string;
  message: string;
  /** Parameter names involved, so a form can point at them. */
  params: string[];
}

/** Expert-check categories from DOMAIN.md. */
export type FlagCategory =
  | 'table-saw'
  | 'router'
  | 'jointer-planer-lathe'
  | 'load-bearing'
  | 'dynamic-loads'
  | 'wood-movement'
  | 'finishes'
  | 'dust-and-species';

/** Something to ask an experienced builder about, and why (DOMAIN.md, Expert-check categories). */
export interface Flag {
  category: FlagCategory;
  ask: string;
  why: string;
}

export interface EndCut {
  /** Saw setting in degrees, miter-saw convention: 0 is square (DOMAIN.md, Units). */
  setting: number;
  /** What the cut is, without its angle; displays add the angle from `setting`. */
  description: string;
}

export interface Part {
  id: string;
  name: string;
  role: 'beam' | 'leg' | 'crossbar' | 'gusset';
  stock: Stock;
  quantity: number;
  /** Overall length, long point to long point: the stock each piece needs. */
  length: number;
  /** Other lengths to mark, such as each edge of an angled part. */
  markLengths: { label: string; value: number }[];
  ends: [EndCut, EndCut];
  /**
   * True when the two end cuts are parallel (the part is a parallelogram, like a leg with level
   * cuts at both ends); false when they angle in opposite directions (a trapezoid).
   */
  endsParallel: boolean;
  notes: string[];
}

export interface HardwareItem {
  id: string;
  name: string;
  quantity: number;
  /** Through-bolts only: diameter and grip (thickness of wood the bolt passes through). */
  bolt?: { diameter: number; grip: number };
  /** True when the item carries load and its size was confirmed with an experienced builder. */
  structural: boolean;
  notes: string[];
}

export type GenerateResult<Output> = { ok: true; output: Output } | { ok: false; issues: Issue[] };
