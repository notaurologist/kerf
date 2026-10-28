import {
  INCISING,
  LOAD_DURATION,
  type LoadDuration,
  REPETITIVE_MEMBER,
  TEMPERATURE,
  type TemperatureRange,
} from '../design-values/adjustmentFactors.ts';
import { type ReferenceValues, TABLE_4B_ADJUSTMENTS } from '../design-values/sawnLumber.ts';
import { type Citation, SOURCE_LINKS } from '../design-values/sources.ts';
import type { AppliedFactor, Quantity } from './types.ts';

// Adjusted design values for sawn lumber bending members, ASD (NDS 2024, 4.3 and Table 4.3.1):
//   Fb' = Fb · C_D · C_M · C_t · C_L · C_F · C_fu · C_i · C_r
//   Fv' = Fv · C_D · C_M · C_t · C_i
//   E'  = E · C_M · C_t · C_i
//   Emin' = Emin · C_M · C_t · C_i       (C_T applies only to truss chords, NDS 4.4.2)
// C_fu is 1.0 because members here bend about their strong axis (load on the narrow face).

/** Conditions of use the template states for a member, each with its reason. */
export interface ServiceConditions {
  /** Moisture content in service above 19% for an extended time (NDS 4.1.4). */
  wet: { value: boolean; reason: string };
  temperature: { value: TemperatureRange; reason: string };
  loadDuration: { value: LoadDuration; reason: string };
  /** Whether NDS 4.3.9 applies (three or more members sharing load). */
  repetitive: { value: boolean; reason: string };
  /** Water-borne preservative treatment, which caps C_D at 1.6 (NDS 4.3.13). */
  waterborneTreatment: boolean;
}

export interface Material {
  reference: ReferenceValues;
  /** Species and grade as shown to the user, such as 'Southern Pine No.2'. */
  name: string;
  /** Which table and row the values came from. */
  sources: Citation[];
  /** Whether the lumber is incised (NDS 4.3.8). */
  incised: boolean;
}

export interface AdjustedValues {
  Fb: number;
  Fv: number;
  E: number;
  Emin: number;
  factors: AppliedFactor[];
  /** Working for C_L. */
  stabilitySteps: Quantity[];
  /** Set when the slenderness ratio exceeds the NDS limit of 50 (3.3.3.7). */
  slendernessExceeded: boolean;
}

/** Bending member geometry for beam stability (one ply of a built-up member). */
export interface StabilityGeometry {
  breadth: number;
  depth: number;
  /** Distance between points of lateral support that prevent rotation (NDS 3.3.3.4). */
  unbracedLength: number;
}

const ch3 = (locator: string): Citation => ({
  source: 'nds-2024',
  locator,
  url: SOURCE_LINKS.ndsChapter3,
});

/**
 * Effective length for a single span with loading not listed in NDS Table 3.3.3 (footnote 1),
 * which covers point loads at arbitrary positions.
 */
export function effectiveLength(lu: number, d: number): { le: number; rule: string } {
  const ratio = lu / d;
  if (ratio < 7) return { le: 2.06 * lu, rule: 'ℓe = 2.06·ℓu (ℓu/d < 7)' };
  if (ratio <= 14.3) return { le: 1.63 * lu + 3 * d, rule: 'ℓe = 1.63·ℓu + 3d (7 ≤ ℓu/d ≤ 14.3)' };
  return { le: 1.84 * lu, rule: 'ℓe = 1.84·ℓu (ℓu/d > 14.3)' };
}

/**
 * Beam stability factor (NDS 3.3.3):
 *   R_B = √(ℓe·d / b²), F_bE = 1.20·Emin' / R_B²,
 *   C_L = (1 + F_bE/Fb*)/1.9 − √([(1 + F_bE/Fb*)/1.9]² − (F_bE/Fb*)/0.95).
 */
export function beamStabilityFactor(
  FbStar: number,
  EminPrime: number,
  g: StabilityGeometry,
): { CL: number; steps: Quantity[]; RB: number; rule: string } {
  if (g.depth <= g.breadth) {
    return { CL: 1, steps: [], RB: 0, rule: 'd ≤ b, so C_L = 1.0 (NDS 3.3.3.1)' };
  }
  const { le, rule } = effectiveLength(g.unbracedLength, g.depth);
  const RB = Math.sqrt((le * g.depth) / (g.breadth * g.breadth));
  const FbE = (1.2 * EminPrime) / (RB * RB);
  const ratio = FbE / FbStar;
  const h = (1 + ratio) / 1.9;
  const CL = h - Math.sqrt(h * h - ratio / 0.95);
  const sources = [ch3('3.3.3 and Table 3.3.3, pp. 17-18')];
  return {
    CL,
    RB,
    rule,
    steps: [
      { symbol: 'ℓu', label: 'Unbraced length', value: g.unbracedLength, unit: 'in' },
      { symbol: 'ℓe', label: `Effective length, ${rule}`, value: le, unit: 'in', sources },
      { symbol: 'R_B', label: 'Slenderness ratio, √(ℓe·d / b²)', value: RB, unit: '', sources },
      {
        symbol: 'Fb*',
        label: 'Fb with all factors except C_L and C_fu',
        value: FbStar,
        unit: 'psi',
      },
      { symbol: "Emin'", label: 'Adjusted Emin', value: EminPrime, unit: 'psi' },
      { symbol: 'F_bE', label: "1.20·Emin' / R_B²", value: FbE, unit: 'psi', sources },
    ],
  };
}

