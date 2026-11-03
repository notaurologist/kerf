import { z } from 'zod';
import type { HardwareItem } from '../model/types.ts';
import { MissingInput } from '../structural/types.ts';
import { formatLength, toSixteenths } from '../units/length.ts';

// Hardware lines for the shopping list (PRODUCT.md, MVP feature 4). Bolts with the same diameter,
// length, and grip share a line, named by the length to buy, and the fittings each bolt calls for
// (washers, nuts, caps) are totaled per diameter. Which fittings a bolt needs, which store group
// each item is in, and each item's notes come from the template; a line shows the notes of every
// item on it, once each. Lines in different groups never share. A bolt line also keeps its bolt's
// size, the lengths that fit every bolt on it, and its items, so a bolt bought from it can be
// compared with a later plan (#514).

export const HardwareLine = z.object({
  description: z.string(),
  /** Absent while its item's quantity waits for an input (`HardwareItem.quantityNeeded`). */
  quantity: z.number().int().optional(),
  quantityNeeded: MissingInput.optional(),
  /** The item's store group (`HardwareItem.group`); a fitting takes its bolt's. */
  group: z.string().optional(),
  /** The notes of the items on the line (`HardwareItem.notes`). A fitting has none. */
  notes: z.array(z.string()).default([]),
  /**
   * A through-bolt line's bolt: its diameter, grip, and length to buy, the lengths that fit every
   * bolt on the line (absent when any of them has none), and the IDs of the items on it. Absent on
   * other lines and in plans made before it.
   */
  bolt: z
    .object({
      diameter: z.number(),
      grip: z.number(),
      length: z.number().optional(),
      fits: z.object({ min: z.number(), max: z.number() }).optional(),
      items: z.array(z.string()),
    })
    .optional(),
});
export type HardwareLine = z.infer<typeof HardwareLine>;

export function hardwareList(items: readonly HardwareItem[]): HardwareLine[] {
  const boltLines = new Map<string, HardwareLine>();
  const fittings = new Map<
    string,
    {
      diameter: number;
      group: string;
      washers: number;
      locking: number;
      plain: number;
      caps: number;
    }
  >();
  const others: HardwareLine[] = [];
  for (const item of items) {
    const { quantity } = item;
    if (!item.bolt || quantity === undefined) {
      others.push({
        description: item.name,
        ...(quantity === undefined ? {} : { quantity }),
        ...(item.quantityNeeded ? { quantityNeeded: item.quantityNeeded } : {}),
        group: item.group,
        notes: item.notes,
      });
      continue;
    }
    const { diameter, grip, length, fits, washers, nut, cap } = item.bolt;
    // Grip is grouped as displayed, so two bolts that print the same share one line.
    const key = `${item.group}/${diameter}/${length}/${toSixteenths(grip)}`;
    const existing = boltLines.get(key);
    const line = existing ?? {
      description:
        length === undefined
          ? `${formatLength(diameter)} through-bolt, grip ${formatLength(grip)}`
          : `${formatLength(diameter)} × ${formatLength(length)} through-bolt`,
      quantity: 0,
      group: item.group,
      notes: [],
    };
    line.quantity = (line.quantity ?? 0) + quantity;
    line.notes = [...new Set([...line.notes, ...item.notes])];
    const before = existing?.bolt;
    const lineFits = !before ? fits : before.fits && fits ? both(before.fits, fits) : undefined;
    line.bolt = {
      diameter,
      grip: before?.grip ?? grip,
      ...(length === undefined ? {} : { length }),
      ...(lineFits ? { fits: lineFits } : {}),
      items: [...(before?.items ?? []), item.id],
    };
    boltLines.set(key, line);

    const fittingKey = `${item.group}/${diameter}`;
    const f = fittings.get(fittingKey) ?? {
      diameter,
      group: item.group,
      washers: 0,
      locking: 0,
      plain: 0,
      caps: 0,
    };
    f.washers += washers * quantity;
    if (nut === 'locking') f.locking += quantity;
    else f.plain += quantity;
    if (cap) f.caps += quantity;
    fittings.set(fittingKey, f);
  }

  const fittingLines: HardwareLine[] = [];
  for (const f of [...fittings.values()].sort((a, b) => a.diameter - b.diameter)) {
    const size = formatLength(f.diameter);
    const add = (description: string, quantity: number) => {
      if (quantity > 0) {
        fittingLines.push({
          description: `${size} ${description}`,
          quantity,
          group: f.group,
          notes: [],
        });
      }
    };
    add('flat washers', f.washers);
    add('locking nuts', f.locking);
    add('nuts', f.plain);
    add('bolt caps', f.caps);
  }

  return [...boltLines.values(), ...fittingLines, ...others];
}

/** The lengths that fit both ranges. */
function both(a: { min: number; max: number }, b: { min: number; max: number }) {
  return { min: Math.max(a.min, b.min), max: Math.min(a.max, b.max) };
}
