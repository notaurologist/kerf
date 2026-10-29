import { structural } from '@kerf/core';
import { useState } from 'react';
import { api, describeError, send } from '../../lib/api.ts';
import type { Project } from '../../lib/types.ts';

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
      <div className="notice" role="status">
        This plan was made with template version {report.storedVersion}, newer than the version this
        app has ({report.currentVersion}). It is shown as stored and cannot be regenerated here.
      </div>
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
    <div className="notice version" role="status">
      <p>
        <strong>The template has a newer version.</strong> This plan was made with version{' '}
        {report.storedVersion}; the current version is {report.currentVersion}. The plan below is
        version {report.storedVersion}'s, unchanged.
      </p>
      {regenerated.ok ? (
        regenerated.changes.length === 0 ? (
          <p>Regenerating would change no values.</p>
        ) : (
          <details>
            <summary>
              Regenerating would change {regenerated.changes.length}
              {regenerated.truncated ? ' or more' : ''} values
            </summary>
            <table className="list keep changes">
              <thead>
                <tr>
                  <th>Value</th>
                  <th>Now</th>
                  <th>After regenerating</th>
                </tr>
              </thead>
              <tbody>
                {regenerated.changes.map((c) => (
                  <tr key={c.path}>
                    <td>
                      <code>{c.path}</code>
                    </td>
                    <td>{reportValue(c.before)}</td>
                    <td>{reportValue(c.after)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {regenerated.truncated && (
              <p className="muted">
                Only the first {regenerated.changes.length} changes are listed.
              </p>
            )}
          </details>
        )
      ) : (
        <>
          <p>Version {report.currentVersion} cannot make a plan from this project's values:</p>
          <ul>
            {regenerated.issues.map((i) => (
              <li key={`${i.code}/${i.message}`}>{i.message}</li>
            ))}
          </ul>
          <p>Edit the project to change them; saving regenerates with the current version.</p>
        </>
      )}
      {regenerated.ok &&
        (confirming ? (
          <div className="row">
            <span>
              Replace the stored plan with version {report.currentVersion}'s? This cannot be undone.
            </span>
            <button
              type="button"
              className="primary"
              disabled={busy}
              onClick={() => void regenerate()}
            >
              {busy ? 'Regenerating…' : 'Regenerate'}
            </button>
            <button type="button" disabled={busy} onClick={() => setConfirming(false)}>
              Keep this plan
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirming(true)}>
            Regenerate with version {report.currentVersion}
          </button>
        ))}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