export function adjustedValues(
  material: Material,
  conditions: ServiceConditions,
  stability: StabilityGeometry,
): AdjustedValues {
  const ref = material.reference;
  const wet = conditions.wet.value;
  const wetTable = TABLE_4B_ADJUSTMENTS.wetService;

  const CD = LOAD_DURATION[conditions.loadDuration.value].C_D;
  const CF = TABLE_4B_ADJUSTMENTS.sizeFactor.Fb;
  const CMFb = wet && ref.Fb * CF > wetTable.Fb.oneWhenFbCfAtMost ? wetTable.Fb.factor : 1;
  const CMFv = wet ? wetTable.Fv : 1;
  const CME = wet ? wetTable.E : 1;
  const CMEmin = wet ? wetTable.Emin : 1;
  const t = TEMPERATURE[conditions.temperature.value];
  const moisture = wet ? 'wet' : 'dry';
  const CtFb = t.Fb[moisture];
  const CtFv = t.Fv[moisture];
  const CtE = t.E;
  const Ci = material.incised;
  const CiFb = Ci ? INCISING.Fb : 1;
  const CiFv = Ci ? INCISING.Fv : 1;
  const CiE = Ci ? INCISING.E : 1;
  const CiEmin = Ci ? INCISING.Emin : 1;
  const Cr = conditions.repetitive.value ? REPETITIVE_MEMBER.Fb : 1;

  const FbStar = ref.Fb * CD * CMFb * CtFb * CF * CiFb * Cr;
  const EminPrime = ref.Emin * CMEmin * CtE * CiEmin;
  const stab = beamStabilityFactor(FbStar, EminPrime, stability);

  const wetReason = wet
    ? `${conditions.wet.reason} Fb·C_F = ${ref.Fb * CF} psi${CMFb === 1 ? `, at or below ${wetTable.Fb.oneWhenFbCfAtMost} psi, so C_M = 1.0 for Fb` : ''}.`
    : conditions.wet.reason;

  const factors: AppliedFactor[] = [
    {
      symbol: 'C_D',
      name: 'Load duration',
      value: CD,
      appliesTo: ['Fb', 'Fv'],
      reason: `${LOAD_DURATION[conditions.loadDuration.value].description}. ${conditions.loadDuration.reason}`,
      sources: [...LOAD_DURATION.sources],
    },
    {
      symbol: 'C_M',
      name: 'Wet service',
      value: CMFb,
      appliesTo: ['Fb'],
      reason: wetReason,
      sources: [...wetTable.sources],
    },
    {
      symbol: 'C_M',
      name: 'Wet service',
      value: CMFv,
      appliesTo: ['Fv'],
      reason: conditions.wet.reason,
      sources: [...wetTable.sources],
    },
    {
      symbol: 'C_M',
      name: 'Wet service',
      value: CME,
      appliesTo: ['E', 'Emin'],
      reason: conditions.wet.reason,
      sources: [...wetTable.sources],
    },
    {
      symbol: 'C_t',
      name: 'Temperature',
      value: CtFb,
      appliesTo: ['Fb', 'Fv'],
      reason: conditions.temperature.reason,
      sources: [...TEMPERATURE.sources],
    },
    {
      symbol: 'C_t',
      name: 'Temperature',
      value: CtE,
      appliesTo: ['E', 'Emin'],
      reason: conditions.temperature.reason,
      sources: [...TEMPERATURE.sources],
    },
    {
      symbol: 'C_L',
      name: 'Beam stability',
      value: stab.CL,
      appliesTo: ['Fb'],
      reason: `Computed from the unbraced length between supports that prevent rotation; ${stab.rule}.`,
      sources: [ch3('3.3.3, pp. 17-18')],
    },
    {
      symbol: 'C_F',
      name: 'Size',
      value: CF,
      appliesTo: ['Fb'],
      reason: 'Size adjustment is already in the tabulated Southern Pine values for this size.',
      sources: [...TABLE_4B_ADJUSTMENTS.sizeFactor.sources],
    },
    {
      symbol: 'C_fu',
      name: 'Flat use',
      value: 1,
      appliesTo: ['Fb'],
      reason: 'Loaded on the narrow face (bending about the strong axis).',
      sources: [{ source: 'nds-2024', locator: '4.3.7, p. 31', url: SOURCE_LINKS.ndsChapter4 }],
    },
    {
      symbol: 'C_i',
      name: 'Incising',
      value: CiFb,
      appliesTo: ['Fb', 'Fv'],
      reason: Ci ? 'The lumber is incised.' : 'The lumber is not incised.',
      sources: [...INCISING.sources],
    },
    {
      symbol: 'C_i',
      name: 'Incising',
      value: CiE,
      appliesTo: ['E', 'Emin'],
      reason: Ci ? 'The lumber is incised.' : 'The lumber is not incised.',
      sources: [...INCISING.sources],
    },
    {
      symbol: 'C_r',
      name: 'Repetitive member',
      value: Cr,
      appliesTo: ['Fb'],
      reason: conditions.repetitive.reason,
      sources: [...REPETITIVE_MEMBER.sources],
    },
  ];

  return {
    Fb: FbStar * stab.CL,
    Fv: ref.Fv * CD * CMFv * CtFv * CiFv,
    E: ref.E * CME * CtE * CiE,
    Emin: EminPrime,
    factors,
    stabilitySteps: stab.steps,
    slendernessExceeded: stab.RB > 50,
  };
}
