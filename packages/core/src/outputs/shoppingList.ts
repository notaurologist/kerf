import { z } from 'zod';
import { solveCached } from '../cutting/cache.ts';
import { WORK_LIMIT } from '../cutting/exact.ts';
import { firstFitDecreasing } from '../cutting/firstFit.ts';
import type { CutInstance } from '../cutting/instance.ts';
import type { BoardStock } from '../lumber/panel.ts';
import { isBoardStock, isPanel, isStripGlueUp } from '../lumber/partStock.ts';
import { stripBoardsFor } from '../lumber/strips.ts';
import { Issue, type Part } from '../model/types.ts';
import { formatMargin } from '../structural/types.ts';
import { formatBoardLength, formatLength, formatLimit } from '../units/length.ts';

// Groups parts into boards to buy (PRODUCT.md, MVP feature 4; DOMAIN.md, Buyable lengths). Each
// stock's pieces go onto the boards that buy the fewest feet the exact method finds within its
// work limit, with fewer boards as the tie-break (decision 0021). A panel's boards are pieces of
// its board stock, each the panel's board length. A strip glue-up's boards are too, each its
// strips' length, and enough of them for the strips ripped side by side.

export interface BoardOptions {
  /** Width of the saw blade's cut, charged once per piece. */
  kerf: number;
  /** Trimmed off each factory end before cutting, since factory ends are often not square. */
  trimPerEnd: number;
  /** Lengths the store sells dimension lumber in, in feet. Board stock gives its own. */
  buyableFeet: readonly number[];
  /** The longest board the owner can easily carry, in inches, when they entered one. */
  carryLength?: number;
}

export const DEFAULT_BOARD_OPTIONS: BoardOptions = {
  kerf: 0.125,
  trimPerEnd: 0.5,
  buyableFeet: [8, 10, 12, 14, 16],
};

/** Settings the owner enters once and every project's plan uses, like the tool inventory. */
export const OwnerSettings = z.object({
  /**
   * The longest board the owner can easily carry, in inches (#690). Null until entered, which
   * plans as if there were no limit. Kerf suggests none: it depends on the owner's vehicle.
   */
  carryLength: z.number().positive().finite().nullable(),
});
export type OwnerSettings = z.infer<typeof OwnerSettings>;

export const NO_OWNER_SETTINGS: OwnerSettings = { carryLength: null };

/** The settings with the revision they were read at, which a save must send back (0018). */
export const RevisedOwnerSettings = OwnerSettings.extend({
  revision: z.number().int().positive(),
});
export type RevisedOwnerSettings = z.infer<typeof RevisedOwnerSettings>;

/** The board options a plan is made with under the owner's settings. */
export function boardOptionsFor(settings: OwnerSettings = NO_OWNER_SETTINGS): BoardOptions {
  return settings.carryLength === null
    ? DEFAULT_BOARD_OPTIONS
    : { ...DEFAULT_BOARD_OPTIONS, carryLength: settings.carryLength };
}

/** A stock's name: a nominal size for dimension lumber, or the owner's name for board stock. */
const Nominal = z.string();

export const PlannedPiece = z.object({
  partId: z.string(),
  name: z.string(),
  length: z.number(),
});
export type PlannedPiece = z.infer<typeof PlannedPiece>;

export const PlannedBoard = z.object({
  nominal: Nominal,
  feet: z.number(),
  pieces: z.array(PlannedPiece),
  /** Board length left after trim, pieces, and kerf. */
  offcut: z.number(),
});
export type PlannedBoard = z.infer<typeof PlannedBoard>;

/**
 * What else holds a line's pieces when the store has none of its boards (#450), worked out when
 * the plan is made so it is there at the store without a signal (decision 0005).
 */
