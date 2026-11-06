// What the script that writes fixtures needs to run a template's sweep and record its digest
// (decision 0014). Running a sweep hashes with node:crypto, so it stays out of the main entry.

export { SWEEPS } from './index.ts';
export { digestJson, seeded, sweep, sweepDigest } from './sweep.ts';
