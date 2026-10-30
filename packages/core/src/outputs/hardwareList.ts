import { z } from 'zod';
import type { HardwareItem } from '../templates/types.ts';
import { formatLength, toSixteenths } from '../units/length.ts';

// Hardware lines for the shopping list (PRODUCT.md, MVP feature 4). Bolts with the same diameter
// and grip share a line, and the fittings each bolt calls for (washers, nuts, caps) are totaled
// per diameter. Which fittings a bolt needs, which store group each item is in, and any notes for
// the list come from the template. Lines in different groups never share.

export const HardwareLine = z.object({
  description: z.string(),
  quantity: z.number().int(),
  /** The item's store group (`HardwareItem.group`); a fitting takes its bolt's. */
  group: z.string().optional(),
});
export type HardwareLine = z.infer<typeof HardwareLine>;

export function hardwareList(items: readonly HardwareItem[]): HardwareLine[] {
  const boltLines = new Map<string, HardwareLine>();
  const fittings = new Map<
    string,
    {
      diameter: number;
      group: string | undefined;
      washers: number;
      locking: number;
      plain: number;
      caps: number;
    }
  >();
  const others: HardwareLine[] = [];
  const inGroup = (group: string | undefined) => (group === undefined ? {} : { group });

  for (const item of items) {
    if (!item.bolt) {
      others.push({ description: item.name, quantity: item.quantity, ...inGroup(item.group) });
      continue;
    }
    const { diameter, grip, washers, nut, cap } = item.bolt;
    // Grip is grouped as displayed, so two bolts that print the same share one line.
    const key = `${item.group ?? ''}/${diameter}/${toSixteenths(grip)}`;
    const line = boltLines.get(key) ?? {
      description: `${formatLength(diameter)} through-bolt, grip ${formatLength(grip)}`,
      quantity: 0,
      ...inGroup(item.group),
    };
    line.quantity += item.quantity;
    boltLines.set(key, line);

    const fittingKey = `${item.group ?? ''}/${diameter}`;
    const f = fittings.get(fittingKey) ?? {
      diameter,
      group: item.group,
      washers: 0,
      locking: 0,
      plain: 0,
      caps: 0,
    };
    f.washers += washers * item.quantity;
    if (nut === 'locking') f.locking += item.quantity;
    else f.plain += item.quantity;
    if (cap) f.caps += item.quantity;
    fittings.set(fittingKey, f);
  }

  const fittingLines: HardwareLine[] = [];
  for (const f of [...fittings.values()].sort((a, b) => a.diameter - b.diameter)) {
    const size = formatLength(f.diameter);
    const add = (description: string, quantity: number) => {
      if (quantity > 0) {
        fittingLines.push({ description: `${size} ${description}`, quantity, ...inGroup(f.group) });
      }
    };
    add('flat washers', f.washers);
    add('locking nuts', f.locking);
    add('nuts', f.plain);
    add('bolt caps', f.caps);
  }

  return [...boltLines.values(), ...fittingLines, ...others];
}
