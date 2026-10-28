import { z } from 'zod';
import type { HardwareItem } from '../templates/types.ts';
import { formatLength, toSixteenths } from '../units/length.ts';

// Hardware lines for the shopping list (PRODUCT.md, MVP feature 4). Bolts with the same diameter
// and grip share a line, and the fittings each bolt calls for (washers, nuts, caps) are totaled
// per diameter. Which fittings a bolt needs, and any notes for the list, come from the template.

export const HardwareLine = z.object({
  description: z.string(),
  quantity: z.number().int(),
});
export type HardwareLine = z.infer<typeof HardwareLine>;

export function hardwareList(items: readonly HardwareItem[]): HardwareLine[] {
  const boltLines = new Map<string, HardwareLine>();
  const fittings = new Map<
    number,
    { washers: number; locking: number; plain: number; caps: number }
  >();
  const others: HardwareLine[] = [];

  for (const item of items) {
    if (!item.bolt) {
      others.push({ description: item.name, quantity: item.quantity });
      continue;
    }
    const { diameter, grip, washers, nut, cap } = item.bolt;
    // Grip is grouped as displayed, so two bolts that print the same share one line.
    const key = `${diameter}/${toSixteenths(grip)}`;
    const line = boltLines.get(key) ?? {
      description: `${formatLength(diameter)} through-bolt, grip ${formatLength(grip)}`,
      quantity: 0,
    };
    line.quantity += item.quantity;
    boltLines.set(key, line);

    const f = fittings.get(diameter) ?? { washers: 0, locking: 0, plain: 0, caps: 0 };
    f.washers += washers * item.quantity;
    if (nut === 'locking') f.locking += item.quantity;
    else f.plain += item.quantity;
    if (cap) f.caps += item.quantity;
    fittings.set(diameter, f);
  }

  const fittingLines: HardwareLine[] = [];
  for (const [diameter, f] of [...fittings].sort(([a], [b]) => a - b)) {
    const size = formatLength(diameter);
    const add = (description: string, quantity: number) => {
      if (quantity > 0) fittingLines.push({ description: `${size} ${description}`, quantity });
    };
    add('flat washers', f.washers);
    add('locking nuts', f.locking);
    add('nuts', f.plain);
    add('bolt caps', f.caps);
  }

  return [...boltLines.values(), ...fittingLines, ...others];
}
