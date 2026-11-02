import type { TemplateDefinition } from '@kerf/core';
import { useState } from 'react';
import { href, type ProjectStart } from '../../lib/route.ts';
import type { ProjectSummary } from '../../lib/types.ts';
import {
  Card,
  Field,
  Grid,
  PlainList,
  RowLink,
  ScreenHeader,
  Stack,
  Text,
  TextInput,
} from '../../ui/index.ts';

// Stage 14's step before a new project's form (#358, P1): four ways to start as large choices,
// each saying what it does. The template's questions come first when it has them, since they ask
// least of a beginner; otherwise its worked examples do. Each opens the form filled (M8).

/** How many earlier projects to offer before a search. */
const RECENT = 3;

const QUESTIONS_ABOUT =
  'A few plain questions about your space and what you need. Kerf suggests the rest, and says where each value came from.';
const EXAMPLE_ABOUT = 'A worked example, checked by hand. Change any value.';
const COPY_ABOUT = 'Every value from one of your projects. Confirm the copied ones before saving.';
const EMPTY_ABOUT = 'Every field for you to fill in.';

export function StartChoice(props: {
  template: TemplateDefinition;
  title: string;
  /** The template's earlier projects, most recently updated first. */
  earlier: readonly ProjectSummary[];
}) {
  const { template } = props;
  const to = (start: ProjectStart) =>
    href({ screen: 'new-project', templateId: template.id, start });
  const examples = template.examples.flatMap((e, index) =>
    e.start ? [{ label: e.start, href: to({ kind: 'example', index }) }] : [],
  );
  const questions = template.questions && (
    <Choice key="questions" title="Answer a few questions" href={to({ kind: 'questions' })}>
      {QUESTIONS_ABOUT}
    </Choice>
  );
  const example = examples.length > 0 && (
    <Card key="example" as="section">
      <Stack gap="xs">
        <h2>Start from an example</h2>
        <Text tone="muted">{EXAMPLE_ABOUT}</Text>
        <PlainList gap="xs">
          {examples.map((e) => (
            <li key={e.href}>
              <RowLink href={e.href}>{e.label}</RowLink>
            </li>
          ))}
        </PlainList>
      </Stack>
    </Card>
  );
  const copy = props.earlier.length > 0 && (
    <CopyChoice key="copy" earlier={props.earlier} href={(id) => to({ kind: 'project', id })} />
  );
  const empty = (
    <Choice key="empty" title="Empty form" href={to({ kind: 'empty' })}>
      {EMPTY_ABOUT}
    </Choice>
  );
  return (
    <Stack>
      <ScreenHeader title={props.title} lede="How do you want to start?" />
      <Grid min="m" gap="m">
        {questions ? [questions, example, copy, empty] : [example, copy, empty]}
      </Grid>
    </Stack>
  );
}

/** One way to start that goes straight to the form. */
function Choice(props: { title: string; href: string; children: string }) {
  return (
    <Card as="section">
      <Stack gap="xs">
        <h2>
          <RowLink href={props.href}>{props.title}</RowLink>
        </h2>
        <Text tone="muted">{props.children}</Text>
      </Stack>
    </Card>
  );
}

/** The most recent earlier projects, and a search through the rest when there are more. */
function CopyChoice(props: { earlier: readonly ProjectSummary[]; href: (id: string) => string }) {
  const [query, setQuery] = useState('');
  const words = query.trim().toLowerCase();
  const shown = words
    ? props.earlier.filter((p) => p.name.toLowerCase().includes(words))
    : props.earlier.slice(0, RECENT);
  return (
    <Card as="section">
      <Stack gap="xs">
        <h2>Copy an earlier project</h2>
        <Text tone="muted">{COPY_ABOUT}</Text>
        {props.earlier.length > RECENT && (
          <Field id="start-copy-search" label="Search your projects">
            {(c) => <TextInput {...c} value={query} onChange={setQuery} />}
          </Field>
        )}
        {shown.length === 0 ? (
          <Text>No project's name has “{query.trim()}” in it.</Text>
        ) : (
          <PlainList gap="xs">
            {shown.map((p) => (
              <li key={p.id}>
                <RowLink href={props.href(p.id)}>{p.name}</RowLink>
              </li>
            ))}
          </PlainList>
        )}
      </Stack>
    </Card>
  );
}

/** Above the form: how it was started, and the way back to choose again. */
export function StartedFrom(props: {
  template: TemplateDefinition;
  start: ProjectStart;
  earlier: readonly ProjectSummary[];
}) {
  const { start } = props;
  const label =
    start.kind === 'example'
      ? (props.template.examples[start.index]?.start ?? 'A worked example')
      : start.kind === 'project'
        ? `A copy of ${props.earlier.find((p) => p.id === start.id)?.name ?? 'an earlier project'}`
        : start.kind === 'questions'
          ? 'Your answers'
          : 'An empty form';
  return (
    <Text>
      Started from: {label}.{' '}
      <a href={href({ screen: 'new-project', templateId: props.template.id })}>
        Change how you started
      </a>
    </Text>
  );
}