export const LumberAlternative = z.discriminatedUnion('kind', [
  /** Boards of other lengths that hold the same pieces, such as two 8' boards for one 14'. */
  z.object({
    kind: z.literal('lengths'),
    boards: z.array(z.object({ feet: z.number(), count: z.number().int() })),
  }),
  /** Boards one buyable length shorter, if each measures at least `atLeast` inches. */
  z.object({
    kind: z.literal('measured'),
    feet: z.number(),
    count: z.number().int(),
    atLeast: z.number(),
  }),
  /**
   * Another stock size for the parts a parameter sizes, which changes the plan, with the lowest
   * margin among the checks that read that parameter (`withStockAlternatives`).
   */
  z.object({
    kind: z.literal('stock'),
    /** The parts, as the alternative names them, such as "Legs". */
    name: z.string(),
    /** The parameter to change, by its form path. */
    field: z.string(),
    nominal: z.string(),
    margin: z.number(),
    check: z.object({ title: z.string(), subject: z.string() }),
  }),
  /** Another stock size, whose margins need the structural inputs before they can be given. */
  z.object({ kind: z.literal('stock-needs-inputs'), name: z.string(), field: z.string() }),
]);
export type LumberAlternative = z.infer<typeof LumberAlternative>;

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

/** An alternative as Shopping mode lists it under its line's "Not in stock?" (#450). */
export function describeLumberAlternative(
  alternative: LumberAlternative,
  line: Pick<ShoppingLine, 'nominal'>,
): string {
  const boards = (count: number, feet: number) =>
    `${count} × ${line.nominal}, ${formatBoardLength(feet)}`;
  switch (alternative.kind) {
    case 'lengths':
      return `${alternative.boards.map((b) => boards(b.count, b.feet)).join(' and ')}.`;
    case 'measured':
      return `${boards(alternative.count, alternative.feet)}, if ${alternative.count === 1 ? 'it measures' : 'each measures'} at least ${formatLimit(alternative.atLeast, 'min')}.`;
    case 'stock':
      return `${alternative.name} in ${alternative.nominal}, which changes the plan: ${formatMargin(alternative.margin)} under these assumptions (${lowerFirst(alternative.check.title)}, ${lowerFirst(alternative.check.subject)}).`;
    case 'stock-needs-inputs':
      return `${alternative.name} in another size changes the plan. Each size's margin is given once the structural inputs are entered.`;
  }
}

export const ShoppingLine = z.object({
  nominal: Nominal,
  feet: z.number(),
  count: z.number().int(),
  /** For stock sold by the board foot: the board feet these boards make, with the waste added. */
  boardFeet: z.number().optional(),
  /** Notes about this line's boards, such as a shorter length that works. */
  notes: z.array(z.string()).default([]),
  /** What to buy instead when the store has none of these boards. */
  alternatives: z.array(LumberAlternative).default([]),
});
export type ShoppingLine = z.infer<typeof ShoppingLine>;

export const LumberPlan = z.object({
  /** Boards in the order to cut them; each board's pieces in the order they come off it (#58). */
  boards: z.array(PlannedBoard),
  /**
   * The saw cut and end trim the boards were planned with (BoardOptions), so cutting steps can
   * say them.
   */
  kerf: z.number(),
  trimPerEnd: z.number(),
  /** The carry length the boards were planned with (BoardOptions), when the owner entered one. */
  carryLength: z.number().optional(),
  lines: z.array(ShoppingLine),
  /** Assumptions and tips for the whole list. Each line has its own notes too. */
  notes: z.array(z.string()),
  /** Parts that fit no buyable board. They are never dropped silently. */
  issues: z.array(Issue),
  /**
   * What to look for when choosing each part's board, by part ID: guide IDs from the knowledge
   * base, as the part lists them.
   */
  selection: z.array(z.object({ partId: z.string(), guides: z.array(z.string()) })),
});
export type LumberPlan = z.infer<typeof LumberPlan>;

/** A lumber line's key: its nominal size and length, such as "2x6/12" (#57). */
export function lumberLineKey(line: Pick<ShoppingLine, 'nominal' | 'feet'>): string {
  return `${line.nominal}/${line.feet}`;
}

/**
 * An ID for each board, in the board plan's order: its line's key and which board of that line it
 * is, from 1, such as "2x6/12/2" (#57). Boards of other sizes do not shift it, so saved progress on
 * a board survives a change that adds or removes boards of another size.
 */
