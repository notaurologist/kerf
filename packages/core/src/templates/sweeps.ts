import { SWEEP as recordCabinet } from './record-cabinet/sweep.ts';
import type { SweepPlan } from './sweep.ts';
import { SWEEP as swingSetAFrame } from './swing-set-a-frame/sweep.ts';
import { SWEEP as workbench } from './workbench/sweep.ts';

// Every template's seeded sweep, by template ID: for tests and the script that writes each
// version's digest (decision 0014). Not part of the app, so kept out of the package's main entry.

export { type SweepDigest, sweep, sweepDigest } from './sweep.ts';

export const SWEEPS: Readonly<Record<string, SweepPlan>> = {
  'swing-set-a-frame': swingSetAFrame,
  'record-cabinet': recordCabinet,
  workbench,
};
