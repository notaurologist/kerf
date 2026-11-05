// A bounded knapsack by dynamic programming over item types: after each type, the states are the
// (weight, value) pairs reachable so far that no other state beats on both, so it is exact for
// weights in fractions of an inch, without rounding them onto a grid (hard rule 4).

export interface KnapsackItem {
  weight: number;
  value: number;
  /** Most copies allowed. */
  limit: number;
}

export interface Packed {
  value: number;
  weight: number;
  /** Copies of each item, by index. */
  counts: number[];
}

const EPS = 1e-9;

export function knapsack(items: readonly KnapsackItem[], capacity: number): Packed {
  let states: Packed[] = [{ value: 0, weight: 0, counts: [] }];
  items.forEach((item, i) => {
    const next: Packed[] = [];
    for (const state of states) {
      for (let k = 0; k <= item.limit; k++) {
        const weight = state.weight + k * item.weight;
        if (weight > capacity + EPS) break;
        const counts = [...state.counts];
        counts[i] = k;
        next.push({ value: state.value + k * item.value, weight, counts });
      }
    }
    next.sort((a, b) => a.weight - b.weight || b.value - a.value);
    states = [];
    for (const s of next) {
      const last = states.at(-1);
      if (!last || s.value > last.value + EPS) states.push(s);
    }
  });
  const best = states.reduce((a, b) => (b.value > a.value + EPS ? b : a));
  return { ...best, counts: items.map((_, i) => best.counts[i] ?? 0) };
}