export function boardIds(boards: readonly Pick<PlannedBoard, 'nominal' | 'feet'>[]): string[] {
  const seen = new Map<string, number>();
  return boards.map((board) => {
    const line = lumberLineKey(board);
    const n = (seen.get(line) ?? 0) + 1;
    seen.set(line, n);
    return `${line}/${n}`;
  });
}

/** Length a set of pieces uses on one board: trim at both ends, plus each piece and its kerf. */
function used(pieces: readonly PlannedPiece[], options: BoardOptions): number {
  return (
    2 * options.trimPerEnd + pieces.reduce((sum, piece) => sum + piece.length + options.kerf, 0)
  );
}

type FittedBoard = { feet: number; pieces: PlannedPiece[]; need: number; offcut: number };

/**
 * First-fit decreasing into the longest length, then each board shortened to the smallest length
 * that still holds its pieces. Pieces no length holds are returned apart.
 */
function fitBoards(
  pieces: readonly PlannedPiece[],
  feet: readonly number[],
  options: BoardOptions,
): { fitted: FittedBoard[]; unfit: PlannedPiece[] } {
  const lengths = [...feet].sort((a, b) => a - b);
  const longestFeet = lengths[lengths.length - 1] ?? 0;
  const open: PlannedPiece[][] = [];
  const unfit: PlannedPiece[] = [];
  for (const piece of [...pieces].sort((a, b) => b.length - a.length)) {
    if (used([piece], options) > longestFeet * 12) {
      unfit.push(piece);
      continue;
    }
    const fit = open.find((board) => used([...board, piece], options) <= longestFeet * 12);
    if (fit) fit.push(piece);
    else open.push([piece]);
  }
  const fitted = open.map((boardPieces) => {
    const need = used(boardPieces, options);
    const boardFeet = lengths.find((f) => f * 12 >= need) ?? longestFeet;
    return { feet: boardFeet, pieces: boardPieces, need, offcut: boardFeet * 12 - need };
  });
  return { fitted, unfit };
}

/** How far a stock's plan was searched: to a proof, to the work limit, or not at all. */
type Searched = 'proven' | 'stopped' | 'not-searched';

/**
 * One stock's boards by the exact method (decision 0021), or by first-fit decreasing when its
 * lengths are not whole feet, which the method's bounds need. Boards come in cutting order: each
 * board's pieces longest first, then boards by their pieces, longest first, as first-fit
 * decreasing opens them.
 */
function planStock(
  pieces: readonly PlannedPiece[],
  feet: readonly number[],
  options: BoardOptions,
  workLimit: number,
): { fitted: FittedBoard[]; unfit: PlannedPiece[]; searched: Searched; work: number } {
  const instance: CutInstance = {
    lengths: [...feet].sort((a, b) => a - b),
    pieces: pieces.map((piece) => piece.length),
    kerf: options.kerf,
    trimPerEnd: options.trimPerEnd,
  };
  const whole = instance.lengths.every(Number.isInteger);
  const solved = whole ? solveCached(instance, { workLimit }) : undefined;
  const plan = solved?.plan ?? firstFitDecreasing(instance);
  const length = (i: number) => instance.pieces[i] ?? 0;
  const longestFirst = (a: number, b: number) => length(b) - length(a) || a - b;
  const boards = plan.boards
    .map((board) => ({ feet: board.feet, order: [...board.pieces].sort(longestFirst) }))
    .sort((a, b) => {
      for (let i = 0; i < Math.min(a.order.length, b.order.length); i++) {
        const diff = length(b.order[i] ?? 0) - length(a.order[i] ?? 0);
        if (diff !== 0) return diff;
      }
      return b.order.length - a.order.length;
    });
  const fitted = boards.map((board) => {
    const boardPieces = board.order.flatMap((i) => pieces[i] ?? []);
    const need = used(boardPieces, options);
    return { feet: board.feet, pieces: boardPieces, need, offcut: board.feet * 12 - need };
  });
  return {
    fitted,
    unfit: [...plan.unfit].sort(longestFirst).flatMap((i) => pieces[i] ?? []),
    searched: !solved ? 'not-searched' : solved.proven ? 'proven' : 'stopped',
    work: solved?.work ?? 0,
  };
}

