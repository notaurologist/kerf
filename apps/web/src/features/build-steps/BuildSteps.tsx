import {
  type BuildStep,
  type CutListRow,
  FLAG_CATEGORY_LABELS,
  findSkill,
  findToolType,
  type MethodGaps,
  OPERATION_TYPE_LABELS,
  type StepOperation,
} from '@kerf/core';
import {
  Card,
  ExpertCheck,
  InputNeeded,
  List,
  Measured,
  PlainList,
  Stack,
  Text,
} from '../../ui/index.ts';
import { SourceToggle } from '../structural/Citation.tsx';

// The build steps (#105, #52), rendered from the project response: the API chose each method
// from the tool inventory and filled its numbers, so this only lays the words out. The shop
// view (M7) will show the same data one step at a time.

export function BuildSteps(props: { steps: readonly BuildStep[]; rows: readonly CutListRow[] }) {
  const parts = new Map(props.rows.map((r) => [r.partId, `${r.letter} ${r.name}`]));
  const partName = (id: string) => parts.get(id) ?? id;
  return (
    <PlainList ordered>
      {props.steps.map((step, i) => (
        <li key={step.id}>
          <Stack gap="s">
            <h3>
              {i + 1}. {step.title}
            </h3>
            {step.partIds.length > 0 && (
              <Text tone="muted">Parts: {step.partIds.map(partName).join(', ')}.</Text>
            )}
            {step.flags.length > 0 && (
              <PlainList>
                {step.flags.map((flag) => (
                  <li key={`${flag.category}/${flag.ask}`}>
                    <ExpertCheck
                      label={`Expert check · ${FLAG_CATEGORY_LABELS[flag.category]}`}
                      why={<Measured text={flag.why} />}
                    >
                      <Measured text={flag.ask} />
                    </ExpertCheck>
                  </li>
                ))}
              </PlainList>
            )}
            <PlainList>
              {step.operations.map((op) => (
                <Card key={op.operation.id} as="li">
                  <Operation op={op} partName={partName} />
                </Card>
              ))}
            </PlainList>
          </Stack>
        </li>
      ))}
    </PlainList>
  );
}

function operationTitle(op: StepOperation, partName: (id: string) => string): string {
  const { operation } = op;
  const label = OPERATION_TYPE_LABELS[operation.type];
  const on = op.partIds.map(partName).join(', ');
  const end = 'end' in operation ? `, end ${operation.end + 1}` : '';
  return on ? `${label}: ${on}${end}` : label;
}

function Operation(props: { op: StepOperation; partName: (id: string) => string }) {
  const { op } = props;
  const method = op.method;
  return (
    <Stack gap="xs">
      <h4>{operationTitle(op, props.partName)}</h4>
      {method ? (
        <>
          <Text>
            <b>{method.name}.</b> Tools:{' '}
            {method.tools.map((t) => findToolType(t.toolTypeId)?.name ?? t.toolTypeId).join(', ')}.
          </Text>
          {op.skills.length > 0 && (
            <Text tone="muted">
              Skills: {op.skills.map((s) => findSkill(s)?.name ?? s).join(', ')}.
            </Text>
          )}
          {method.setup.length > 0 && (
            <>
              <b>Setup</b>
              <List ordered>
                {method.setup.map((t) => (
                  <li key={t}>
                    <Measured text={t} />
                  </li>
                ))}
              </List>
            </>
          )}
          <b>Technique</b>
          <List ordered>
            {method.technique.map((t) => (
              <li key={t}>
                <Measured text={t} />
              </li>
            ))}
          </List>
          <b>Common mistakes</b>
          <List>
            {method.mistakes.map((t) => (
              <li key={t}>
                <Measured text={t} />
              </li>
            ))}
          </List>
          {method.safety.length > 0 && (
            <>
              <b>Safety</b>
              <List>
                {method.safety.map((s) => (
                  <li key={s.text}>
                    <Stack gap="3xs">
                      <Measured text={s.text} />
                      <SourceToggle citations={s.sources} />
                    </Stack>
                  </li>
                ))}
              </List>
            </>
          )}
        </>
      ) : (
        op.needed && (
          <Text>
            No method fits your tools. {op.needed.methodName}, you need <Gaps of={op.needed} />
          </Text>
        )
      )}
      {op.inputNeeded.map((m) => (
        <Text key={m.methodId}>
          <InputNeeded /> {m.methodName}, enter <Gaps of={m} />
        </Text>
      ))}
      {op.suggestions.map((s) => (
        <Text key={s.methodId} tone="muted">
          Tool suggestion: {s.better.join(' and ')} {s.methodName.toLowerCase()}. You need{' '}
          <Gaps of={s} />
        </Text>
      ))}
    </Stack>
  );
}

/** What a method lacks: each requirement, with the tools that would meet it. */
function Gaps(props: { of: MethodGaps }) {
  return <>{props.of.gaps.map((g) => `${g.anyOf.join(' or ')}, for ${g.use}`).join('; ')}.</>;
}
