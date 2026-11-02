import { BOARD_GUIDES, type LumberPlan } from '@kerf/core';
import { List, Measured, ResultLine, Row, Rows, Stack, Text } from '../../ui/index.ts';
import { SourceToggle } from '../structural/Citation.tsx';

// What to look for when choosing boards at the store (#53): each guide the plan's parts use, in
// the knowledge base's order, with the parts it applies to. The plan stores guide IDs by part ID;
// the words and sources come from the knowledge base. A board card (#59) shows the guides for the
// parts on that board only.

export function BoardSelection(props: {
  lumber: LumberPlan;
  /** Only these parts' guides, as on a board card; every part's when absent. */
  partIds?: readonly string[];
  /** The heading; a board card nests it one level lower. */
  heading?: { level: 3 | 4; text: string };
  /** In the plan (#361): each guide one line, naming the parts, opening to its checks. */
  folded?: boolean;
}) {
  const only = props.partIds;
  const selection = props.lumber.selection.filter((s) => !only || only.includes(s.partId));
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
  const { level, text } = props.heading ?? { level: 3, text: 'Choosing boards' };
  const Heading = level === 3 ? 'h3' : 'h4';
  const GuideHeading = level === 3 ? 'h4' : 'h5';
  return (
    <Stack as="section">
      <Heading>{text}</Heading>
      {props.folded ? (
        <Rows>
          {guides.map(({ guide, parts }) => (
            <Row key={guide.id} as="section">
              <ResultLine title={guide.title} detail={`For: ${parts.join(', ')}.`}>
                <Checks checks={guide.checks} />
              </ResultLine>
            </Row>
          ))}
        </Rows>
      ) : (
        guides.map(({ guide, parts }) => (
          <Stack key={guide.id} gap="xs">
            <GuideHeading>{guide.title}</GuideHeading>
            <Text tone="muted">For: {parts.join(', ')}.</Text>
            <Checks checks={guide.checks} />
          </Stack>
        ))
      )}
    </Stack>
  );
}

function Checks(props: { checks: (typeof BOARD_GUIDES)[number]['checks'] }) {
  return (
    <List>
      {props.checks.map((check) => (
        <li key={check.look}>
          <Stack gap="3xs">
            <span>
              <Measured text={check.look} terms />
            </span>
            <Text tone="muted" as="span">
              Why: <Measured text={check.why} terms />
            </Text>
            <SourceToggle citations={check.sources} />
          </Stack>
        </li>
      ))}
    </List>
  );
}
