// Part letters (#44, #66): each part gets a letter in cut-list order, A, B, C, as woodworking-
// magazine plans letter their materials lists. Both instances of a pair are one part, so they
// share it. Drawings take a part's letter from the part, so a drawing and the cut list cannot
// disagree. Generic: any template letters its parts with these.

/** The letter for the part at `index` in cut-list order: A to Z, then AA, AB, and on. */
export function partLetter(index: number): string {
  if (!Number.isInteger(index) || index < 0) throw new Error(`No part letter for ${index}`);
  let n = index;
  let letter = '';
  do {
    letter = String.fromCharCode(65 + (n % 26)) + letter;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return letter;
}

/** Parts in cut-list order, each with its letter. */
export function withLetters<T extends object>(parts: readonly T[]): (T & { letter: string })[] {
  return parts.map((part, i) => ({ ...part, letter: partLetter(i) }));
}
