import {
  buildFromForm,
  type Change,
  entryProblems,
  type FormValues,
  formatBoardLength,
  type Plan,
  type SuggestedValue,
  structural,
  type TemplateDefinition,
} from '@kerf/core';
import { memo, type ReactNode, useEffect, useState } from 'react';
import { type ApiResult, api, failureOf, send } from '../../lib/api.ts';
import { type Changes, indexChanges, marked } from '../../lib/changes.tsx';
import { useLatest } from '../../lib/latest.ts';
import { planOf } from '../../lib/plan.ts';
import type { Project } from '../../lib/types.ts';
import {
  CheckStatus,
  Cluster,
  type Failure,
  Length,
  LiveRegion,
  Measured,
  Notice,
  PlainList,
  Row,
  Rows,
  SaveFailed,
  SettingBox,
  Stack,
  StateTag,
  Text,
} from '../../ui/index.ts';
import { sameJson } from '../../ui/sameJson.ts';
import { CutList } from '../cut-list/CutList.tsx';
import { ShoppingList } from '../shopping-list/ShoppingList.tsx';

// The edit screen's output side (#39, L-A; #56): a moment after typing stops, the server
// generates a snapshot from the form without saving it and says what differs from the saved
// plan. The numbers come from the API (hard rule 6); this only shows them and marks the changes.
// A new project (#98) has no saved plan, so its preview marks nothing.

/** How long typing has to stop before the preview is asked for. */
const PREVIEW_DELAY_MS = 500;

export type PreviewRequest =
  | { kind: 'saved' }
  | { kind: 'incomplete' }
  | { kind: 'ask'; body: { params: unknown; structuralInputs: unknown } };

/**
 * What the form asks of the preview: nothing while it matches the saved plan or has an entry
 * the template cannot read yet (the errors wait for a save, as on the rest of the form), else
 * the same body a save would send. `project` is null for a new project.
 */
export function previewRequest(
  template: TemplateDefinition,
  project: Project | null,
  params: FormValues,
  inputs: FormValues,
): PreviewRequest {
  const { form } = template;
  if (
    entryProblems(form.params, params).length +
      entryProblems(form.structuralInputs, inputs).length >
    0
  ) {
    return { kind: 'incomplete' };
  }
  const builtParams = buildFromForm(form.params, params);
  const builtInputs = buildFromForm(form.structuralInputs, inputs);
  if (
    !template.params.safeParse(builtParams).success ||
    !template.structuralInputs.safeParse(builtInputs).success
  ) {
    return { kind: 'incomplete' };
  }
  const stored = project?.snapshot;
  if (
    stored &&
    sameJson(builtParams, stored.params) &&
    sameJson(builtInputs, stored.structuralInputs)
  ) {
    return { kind: 'saved' };
  }
  return { kind: 'ask', body: { params: builtParams, structuralInputs: builtInputs } };
}

export type ReadyPreview = { kind: 'ready'; plan: Plan; changes: Changes; truncated: boolean };

export type PreviewState =
  | { kind: 'saved' }
  | { kind: 'incomplete' }
  | { kind: 'waiting' }
  | ReadyPreview
  | { kind: 'updating'; previous: ReadyPreview }
  | { kind: 'rejected'; messages: string[] }
  | { kind: 'failed'; failure: Failure };

/**
 * The state while a new request is pending. A preview already on screen stays, marked as being
 * for the earlier values, so its margins are never read as the current ones.
 */
export function pendingState(current: PreviewState, request: PreviewRequest): PreviewState {
  // The same state when nothing changed, so typing does not redraw the pane.
  if (request.kind !== 'ask')
    return current.kind === request.kind ? current : { kind: request.kind };
  if (current.kind === 'ready') return { kind: 'updating', previous: current };
  if (current.kind === 'updating' || current.kind === 'waiting') return current;
  return { kind: 'waiting' };
}