/** What a stock's lines say about how its plan was found. */
function searchedNote(nominal: string, searched: Searched): string {
  switch (searched) {
    case 'proven':
      return `No plan buys fewer feet of ${nominal} with these allowances.`;
    case 'stopped':
      return `The fewest feet of ${nominal} the search found before its limit. A plan with fewer may exist.`;
    case 'not-searched':
      return `Grouped longest piece first, without searching for fewer feet, since ${nominal}'s lengths are not all whole feet.`;
  }
}

/** The longest buyable length under `feet`, if any. */
function shorterThan(lengths: readonly number[], feet: number): number | undefined {
  return [...lengths]
    .sort((a, b) => a - b)
    .filter((f) => f < feet)
    .at(-1);
}

/** True when a board's pieces miss a `shorter` board by no more than its trim and one kerf. */
function justMisses(board: { need: number }, shorter: number, options: BoardOptions): boolean {
  return board.need - shorter * 12 <= 2 * options.trimPerEnd + options.kerf;
}

/** Boards counted by length, longest first. */
function byLength(feet: readonly number[]): { feet: number; count: number }[] {
  const counts = new Map<number, number>();
  for (const f of [...feet].sort((a, b) => b - a)) counts.set(f, (counts.get(f) ?? 0) + 1);
  return [...counts].map(([f, count]) => ({ feet: f, count }));
}

/**
 * What else holds a line's pieces when the store has none of its boards (#450): boards one
 * length shorter that measure long enough, the pieces fitted onto shorter lengths only, and the
 * next longer length. Other lines are left as planned.
 */
function lengthAlternatives(
  line: Pick<ShoppingLine, 'nominal' | 'feet' | 'count'>,
  boards: readonly PlannedBoard[],
  lengths: readonly number[],
  options: BoardOptions,
): LumberAlternative[] {
  const own = boards.filter((b) => b.nominal === line.nominal && b.feet === line.feet);
  const alternatives: LumberAlternative[] = [];

  const shorter = shorterThan(lengths, line.feet);
  const needs = own.map((b) => ({ need: used(b.pieces, options) }));
  if (shorter !== undefined && needs.every((b) => justMisses(b, shorter, options))) {
    alternatives.push({
      kind: 'measured',
      feet: shorter,
      count: line.count,
      atLeast: Math.max(...needs.map((b) => b.need)),
    });
  }

  const shorterLengths = lengths.filter((f) => f < line.feet);
  if (shorterLengths.length > 0) {
    const { fitted, unfit } = fitBoards(
      own.flatMap((b) => b.pieces),
      shorterLengths,
      options,
    );
    if (unfit.length === 0) {
      alternatives.push({ kind: 'lengths', boards: byLength(fitted.map((b) => b.feet)) });
    }
  }

  const longer = [...lengths].sort((a, b) => a - b).find((f) => f > line.feet);
  if (longer !== undefined) {
    alternatives.push({ kind: 'lengths', boards: [{ feet: longer, count: line.count }] });
  }
  return alternatives;
}

/** Total feet of a stock's boards. */
const feetOf = (boards: readonly { feet: number }[]) => boards.reduce((sum, b) => sum + b.feet, 0);

/**
 * For a stock whose fewest-feet plan has boards over the carry length (#690): the plan with none,
 * when it buys no more feet, as the tie-break; otherwise what it costs, or which pieces cannot
 * avoid a longer board, as a note for the lines over the carry length. Undefined when the plan
 * has no board over it.
 */
