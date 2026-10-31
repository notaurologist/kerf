import {
  type CutListRow,
  formatBoardLength,
  formatLength,
  type geometry,
  type LumberPlan,
  type PlannedBoard,
  type ShoppingLine,
} from '@kerf/core';
import { Card, Diagram, Length, PartLetter, PlainList, Stack, Text } from '../../ui/index.ts';
import { BoardSelection } from '../shopping-list/BoardSelection.tsx';

// Board cards (#59; wireframes S-B): under a lumber line on the store checklist, what to look
// for when choosing these boards (#53), then each board of that size and length with the pieces
// it becomes, drawn by core. Choosing a board happens at the rack, so the card says what each
// board is for and how much it has to spare.

export function BoardCards(props: {
  line: Pick<ShoppingLine, 'nominal' | 'feet'>;
  lumber: LumberPlan;
  rows: readonly CutListRow[];
  /** The board plan's drawings from the API, one per board in the plan's order. */
  drawings: readonly geometry.Drawing[];
}) {
  const { line, lumber } = props;
  const letter = new Map(props.rows.map((r) => [r.partId, r.letter]));
  const boards = lumber.boards.flatMap((board, i) =>
    board.nominal === line.nominal && board.feet === line.feet ? [{ board, i }] : [],
  );
  const partIds = [...new Set(boards.flatMap(({ board }) => board.pieces.map((p) => p.partId)))];
  return (
    <Stack>
      {/* What to look for first: it applies to every board below (#136). */}
      <BoardSelection
        lumber={lumber}
        partIds={partIds}
        heading={{ level: 3, text: 'What to look for' }}
      />
      {boards.map(({ board, i }) => (
        <BoardCard
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

/**
 * One board of the plan: its drawing from core, the pieces it becomes in cutting order, each with
 * its part letter, and its offcut. On a board card (#59) and in the plan's Boards section (#119).
 */
export function BoardCard(props: {
  board: PlannedBoard;
  /** The board's place in the plan, from 1. */
  number: number;
  drawing: geometry.Drawing | undefined;
  letter: ReadonlyMap<string, string>;
}) {
  const { board, drawing } = props;
  return (
    <Card as="section">
      <Stack gap="xs">
        <h3>
          {drawing?.title ??
            `Board ${props.number}: ${board.nominal}, ${formatBoardLength(board.feet)}`}
        </h3>
        {drawing && <Diagram drawing={drawing} label={drawing.description} />}
        <PlainList>
          {board.pieces.map((piece, p) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: pieces are in cutting order and repeat.
            <li key={p}>
              <PartLetter>{props.letter.get(piece.partId) ?? ''}</PartLetter> {piece.name}{' '}
              <Length>{formatLength(piece.length)}</Length>
            </li>
          ))}
        </PlainList>
        <Text>
          Offcut <Length>{formatLength(board.offcut)}</Length>.
        </Text>
      </Stack>
    </Card>
  );
}