/** Asks the API for a preview a moment after the form stops changing; only the latest counts. */
export function usePreview(
  template: TemplateDefinition,
  project: Project | null,
  params: FormValues,
  inputs: FormValues,
  /** Asks for nothing, such as while the saved plan cannot be read. */
  off = false,
  /** A new project's starting answers, so its preview says which values are suggestions. */
  answers?: unknown,
): PreviewState {
  const request: PreviewRequest = off
    ? { kind: 'saved' }
    : previewRequest(template, project, params, inputs);
  const key = JSON.stringify(request);
  const [state, setState] = useState<PreviewState>({ kind: project ? 'saved' : 'incomplete' });
  const latest = useLatest();
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` is the request, serialized.
  useEffect(() => {
    const isLatest = latest.start();
    setState((s) => pendingState(s, request));
    if (request.kind !== 'ask') return;
    const timer = setTimeout(async () => {
      const result = await send(
        project
          ? api.api.projects[':id'].preview.$post({ param: { id: project.id }, json: request.body })
          : api.api.projects.preview.$post({
              json: { templateId: template.id, ...request.body, answers },
            }),
      );
      if (!isLatest()) return;
      setState(previewState(template.id, result));
    }, PREVIEW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [key, project?.id, template.id]);
  return state;
}

type PreviewResult = ApiResult<{
  snapshot: { outputs: unknown; suggested?: readonly SuggestedValue[] };
  changes: Change[];
  truncated: boolean;
}>;

/** A preview response as something to show. */
export function previewState(templateId: string, result: PreviewResult): PreviewState {
  if (!result.ok) {
    return result.error.kind === 'invalid'
      ? { kind: 'rejected', messages: result.error.issues.map((i) => i.message) }
      : { kind: 'failed', failure: failureOf(result.error) };
  }
  const plan = planOf(templateId, result.value.snapshot.outputs, result.value.snapshot.suggested);
  if (!plan.ok) return { kind: 'failed', failure: { message: plan.message, connection: false } };
  return {
    kind: 'ready',
    plan: plan.plan,
    changes: indexChanges(result.value.changes),
    truncated: result.value.truncated,
  };
}

/**
 * The output side of the edit screen. With no preview, it shows the saved plan; with one, it
 * says "Preview, not saved" and marks every value that differs with the saved value. A new
 * project has no saved plan (`saved` is null), so until there is a preview it shows only why.
 */
export const PreviewPane = memo(function PreviewPane(props: {
  saved: Plan | null;
  state: PreviewState;
}) {
  const { state } = props;
  const preview =
    state.kind === 'ready' ? state : state.kind === 'updating' ? state.previous : null;
  const plan = preview?.plan ?? props.saved;
  const changes = preview?.changes;
  const isNew = props.saved === null;
  return (
    <section aria-labelledby="preview-heading">
      <Stack>
        <Cluster spread>
          <h2 id="preview-heading">{preview || isNew ? 'Preview' : 'Saved plan'}</h2>
          {preview && (
            <StateTag>
              {state.kind === 'updating' ? 'Earlier values, not saved' : 'Preview, not saved'}
            </StateTag>
          )}
        </Cluster>
        <LiveRegion>
          <PreviewStatus state={state} isNew={isNew} />
        </LiveRegion>
        {plan && <PlanOutputs plan={plan} changes={changes} />}
      </Stack>
    </section>
  );
});

/**
 * The numbers the preview changes, alone, each marked with the saved one: for beside Save while
 * the full preview is out of sight below the form, as on a phone. Nothing while none changed.
 */
export function WhatChanges(props: { state: PreviewState }) {
  const { state } = props;
  const preview =
    state.kind === 'ready' ? state : state.kind === 'updating' ? state.previous : null;
  const lines = preview ? changedNumbers(preview.plan, preview.changes) : [];
  if (!preview || lines.length === 0) return null;
  return (
    <section aria-labelledby="what-changes-heading">
      <Stack gap="xs">
        <Cluster spread>
          <h2 id="what-changes-heading">What changes</h2>
          <StateTag>
            {state.kind === 'updating' ? 'Earlier values, not saved' : 'Preview, not saved'}
          </StateTag>
        </Cluster>
        <PlainList gap="xs">
          {lines.map((line) => (
            <li key={line.path}>
              <b>{line.label}</b> {line.value}
            </li>
          ))}
        </PlainList>
        <Text tone="muted">
          {preview.truncated && 'More values changed than the preview can list. '}The full preview
          follows the form.
        </Text>
      </Stack>
    </section>
  );
}

/** Each changed number the preview shows, in its order: margins, the cut list, then buying. */
function changedNumbers(
  plan: Plan,
  changes: Changes,
): { path: string; label: string; value: ReactNode }[] {
  const lines: { path: string; label: string; value: ReactNode }[] = [];
  const add = (
    path: string,
    label: string,
    value: ReactNode,
    was?: (before: unknown) => string,
  ) => {
    if (changes.at(path)) lines.push({ path, label, value: marked(changes, path, value, was) });
  };
  plan.checks.forEach((check, i) => {
    const was = marginWas(changes, `checks[${i}]`);
    if (was !== undefined) {
      lines.push({
        path: `checks[${i}]`,
        label: `${check.title}: ${check.subject}`,
        value: <CheckStatus check={check} was={was} />,
      });
    }
  });
  plan.cutList.forEach((row, i) => {
    const at = `cutList[${i}]`;
    const part = `${row.letter} · ${row.name}`;
    add(`${at}.quantity`, `${part}, quantity`, row.quantity);
    add(`${at}.length`, `${part}, length`, <Length>{row.length}</Length>);
    row.settings.forEach((setting, end) => {
      add(`${at}.ends[${end}]`, `${part}, end ${end + 1}`, <SettingBox>{setting}</SettingBox>);
    });
    row.marks.forEach((mark, m) => {
      add(`${at}.marks[${m}].value`, `${part}, ${mark.label}`, <Length>{mark.value}</Length>);
    });
  });
  plan.lumber.lines.forEach((line, i) => {
    const at = `lumber.lines[${i}]`;
    add(`${at}.count`, `${line.nominal} boards to buy`, line.count);
    add(
      `${at}.feet`,
      `${line.nominal} board length`,
      <Length>{formatBoardLength(line.feet)}</Length>,
      (before) => formatBoardLength(before as number),
    );
  });
  plan.hardware.forEach((line, i) => {
    const at = `hardware[${i}]`;
    add(`${at}.description`, 'Hardware', <Measured text={line.description} />);
    if (line.quantity !== undefined) {
      add(`${at}.quantity`, `${line.description}, to buy`, line.quantity);
    }
  });
  return lines;
}

/** The outputs an edit most often moves, each changed value marked with the one it replaces. */
export function PlanOutputs(props: { plan: Plan; changes: Changes | undefined }) {
  const { plan, changes } = props;
  return (
    <>
      <h3>Structural checks</h3>
      <Margins checks={plan.checks} changes={changes} />
      <h3>Cut list</h3>
      <CutList rows={plan.cutList} changes={changes} />
      <h3>Shopping list</h3>
      <ShoppingList
        lumber={plan.lumber}
        hardware={plan.hardware}
        hardwareNotes={plan.hardwareNotes}
        changes={changes}
      />
    </>
  );
}

function PreviewStatus(props: { state: PreviewState; isNew: boolean }) {
  const { state } = props;
  switch (state.kind) {
    case 'saved':
      return <Text tone="muted">Change a value to preview its effect here before saving.</Text>;
    case 'incomplete':
      return props.isNew ? (
        <Text tone="muted">
          The cut list, shopping list, and structural checks show here when every dimension and
          hardware entry can be read.
        </Text>
      ) : (
        <Text tone="muted">
          The preview updates when every entry can be read. Until then this is the saved plan.
        </Text>
      );
    case 'waiting':
      return <Text tone="muted">Updating the preview…</Text>;
    case 'updating':
      return (
        <Text tone="muted">
          Updating the preview… Until it arrives, the numbers below are for the values before your
          latest change.
        </Text>
      );
    case 'ready':
      if (props.isNew)
        return <Text tone="muted">Nothing is saved until you create the project.</Text>;
      return (
        <Text tone="muted">
          {state.changes.size > 0
            ? 'Changed values show the saved value under them.'
            : 'Nothing shown here differs from the saved plan.'}
          {state.truncated &&
            ' More values changed than the preview can list; save to see them all.'}
        </Text>
      );
    case 'rejected':
      return (
        <Notice alert={false}>
          <b>No preview for these values.</b> {state.messages.join(' ')}
        </Notice>
      );
    case 'failed':
      return (
        <SaveFailed
          failure={state.failure}
          title="No preview."
          kept="The form still shows your values."
        />
      );
  }
}

type CheckResult = structural.CheckResult;

/** Each check's margin, the number an edit most often moves (#39, L-A). */
function Margins(props: { checks: readonly CheckResult[]; changes?: Changes }) {
  return (
    <Rows>
      {props.checks.map((check, i) => {
        const was = props.changes && marginWas(props.changes, `checks[${i}]`);
        return (
          <Row key={`${check.kind}/${check.subject}`}>
            <Stack gap="2xs">
              <b>
                {check.title}: {check.subject}
              </b>
              <CheckStatus check={check} was={was} />
            </Stack>
          </Row>
        );
      })}
    </Rows>
  );
}

/** A check's saved margin, or "Input needed", when the preview changes it. */
function marginWas(changes: Changes, at: string): string | undefined {
  const before = changes.at(`${at}.margin`)?.before;
  if (typeof before === 'number') return structural.formatMargin(before);
  return changes.at(`${at}.status`) ? 'Input needed' : undefined;
}
