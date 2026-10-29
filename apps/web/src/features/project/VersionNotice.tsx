import { structural } from '@kerf/core';
import { useState } from 'react';
import { api, describeError, send } from '../../lib/api.ts';
import type { Project } from '../../lib/types.ts';
import {
  Button,
  Card,
  Cluster,
  Code,
  Disclosure,
  ErrorText,
  List,
  MeasureTable,
  Stack,
  Text,
} from '../../ui/index.ts';

// Tells the owner when a project's template has a newer version, what regenerating would change,
// and regenerates only when asked (decision 0008). The stored plan is never replaced otherwise.

/** A value from the version report: text as stored, numbers through core's formatter. */
export function reportValue(value: unknown): string {
  if (value === undefined) return '(none)';
  if (typeof value === 'number') return structural.formatNumber(value);
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

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
      <Card>
        <Text>
          This plan was made with template version {report.storedVersion}, newer than the version
          this app has ({report.currentVersion}). It is shown as stored and cannot be regenerated
          here.
        </Text>
      </Card>
    );
  }

  const regenerate = async () => {
    setBusy(true);
    setError(null);
    const result = await send(
      api.api.projects[':id'].regenerate.$post({ param: { id: project.id } }),
    );
    setBusy(false);
    setConfirming(false);
    if (result.ok) props.onRegenerated(result.value);
    else setError(describeError(result.error));
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
              <MeasureTable
                caption="Values regenerating would change"
                captionHidden
                rows={regenerated.changes}
                rowKey={(c) => c.path}
                columns={[
                  { key: 'value', label: 'Value', cell: (c) => <Code>{c.path}</Code> },
                  { key: 'now', label: 'Now', cell: (c) => reportValue(c.before) },
                  { key: 'after', label: 'After regenerating', cell: (c) => reportValue(c.after) },
                ]}
              />
              {regenerated.truncated && (
                <Text tone="muted">
                  Only the first {regenerated.changes.length} changes are listed.
                </Text>
              )}
            </Disclosure>
          )
        ) : (
          <>
            <Text>
              Version {report.currentVersion} cannot make a plan from this project's values:
            </Text>
            <List>
              {regenerated.issues.map((i) => (
                <li key={`${i.code}/${i.message}`}>{i.message}</li>
              ))}
            </List>
            <Text>
              Edit the project to change them; saving regenerates with the current version.
            </Text>
          </>
        )}
        {regenerated.ok &&
          (confirming ? (
            <Stack gap="xs">
              <Text>
                Replace the stored plan with version {report.currentVersion}'s? This cannot be
                undone.
              </Text>
              <Cluster>
                <Button busy={busy} onClick={() => void regenerate()}>
                  {busy ? 'Regenerating…' : 'Regenerate'}
                </Button>
                <Button variant="secondary" onClick={() => setConfirming(false)}>
                  Keep this plan
                </Button>
              </Cluster>
            </Stack>
          ) : (
            <div>
              <Button variant="secondary" onClick={() => setConfirming(true)}>
                Regenerate with version {report.currentVersion}
              </Button>
            </div>
          ))}
        {error && (
          <div role="alert">
            <ErrorText>{error}</ErrorText>
          </div>
        )}
      </Stack>
    </Card>
  );
}
