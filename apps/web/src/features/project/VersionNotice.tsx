import { type Change, formatLength, type VersionReport } from '@kerf/core';
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
  Notice,
  Stack,
  Text,
  useReturnFocus,
} from '../../ui/index.ts';
import { PlanOutputs } from '../project-editor/Preview.tsx';

// Tells the owner when a project's template has a newer version, or its boards were planned with
// another carry length than theirs now (#690), what regenerating would change, and regenerates
// only when asked (decision 0008). The stored plan is never replaced otherwise.

type Regenerable = Extract<VersionReport, { status: 'behind' | 'carry-length' }>;

const carryText = (inches: number | null) =>
  inches === null ? 'no carry length' : `a carry length of ${formatLength(inches, 'feet-inches')}`;

/** What the notice says for each reason a plan can be regenerated. */
function wordsFor(report: Regenerable) {
  if (report.status === 'behind') {
    const next = `version ${report.currentVersion}`;
    return {
      what: (
        <>
          <b>The template has a newer version.</b> This plan was made with version{' '}
          {report.storedVersion}; the current version is {report.currentVersion}. The plan below is
          version {report.storedVersion}'s, unchanged.
        </>
      ),
      values: `These are ${next}'s values.`,
      cannot: `Version ${report.currentVersion} cannot make a plan from this project's values:`,
      confirm: `Replace the stored plan with ${next}'s? This cannot be undone.`,
      button: `Regenerate with ${next}`,
    };
  }
  return {
    what: (
      <>
        <b>Your carry length changed.</b> This plan's boards were planned with{' '}
        {carryText(report.storedCarryLength)}; you now have {carryText(report.carryLength)}. The
        plan below is unchanged.
      </>
    ),
    values: 'These are the values with your carry length now.',
    cannot: "Kerf cannot make a plan from this project's values now:",
    confirm:
      'Replace the stored plan with one planned for your carry length now? This cannot be undone.',
    button: 'Update the shopping list',
  };
}

export function VersionNotice(props: {
  project: Project;
  onRegenerated: (project: Project) => void;
  /** Shows the project as another device saved it, after a regeneration refused for that. */
  onNewer?: (project: Project) => void;
}) {
  const { project } = props;
  const report = project.version;
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The revision a regeneration was refused at. A newer project, however it arrives, clears it.
  const [refusedAt, setRefusedAt] = useState<number | null>(null);
  const stale = refusedAt === project.revision;
  const trigger = useReturnFocus(confirming);
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
    // The revision this notice's changes were computed at, so another device's save since is
    // refused rather than regenerated unseen (0018).
    const result = await send(
      api.api.projects[':id'].regenerate.$post({
        param: { id: project.id },
        json: { revision: project.revision },
      }),
    );
    setBusy(false);
    if (result.ok) {
      setConfirming(false);
      props.onRegenerated(result.value);
    } else if (result.error.kind === 'stale') {
      setConfirming(false);
      setRefusedAt(project.revision);
    } else setError(describeError(result.error));
  };

  const loadNewer = async () => {
    setBusy(true);
    setError(null);
    const result = await send(api.api.projects[':id'].$get({ param: { id: project.id } }));
    setBusy(false);
    if (result.ok) props.onNewer?.(result.value);
    else setError(describeError(result.error));
  };

  const { regenerated } = report;
  const words = wordsFor(report);
  return (
    <Card as="section">
      <Stack gap="xs">
        <Text>{words.what}</Text>
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
                values={words.values}
              />
            </Disclosure>
          )
        ) : (
          <>
            <Text>{words.cannot}</Text>
            <List items={regenerated.issues.map((i) => i.message)} />
            <Text>
              Edit the project to change them; saving regenerates with the current version.
            </Text>
          </>
        )}
        {regenerated.ok &&
          (stale ? (
            <Stack gap="xs">
              <Notice>
                <b>Changed on another device.</b> This project was saved somewhere else after you
                opened it here, so regenerating now could change other values than the ones listed.
                Nothing was regenerated.
              </Notice>
              {error && <Notice>{error}</Notice>}
              {props.onNewer && (
                <Cluster>
                  <Button
                    variant="secondary"
                    busy={busy}
                    busyLabel="Loading…"
                    onClick={() => void loadNewer()}
                  >
                    Load the newer version
                  </Button>
                </Cluster>
              )}
            </Stack>
          ) : confirming ? (
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
              <Text>{words.confirm}</Text>
            </InlineConfirm>
          ) : (
            <Cluster>
              <Button ref={trigger} variant="secondary" onClick={() => setConfirming(true)}>
                {words.button}
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
  /** Whose values these are. */
  values: string;
}) {
  const plan = planOf(props.templateId, props.outputs);
  if (!plan.ok) return <Text>{plan.message}</Text>;
  return (
    <Stack gap="xs">
      <Text tone="muted">
        {props.values} Each changed value shows this plan's value under it.
        {props.truncated && ' More values changed than can be listed; regenerate to see them all.'}
      </Text>
      <PlanOutputs plan={plan.plan} changes={indexChanges(props.changes)} />
    </Stack>
  );
}
