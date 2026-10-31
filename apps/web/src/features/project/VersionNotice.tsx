import type { Change } from '@kerf/core';
import { useState } from 'react';
import { api, describeError, send } from '../../lib/api.ts';
import { indexChanges } from '../../lib/changes.tsx';
import { planOf } from '../../lib/plan.ts';
import type { Project } from '../../lib/types.ts';
import {
  Button,
  Card,
  Cluster,
  Disclosure,
  InfoNotice,
  InlineConfirm,
  List,
  Stack,
  Text,
} from '../../ui/index.ts';
import { PlanOutputs } from '../project-editor/Preview.tsx';

// Tells the owner when a project's template has a newer version, what regenerating would change,
// and regenerates only when asked (decision 0008). The stored plan is never replaced otherwise.

export function VersionNotice(props: {
  project: Project;
  onRegenerated: (project: Project) => void;
}) {
  const { project } = props;
  const report = project.version;
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!report || report.status === 'current') return null;

  if (report.status === 'ahead') {
    return (
      <InfoNotice>
        <Text>
          This plan was made with template version {report.storedVersion}, newer than the version
          this app has ({report.currentVersion}). It is shown as stored and cannot be regenerated
          here.
        </Text>
      </InfoNotice>
    );
  }

  const regenerate = async () => {
    setBusy(true);
    setError(null);
    const result = await send(
      api.api.projects[':id'].regenerate.$post({ param: { id: project.id } }),
    );
    setBusy(false);
    if (result.ok) {
      setConfirming(false);
      props.onRegenerated(result.value);
    } else setError(describeError(result.error));
  };

  const { regenerated } = report;
  return (
    <Card as="section">
      <Stack gap="xs">
        <Text>
          <b>The template has a newer version.</b> This plan was made with version{' '}
          {report.storedVersion}; the current version is {report.currentVersion}. The plan below is
          version {report.storedVersion}'s, unchanged.
        </Text>
        {regenerated.ok ? (
          regenerated.changes.length === 0 ? (
            <Text>Regenerating would change no values.</Text>
          ) : (
            <Disclosure
              summary={`Regenerating would change ${regenerated.changes.length}${regenerated.truncated ? ' or more' : ''} values`}
            >
              <RegeneratedPlan
                templateId={project.templateId}
                outputs={regenerated.outputs}
                changes={regenerated.changes}
                truncated={regenerated.truncated}
                currentVersion={report.currentVersion}
              />
            </Disclosure>
          )
        ) : (
          <>
            <Text>
              Version {report.currentVersion} cannot make a plan from this project's values:
            </Text>
            <List items={regenerated.issues.map((i) => i.message)} />
            <Text>
              Edit the project to change them; saving regenerates with the current version.
            </Text>
          </>
        )}
        {regenerated.ok &&
          (confirming ? (
            <InlineConfirm
              confirm="Regenerate"
              busyLabel="Regenerating…"
              keep="Keep this plan"
              busy={busy}
              error={error}
              onConfirm={() => void regenerate()}
              onKeep={() => {
                setConfirming(false);
                setError(null);
              }}
            >
              <Text>
                Replace the stored plan with version {report.currentVersion}'s? This cannot be
                undone.
              </Text>
            </InlineConfirm>
          ) : (
            <Cluster>
              <Button variant="secondary" onClick={() => setConfirming(true)}>
                Regenerate with version {report.currentVersion}
              </Button>
            </Cluster>
          ))}
      </Stack>
    </Card>
  );
}

/** The plan regenerating would store, each changed value marked with this plan's value. */
function RegeneratedPlan(props: {
  templateId: string;
  outputs: unknown;
  changes: readonly Change[];
  truncated: boolean;
  currentVersion: number;
}) {
  const plan = planOf(props.templateId, props.outputs);
  if (!plan.ok) return <Text>{plan.message}</Text>;
  return (
    <Stack gap="xs">
      <Text tone="muted">
        These are version {props.currentVersion}'s values. Each changed value shows this plan's
        value under it.
        {props.truncated && ' More values changed than can be listed; regenerate to see them all.'}
      </Text>
      <PlanOutputs plan={plan.plan} changes={indexChanges(props.changes)} />
    </Stack>
  );
}
