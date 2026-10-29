import { BOARD_GUIDES, type LumberPlan } from '@kerf/core';
import { List, Stack, Text } from '../../ui/index.ts';
import { SourceToggle } from '../structural/Citation.tsx';

// What to look for when choosing boards at the store (#53): each guide the plan's parts use, in
// the knowledge base's order, with the parts it applies to. The plan stores guide IDs by part ID;
// the words and sources come from the knowledge base. The store view (#59) will show the same
// data on each board.

export function BoardSelection(props: { lumber: LumberPlan }) {
  const selection = props.lumber.selection ?? [];
  if (selection.length === 0) return null;
  const names = new Map(
    props.lumber.boards.flatMap((b) => b.pieces.map((p) => [p.partId, p.name])),
  );
  const guides = BOARD_GUIDES.flatMap((guide) => {
    const parts = selection
      .filter((s) => s.guides.includes(guide.id))
      .map((s) => names.get(s.partId) ?? s.partId);
    return parts.length > 0 ? [{ guide, parts }] : [];
  });
  return (
    <Stack as="section">
      <h3>Choosing boards</h3>
      {guides.map(({ guide, parts }) => (
        <Stack key={guide.id} gap="xs">
          <h4>{guide.title}</h4>
          <Text tone="muted">For: {parts.join(', ')}.</Text>
          <List>
            {guide.checks.map((check) => (
              <li key={check.look}>
                <Stack gap="3xs">
                  <span>{check.look}</span>
                  <Text tone="muted" as="span">
                    Why: {check.why}
                  </Text>
                  <SourceToggle citations={check.sources} />
                </Stack>
              </li>
            ))}
          </List>
        </Stack>
      ))}
    </Stack>
  );
}
