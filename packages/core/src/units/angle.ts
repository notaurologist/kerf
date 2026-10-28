// Angles follow the miter-saw convention (DOMAIN.md, Units): degrees measured from a square cut,
// so 0° is square. The same number applies to bevels, measured from a square (90°) edge.
// A protractor or sliding bevel laid against the board's edge reads the complement, 90° minus
// the setting. Mixing the two up (15° vs. 75°) is the most likely cause of a recut, so every
// cut detail shows both, labeled.

/** Saw settings run from 0° (square) up to, but not including, 90°. */
function assertSetting(degrees: number): void {
  if (!Number.isFinite(degrees) || degrees < 0 || degrees >= 90) {
    throw new RangeError(`Saw setting must be at least 0° and less than 90°, got ${degrees}`);
  }
}

/** Angle between the cut line and the board's edge, for a given saw setting. */
export function angleToEdge(setting: number): number {
  assertSetting(setting);
  return 90 - setting;
}

/** Saw setting for a cut line that meets the board's edge at `edgeAngle` degrees. */
export function settingFromEdgeAngle(edgeAngle: number): number {
  if (!Number.isFinite(edgeAngle) || edgeAngle <= 0 || edgeAngle > 90) {
    throw new RangeError(
      `Angle to the edge must be more than 0° and at most 90°, got ${edgeAngle}`,
    );
  }
  return 90 - edgeAngle;
}

/** Degrees to one decimal place: "0.0°", "22.5°". Display only; never compute with the result. */
export function formatAngle(degrees: number): string {
  if (!Number.isFinite(degrees)) {
    throw new RangeError(`Angle must be a finite number, got ${degrees}`);
  }
  // Adding 0 turns -0 into 0 so a tiny negative rounding error never shows as "-0.0°".
  const tenths = Math.round(degrees * 10) / 10 + 0;
  return `${tenths.toFixed(1)}°`;
}