function withinCarry(
  stock: { nominal: string; group: { feet: readonly number[] }; fitted: FittedBoard[] },
  carry: number,
  options: BoardOptions,
  workLimit: number,
): { fitted?: FittedBoard[]; note?: string; work: number } | undefined {
  const over = (feet: number) => feet * 12 > carry;
  if (!stock.fitted.some((board) => over(board.feet))) return undefined;
  const limit = formatLength(carry, 'feet-inches');
  const carryable = stock.group.feet.filter((feet) => !over(feet));
  const pieces = stock.fitted.flatMap((board) => board.pieces);
  const longest = Math.max(0, ...carryable) * 12;
  const tooLong = [
    ...new Set(pieces.filter((p) => used([p], options) > longest).map((p) => p.name)),
  ];
  if (carryable.length === 0) {
    return { note: `${stock.nominal} is sold only in lengths over ${limit}.`, work: 0 };
  }
  if (tooLong.length > 0) {
    const names = tooLong.join(', ');
    return {
      note: `${names} ${tooLong.length === 1 ? 'is' : 'are'} too long for a board of ${limit} or shorter after trim and kerf, so this plan keeps boards over ${limit}.`,
      work: 0,
    };
  }
  const within = planStock(pieces, carryable, options, workLimit);
  const extra = feetOf(within.fitted) - feetOf(stock.fitted);
  if (extra <= 0) return { fitted: within.fitted, work: within.work };
  const buy = byLength(within.fitted.map((board) => board.feet))
    .map((b) => `${b.count} × ${b.feet}'`)
    .join(' and ');
  const more = within.searched === 'proven' ? '' : 'at most ';
  return {
    note: `No boards over ${limit} buys ${more}${extra} ft more: ${buy}.`,
    work: within.work,
  };
}

