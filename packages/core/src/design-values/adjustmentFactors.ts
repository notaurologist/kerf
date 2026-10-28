import { SOURCE_LINKS } from './sources.ts';

// Adjustment factors from the NDS 2024 that do not depend on the species table (ASD). Which
// factors apply to which design value follows NDS Table 4.3.1, corroborated by SPIB's excerpt in
// Table A-1:
//   Fb'   = Fb · C_D · C_M · C_t · C_L · C_F · C_fu · C_i · C_r
//   Fv'   = Fv · C_D · C_M · C_t · C_i
//   E'    = E · C_M · C_t · C_i
//   Emin' = Emin · C_M · C_t · C_i · C_T

export const FACTOR_APPLICABILITY_SOURCES = [
  {
    source: 'nds-2024',
    locator: 'Table 4.3.1, Applicability of Adjustment Factors for Sawn Lumber, p. 31',
    url: SOURCE_LINKS.ndsChapter4,
  },
  { source: 'spib-southern-pine-2013', locator: 'Table A-1 (corroborating)' },
] as const;

/** Load duration factor C_D (NDS 2.3.2, Table 2.3.2). Not applied to E, Emin, or Fc⊥. */
export const LOAD_DURATION = {
  permanent: { C_D: 0.9, description: 'Permanent (dead load)' },
  'ten-years': { C_D: 1.0, description: 'Ten years (occupancy live load)' },
  'two-months': { C_D: 1.15, description: 'Two months (snow load)' },
  'seven-days': { C_D: 1.25, description: 'Seven days (construction load)' },
  'ten-minutes': { C_D: 1.6, description: 'Ten minutes (wind or earthquake load)' },
  /** Not permitted for members pressure-treated with water-borne preservatives (NDS 4.3.13). */
  impact: { C_D: 2.0, description: 'Impact' },
  sources: [
    {
      source: 'nds-2024',
      locator: '2.3.2 and Table 2.3.2, p. 13; 4.3.2 and 4.3.13, pp. 30-32',
      url: SOURCE_LINKS.ndsChapter2,
    },
  ],
} as const;

export type LoadDuration = Exclude<keyof typeof LOAD_DURATION, 'sources'>;

/**
 * Temperature factor C_t (NDS 2.3.3, Table 2.3.3), for sustained exposure to elevated
 * temperature. Keyed by the in-service temperature range.
 */
export const TEMPERATURE = {
  'up-to-100F': { Fb: { dry: 1.0, wet: 1.0 }, Fv: { dry: 1.0, wet: 1.0 }, E: 1.0 },
  '100F-to-125F': { Fb: { dry: 0.8, wet: 0.7 }, Fv: { dry: 0.8, wet: 0.7 }, E: 0.9 },
  '125F-to-150F': { Fb: { dry: 0.7, wet: 0.5 }, Fv: { dry: 0.7, wet: 0.5 }, E: 0.9 },
  sources: [
    { source: 'nds-2024', locator: '2.3.3 and Table 2.3.3, p. 13', url: SOURCE_LINKS.ndsChapter2 },
  ],
} as const;

export type TemperatureRange = Exclude<keyof typeof TEMPERATURE, 'sources'>;

/**
 * Incising factor C_i for dimension lumber incised parallel to grain up to 0.4" deep, 3/8" long,
 * 1100 incisions per square foot (NDS 4.3.8, Table 4.3.8).
 */
export const INCISING = {
  Fb: 0.8,
  Fv: 0.8,
  E: 0.95,
  Emin: 0.95,
  sources: [
    { source: 'nds-2024', locator: '4.3.8 and Table 4.3.8, p. 32', url: SOURCE_LINKS.ndsChapter4 },
  ],
} as const;

/**
 * Repetitive member factor C_r for Fb of 2" to 4" thick dimension lumber: three or more members in
 * contact or at most 24" on center, joined by load-distributing elements (NDS 4.3.9).
 */
export const REPETITIVE_MEMBER = {
  Fb: 1.15,
  minimumMembers: 3,
  sources: [{ source: 'nds-2024', locator: '4.3.9, p. 32', url: SOURCE_LINKS.ndsChapter4 }],
} as const;
