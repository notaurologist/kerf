import type { HardwareItem } from '../templates/types.ts';
import { formatLength, toSixteenths } from '../units/length.ts';

// Hardware lines for the shopping list (PRODUCT.md, MVP feature 4). Bolts with the same diameter
// and grip share a line; washers, locking nuts, and caps are totaled per diameter.

export interface HardwareLine {
  description: string;
  quantity: number;
}

export interface HardwareList {
  lines: HardwareLine[];
  notes: string[];
}

export function hardwareList(items: readonly HardwareItem[]): HardwareList {
  const boltLines = new Map<string, HardwareLine>();
  const perDiameter = new Map<number, number>();
  const others: HardwareLine[] = [];

  for (const item of items) {
    if (!item.bolt) {
      others.push({ description: item.name, quantity: item.quantity });
      continue;
    }
    const { diameter, grip } = item.bolt;
    // Grip is grouped as displayed, so two bolts that print the same share one line.
    const key = `${diameter}/${toSixteenths(grip)}`;
    const line = boltLines.get(key) ?? {
      description: `${formatLength(diameter)} through-bolt, grip ${formatLength(grip)}`,
      quantity: 0,
    };
    line.quantity += item.quantity;
    boltLines.set(key, line);
    perDiameter.set(diameter, (perDiameter.get(diameter) ?? 0) + item.quantity);
  }

  const fittings: HardwareLine[] = [];
  for (const [diameter, count] of [...perDiameter].sort(([a], [b]) => a - b)) {
    const size = formatLength(diameter);
    fittings.push(
      { description: `${size} flat washers`, quantity: 2 * count },
      { description: `${size} locking nuts`, quantity: count },
      { description: `${size} bolt caps`, quantity: count },
    );
  }

  return {
    lines: [...boltLines.values(), ...fittings, ...others],
    notes: [
      'Bolt length: at least the grip plus two washers and the nut, and no more than one bolt diameter past the nut (CPSC Pub. 324, p. 3).',
      "All hardware corrosion-resistant and compatible with the lumber's pressure treatment (CPSC Pub. 324, p. 3).",
    ],
  };
}
