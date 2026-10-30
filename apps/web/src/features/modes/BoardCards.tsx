import {
  type CutListRow,
  formatLength,
  type geometry,
  type LumberPlan,
  type ShoppingLine,
} from '@kerf/core';
import { Card, Diagram, Length, PartLetter, PlainList, Stack, Text } from '../../ui/index.ts';
import { BoardSelection } from '../shopping-list/BoardSelection.tsx';

// Board cards (#59; wireframes S-B): under a lumber line on the store checklist, each board of
// that size and length with the pieces it becomes, drawn by core, and what to look for when
// choosing it (#53). Choosing a board happens at the rack, so the card says what each board is
// for and how much it has to spare.

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
      {boards.map(({ board, i }) => {
        const drawing = props.drawings[i];
        return (
          <Card key={i} as="section">
            <Stack gap="xs">
              <h3>{drawing?.title ?? `Board ${i + 1}`}</h3>
              {drawing && <Diagram drawing={drawing} label={drawing.description} />}
              <PlainList>
                {board.pieces.map((piece, p) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: pieces are in cutting order and repeat.
                  <li key={p}>
                    <PartLetter>{letter.get(piece.partId) ?? ''}</PartLetter> {piece.name}{' '}
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
      })}
      <BoardSelection
        lumber={lumber}
        partIds={partIds}
        heading={{ level: 3, text: 'What to look for' }}
      />
    </Stack>
  );
}