export function planLumber(
  parts: readonly Part[],
  options: BoardOptions = DEFAULT_BOARD_OPTIONS,
): LumberPlan {
  const issues: Issue[] = [];
  const notes: string[] = [
    `Allows ${formatLength(options.kerf)} for each saw cut and trims ${formatLength(options.trimPerEnd)} off each factory end.`,
  ];

  // Pieces grouped by stock, longest first, with the lengths each stock is sold in. Two stocks
  // with one name but different sizes or lengths would be bought as one, so that is refused.
  type Group = {
    size: string;
    feet: readonly number[];
    pieces: PlannedPiece[];
    byBoardFoot?: { width: number } & NonNullable<BoardStock['byBoardFoot']>;
  };
  const byStock = new Map<string, Group>();
  const add = (
    stock: {
      nominal: string;
      thickness: number;
      width: number;
      byBoardFoot?: BoardStock['byBoardFoot'];
    },
    feet: readonly number[],
    piece: PlannedPiece,
    count: number,
  ) => {
    const size = JSON.stringify([
      stock.thickness,
      stock.width,
      [...feet].sort((a, b) => a - b),
      stock.byBoardFoot ?? null,
    ]);
    const group = byStock.get(stock.nominal) ?? {
      size,
      feet,
      pieces: [],
      ...(stock.byBoardFoot ? { byBoardFoot: { ...stock.byBoardFoot, width: stock.width } } : {}),
    };
    if (group.size !== size) {
      issues.push({
        code: 'stock-name-reused',
        message: `Two different stocks are both named ${stock.nominal}. Give each its own name.`,
        params: [],
      });
      return;
    }
    for (let i = 0; i < count; i++) group.pieces.push({ ...piece });
    byStock.set(stock.nominal, group);
  };
  for (const part of parts) {
    const { stock } = part;
    if (isPanel(stock)) {
      add(
        stock.board,
        stock.board.buyableFeet,
        { partId: part.id, name: `${part.name} board`, length: stock.boardLength },
        part.quantity * stock.boards,
      );
    } else if (isStripGlueUp(stock)) {
      add(
        stock.board,
        stock.board.buyableFeet,
        { partId: part.id, name: `${part.name} board for strips`, length: stock.stripLength },
        stripBoardsFor(stock, part.quantity),
      );
    } else {
      add(
        stock,
        isBoardStock(stock) ? stock.buyableFeet : options.buyableFeet,
        { partId: part.id, name: part.name, length: part.length },
        part.quantity,
      );
    }
  }

  // One work limit for the whole plan, each stock searching with what the ones before it left.
  // Every stock is planned for the fewest feet first, so the searches for plans within the carry
  // length get only the work left after them and never change those plans' feet.
  let workLeft = WORK_LIMIT;
  const planned = [...byStock].map(([nominal, group]) => {
    const plan = planStock(group.pieces, group.feet, options, Math.max(0, workLeft));
    workLeft -= plan.work;
    return { nominal, group, ...plan, carryNote: undefined as string | undefined };
  });
  const carry = options.carryLength;
  if (carry !== undefined) {
    for (const stock of planned) {
      const within = withinCarry(stock, carry, options, Math.max(0, workLeft));
      if (!within) continue;
      workLeft -= within.work;
      if (within.fitted) stock.fitted = within.fitted;
      stock.carryNote = within.note;
    }
  }

  const boards: PlannedBoard[] = [];
  const lineNotes = new Map<string, string[]>();
  for (const { nominal, group, fitted, unfit, searched, carryNote } of planned) {
    for (const piece of unfit) {
      issues.push({
        code: 'part-longer-than-any-board',
        message: `${piece.name} (${formatLength(piece.length)}) is longer than the longest ${nominal} board available (${Math.max(...group.feet)}' after trim and kerf).`,
        params: [],
      });
    }
    for (const board of fitted) {
      boards.push({ nominal, feet: board.feet, pieces: board.pieces, offcut: board.offcut });

      // A single piece that just misses a shorter board: store boards often run a little long.
      const shorter = shorterThan(group.feet, board.feet);
      if (
        board.pieces.length === 1 &&
        shorter !== undefined &&
        justMisses(board, shorter, options)
      ) {
        const key = lumberLineKey({ nominal, feet: board.feet });
        lineNotes.set(key, [
          ...(lineNotes.get(key) ?? []),
          `${board.pieces[0]?.name}: listed as ${board.feet}' to leave room for trimming the ends. A ${shorter}' board works if it measures at least ${formatLength(board.need)}.`,
        ]);
      }
    }
    for (const feet of new Set(fitted.map((board) => board.feet))) {
      const key = lumberLineKey({ nominal, feet });
      const add = [searchedNote(nominal, searched)];
      if (carryNote && carry !== undefined && feet * 12 > carry) add.push(carryNote);
      lineNotes.set(key, [...(lineNotes.get(key) ?? []), ...add]);
    }
  }
  if (boards.length > 0) {
    notes.push(
      'Boards are planned to buy the fewest feet, so their offcuts run short. A miscut piece is less likely to have spare board left to recut it from.',
    );
  }

  // Board feet (American Softwood Lumber Standard, PS 20-10, 2.2): nominal thickness in inches ×
  // width in feet × length in feet, for each board the plan counts on, plus the waste allowance.
  const counts = new Map<string, ShoppingLine>();
  for (const board of boards) {
    const key = `${board.nominal}/${board.feet}`;
    const line = counts.get(key) ?? {
      nominal: board.nominal,
      feet: board.feet,
      count: 0,
      notes: lineNotes.get(key) ?? [],
      alternatives: [],
    };
    line.count += 1;
    const sold = byStock.get(board.nominal)?.byBoardFoot;
    if (sold) {
      const feet = sold.nominalThickness * (sold.width / 12) * board.feet * (1 + sold.waste);
      line.boardFeet = (line.boardFeet ?? 0) + feet;
    }
    counts.set(key, line);
  }
  for (const [nominal, group] of byStock) {
    const sold = group.byBoardFoot;
    if (!sold) continue;
    notes.push(
      `${nominal} is sold by the board foot in random widths. The boards are planned ${formatLength(sold.width)} wide, with ${Math.round(sold.waste * 100)}% more board feet for defects and offcuts; wider boards need fewer.`,
    );
  }

  const selection = parts
    .filter((p) => p.selection.length > 0)
    .map((p) => ({ partId: p.id, guides: [...p.selection] }));
  return {
    boards,
    kerf: options.kerf,
    trimPerEnd: options.trimPerEnd,
    ...(options.carryLength !== undefined ? { carryLength: options.carryLength } : {}),
    lines: [...counts.values()].map((line) => ({
      ...line,
      alternatives: lengthAlternatives(
        line,
        boards,
        byStock.get(line.nominal)?.feet ?? [],
        options,
      ),
    })),
    notes,
    issues,
    selection,
  };
}
