import type { FrameGeometry } from './geometry.ts';
import type { SwingSetParams } from './params.ts';

// Swings and site layout (docs/templates/swing-set-a-frame.md, Swings and Site layout).
// Clearance values come from the CPSC home handbook; DOMAIN.md, Layout and clearances, quotes
// them with page numbers.

const CPSC_324 = 'CPSC Outdoor Home Playground Safety Handbook (Pub. 324, 2005)';

export const CLEARANCES = {
  /** Clear area and surfacing beyond the equipment on every side. */
  clearAreaMargin: { value: 72, source: `${CPSC_324}, pp. 2 and 7` },
  /** Swing zones extend this many times the pivot height in front and behind. */
  swingZoneFactor: { value: 2, source: `${CPSC_324}, pp. 2 and 7` },
  /** Between seats, and between a seat and the frame. */
  seatGap: { value: 8, source: `${CPSC_324}, p. 5` },
  /** Between the ground and a seat's underside. */
  seatClearance: { value: 8, source: `${CPSC_324}, p. 5` },
} as const;

export interface SwingGeometry {
  /** Hanger positions along the beam, left to right: the beam's load points. */
  hangersX: [number, number, number, number];
  seats: [{ xMin: number; xMax: number }, { xMin: number; xMax: number }];
  /** Pivot to seat underside, before subtracting the hanger hardware's drop. */
  chainLength: number;
}

export interface PlanRect {
  label: string;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  source?: string;
}

export interface SiteLayout {
  footprint: PlanRect;
  clearArea: PlanRect;
  swingZones: [PlanRect, PlanRect];
}

export function swingGeometry(p: SwingSetParams): SwingGeometry {
  const { centers, hangerSpacing, seatWidth, seatHeight } = p.swings;
  const half = hangerSpacing / 2;
  const seat = (x: number) => ({ xMin: x - seatWidth / 2, xMax: x + seatWidth / 2 });
  return {
    hangersX: [centers[0] - half, centers[0] + half, centers[1] - half, centers[1] + half],
    seats: [seat(centers[0]), seat(centers[1])],
    chainLength: p.beamHeight - seatHeight,
  };
}

export function siteLayout(p: SwingSetParams, g: FrameGeometry, s: SwingGeometry): SiteLayout {
  const footprint: PlanRect = {
    label: 'Frame footprint at grade',
    xMin: 0,
    xMax: p.beamLength,
    yMin: -g.front.outerAtGrade,
    yMax: g.back.outerAtGrade,
  };
  const m = CLEARANCES.clearAreaMargin.value;
  const zoneDepth = CLEARANCES.swingZoneFactor.value * p.beamHeight;
  const zone = (seat: { xMin: number; xMax: number }, label: string): PlanRect => ({
    label,
    xMin: seat.xMin,
    xMax: seat.xMax,
    yMin: -zoneDepth,
    yMax: zoneDepth,
    source: CLEARANCES.swingZoneFactor.source,
  });
  return {
    footprint,
    clearArea: {
      label: 'Clear area and surfacing',
      xMin: footprint.xMin - m,
      xMax: footprint.xMax + m,
      yMin: footprint.yMin - m,
      yMax: footprint.yMax + m,
      source: CLEARANCES.clearAreaMargin.source,
    },
    swingZones: [zone(s.seats[0], 'Left swing zone'), zone(s.seats[1], 'Right swing zone')],
  };
}
