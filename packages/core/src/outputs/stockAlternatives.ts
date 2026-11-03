import type { FieldRef } from '../model/form.ts';
import type { CheckResult, ComputedCheck } from '../structural/types.ts';
import { type LumberAlternative, type LumberPlan, lumberLineKey } from './shoppingList.ts';

// Another stock size for a line's parts when the store has none of its boards (#450). Changing a
// part's size changes the plan, so each size is generated in full by the template, and offered
// only when the checks that read the size are left with no lower margin than the plan has now.
// Generic: the template names its stock parameters and does the generating.

export interface StockField {
  /** The parameter that sets these parts' stock, by its form path. */
  path: string;
  /** The parts it sizes, as an alternative names them, such as "Legs". */
  name: string;
  partIds: readonly string[];
  current: string;
  /** Every size the parameter takes, the current one included. */
  options: readonly string[];
}

/** The lowest margin among some checks, or null when any of them has none. */
function lowest(checks: readonly CheckResult[]): ComputedCheck | null {
  const computed = checks.filter((c): c is ComputedCheck => c.status === 'computed');
  if (computed.length === 0 || computed.length < checks.length) return null;
  return computed.reduce((low, c) => (c.margin < low.margin ? c : low));
}

/**
 * Adds each field's other sizes to the lumber lines that hold its parts. `checks` and what
 * `regenerate` returns are the plan's checks in the template's order, which a parameter's value
 * does not change. A field no check reads is left out, since there is no margin to give; a size
 * the template cannot generate is left out too.
 */
export function withStockAlternatives(
  lumber: LumberPlan,
  checks: readonly CheckResult[],
  fields: readonly StockField[],
  checkFields: (check: CheckResult) => readonly FieldRef[],
  regenerate: (path: string, nominal: string) => readonly CheckResult[] | null,
): LumberPlan {
  const added = new Map<string, LumberAlternative[]>();
  for (const field of fields) {
    const reads = checks.flatMap((check, i) =>
      checkFields(check).some((f) => f.from === 'params' && f.path === field.path) ? [i] : [],
    );
    if (reads.length === 0) continue;
    const now = lowest(reads.map((i) => checks[i] as CheckResult));
    const alternatives: LumberAlternative[] = [];
    if (!now) {
      alternatives.push({ kind: 'stock-needs-inputs', name: field.name, field: field.path });
    } else {
      const sizes = field.options.flatMap((nominal) => {
        if (nominal === field.current) return [];
        const regenerated = regenerate(field.path, nominal);
        const low = regenerated && lowest(reads.map((i) => regenerated[i] as CheckResult));
        return low && low.margin >= now.margin ? [{ nominal, low }] : [];
      });
      for (const { nominal, low } of sizes.sort((a, b) => b.low.margin - a.low.margin)) {
        alternatives.push({
          kind: 'stock',
          name: field.name,
          field: field.path,
          nominal,
          margin: low.margin,
          check: { title: low.title, subject: low.subject },
        });
      }
    }
    const lines = new Set(
      lumber.boards
        .filter((b) => b.pieces.some((p) => field.partIds.includes(p.partId)))
        .map(lumberLineKey),
    );
    for (const key of lines) added.set(key, [...(added.get(key) ?? []), ...alternatives]);
  }
  return {
    ...lumber,
    lines: lumber.lines.map((line) => ({
      ...line,
      alternatives: [...line.alternatives, ...(added.get(lumberLineKey(line)) ?? [])],
    })),
  };
}
