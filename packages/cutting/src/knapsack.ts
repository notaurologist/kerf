import { COST, type Work } from './work.ts';

// A bounded knapsack by branch-and-bound (Horowitz and Sahni, "Computing partitions with
// applications to the knapsack problem", Journal of the ACM 21(2), 1974; Martello and Toth,
// Knapsack Problems, 1990, ch. 3). Items are tried most valuable per inch first, each at every
// count from the most that fits down to none, and a branch is cut when even filling the rest of
// the room at the best remaining value per inch, fractions allowed, cannot beat the best found.
// It works on the weights as given, so piece lengths in fractions of an inch stay exact (hard
// rule 4). A dynamic program over (weight, value) pairs was tried first and was also exact, but
// with many short pieces it kept tens of thousands of pairs and took about half a second a call.

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

export function knapsack(items: readonly KnapsackItem[], capacity: number, work?: Work): Packed {
  const order = items
    .map((item, i) => ({ ...item, i }))
    .filter((item) => item.value > EPS && item.limit > 0 && item.weight <= capacity + EPS)
    .sort((a, b) => b.value / b.weight - a.value / a.weight);
  const counts = new Array<number>(items.length).fill(0);
  let best: Packed = { value: 0, weight: 0, counts: [...counts] };

  /** The most value items from `k` on could add in `room`, fractions allowed. */
  const fractional = (k: number, room: number): number => {
    let value = 0;
    for (let j = k; j < order.length && room > EPS; j++) {
      const item = order[j];
      if (!item) break;
      const take = Math.min(item.limit, room / item.weight);
      value += take * item.value;
      room -= take * item.weight;
    }
    return value;
  };

  const visit = (k: number, weight: number, value: number) => {
    work?.spend(COST.knapsackStep);
    if (value > best.value + EPS) best = { value, weight, counts: [...counts] };
    if (k === order.length) return;
    if (value + fractional(k, capacity - weight) <= best.value + EPS) return;
    const item = order[k];
    if (!item) return;
    const most = Math.min(item.limit, Math.floor((capacity - weight + EPS) / item.weight));
    for (let n = most; n >= 0; n--) {
      counts[item.i] = n;
      visit(k + 1, weight + n * item.weight, value + n * item.value);
    }
    counts[item.i] = 0;
  };
  visit(0, 0, 0);
  return best;
}
