import { type CutListRow, formatLength, type geometry, type LumberPlan } from '@kerf/core';
import { Length, Stack, Text } from '../../ui/index.ts';
import { BoardCard } from '../modes/BoardCards.tsx';

// The plan's Boards section (#40, section order A; #119): which pieces come from which board, in
// the order they are cut, with the trim, saw cut, and offcut the board plan allowed. The shopping
// list keeps the boards to buy; this is how they are used.

export function Boards(props: {
  lumber: LumberPlan;
  rows: readonly CutListRow[];
  /** The board plan's drawings from the API, one per board in the plan's order. */
  drawings: readonly geometry.Drawing[];
}) {
  const { lumber } = props;
  const letter = new Map(props.rows.map((r) => [r.partId, r.letter]));
  return (
    <Stack>
      <Text tone="muted">
        Each board trims <Length>{formatLength(lumber.trimPerEnd)}</Length> off each factory end and
        allows <Length>{formatLength(lumber.kerf)}</Length> for each saw cut. Pieces are listed in
        the order they come off the board.
      </Text>
      {lumber.boards.map((board, i) => (
        <BoardCard
          // biome-ignore lint/suspicious/noArrayIndexKey: boards are listed in the plan's order and have no ID.
          key={i}
          board={board}
          number={i + 1}
          drawing={props.drawings[i]}
          letter={letter}
        />
      ))}
    </Stack>
  );
}
