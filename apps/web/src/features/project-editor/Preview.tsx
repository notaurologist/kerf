import {
  buildFromForm,
  type Change,
  entryProblems,
  type FormValues,
  type Plan,
  structural,
  type TemplateDefinition,
} from '@kerf/core';
import { useEffect, useRef, useState } from 'react';
import { type ApiResult, api, failureOf, send } from '../../lib/api.ts';
import { type Changes, indexChanges } from '../../lib/changes.tsx';
import { planOf } from '../../lib/plan.ts';
import type { Project } from '../../lib/types.ts';
import {
  Card,
  CheckStatus,
  Cluster,
  type Failure,
  Notice,
  SaveFailed,
  Stack,
  StateTag,
  Text,
} from '../../ui/index.ts';
import { CutList } from '../cut-list/CutList.tsx';
import { ShoppingList } from '../shopping-list/ShoppingList.tsx';
import { sameJson } from './sameJson.ts';

// The edit screen's output side (#39, L-A; #56): a moment after typing stops, the server
// generates a snapshot from the form without saving it and says what differs from the saved
// plan. The numbers come from the API (hard rule 6); this only shows them and marks the changes.

/** How long typing has to stop before the preview is asked for. */
export const PREVIEW_DELAY_MS = 500;

export type PreviewRequest =
  | { kind: 'saved' }
  | { kind: 'incomplete' }
  | { kind: 'ask'; body: { params: unknown; structuralInputs: unknown } };

/**
 * What the form asks of the preview: nothing while it matches the saved plan or has an entry
 * the template cannot read yet (the errors wait for a save, as on the rest of the form), else
 * the same body a save would send.
 */
export function previewRequest(
  template: TemplateDefinition,
  project: Project,
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
  const stored = project.snapshot;
  if (
    stored &&
    sameJson(builtParams, stored.params) &&
    sameJson(builtInputs, stored.structuralInputs)
  ) {
    return { kind: 'saved' };
  }
  return { kind: 'ask', body: { params: builtParams, structuralInputs: builtInputs } };
}

export type PreviewState =
  | { kind: 'saved' }
  | { kind: 'incomplete' }
  | { kind: 'waiting' }
  | { kind: 'ready'; plan: Plan; changes: Changes; truncated: boolean }
  | { kind: 'rejected'; messages: string[] }
  | { kind: 'failed'; failure: Failure };

/** Asks the API for a preview a moment after the form stops changing; only the latest counts. */
export function usePreview(
  template: TemplateDefinition,
  project: Project,
  params: FormValues,
  inputs: FormValues,
): PreviewState {
  const request = previewRequest(template, project, params, inputs);
  const key = JSON.stringify(request);
  const [state, setState] = useState<PreviewState>({ kind: 'saved' });
  const latest = useRef(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` is the request, serialized.
  useEffect(() => {
    const id = ++latest.current;
    if (request.kind !== 'ask') {
      setState({ kind: request.kind });
      return;
    }
    setState((s) => (s.kind === 'ready' ? s : { kind: 'waiting' }));
    const timer = setTimeout(async () => {
      const result = await send(
        api.api.projects[':id'].preview.$post({ param: { id: project.id }, json: request.body }),
      );
      if (id !== latest.current) return;
      setState(previewState(project.templateId, result));
    }, PREVIEW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [key, project.id]);
  return state;
}

type PreviewResult = ApiResult<{
  snapshot: { outputs: unknown };
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
  const plan = planOf(templateId, result.value.snapshot.outputs);
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
 * says "Preview, not saved" and marks every value that differs with the saved value.
 */
export function PreviewPane(props: { saved: Plan; state: PreviewState }) {
  const { state } = props;
  const preview = state.kind === 'ready' ? state : null;
  const plan = preview?.plan ?? props.saved;
  const changes = preview?.changes;
  return (
    <section aria-labelledby="preview-heading">
      <Stack>
        <Cluster spread>
          <h2 id="preview-heading">{preview ? 'Preview' : 'Saved plan'}</h2>
          {preview && <StateTag>Preview, not saved</StateTag>}
        </Cluster>
        <div aria-live="polite">
          <PreviewStatus state={state} />
        </div>
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
      </Stack>
    </section>
  );
}

function PreviewStatus(props: { state: PreviewState }) {
  const { state } = props;
  switch (state.kind) {
    case 'saved':
      return <Text tone="muted">Change a value to preview its effect here before saving.</Text>;
    case 'incomplete':
      return (
        <Text tone="muted">
          The preview updates when every entry can be read. Until then this is the saved plan.
        </Text>
      );
    case 'waiting':
      return <Text tone="muted">Updating the preview…</Text>;
    case 'ready':
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
        <Notice>
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
    <Stack gap="xs">
      {props.checks.map((check, i) => {
        const at = `checks[${i}]`;
        const before = props.changes?.at(`${at}.margin`)?.before;
        const was =
          typeof before === 'number'
            ? structural.formatMargin(before)
            : props.changes?.at(`${at}.status`)
              ? 'Input needed'
              : undefined;
        return (
          <Card key={`${check.kind}/${check.subject}`}>
            <Stack gap="2xs">
              <b>
                {check.title}: {check.subject}
              </b>
              <CheckStatus check={check} was={was} />
            </Stack>
          </Card>
        );
      })}
    </Stack>
  );
}
