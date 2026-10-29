import { type FormEvent, useState } from 'react';
import { api, describeError, send } from '../../lib/api.ts';
import { navigate } from '../../lib/route.ts';

// Deleting a project is permanent (issue #22): there is no archive and, until backups exist, no
// way back. The owner confirms by typing the project's name.

/** True when what was typed names the project, ignoring spaces at either end. */
export function confirmsName(typed: string, name: string): boolean {
  return typed.trim() === name.trim();
}

export function DeleteProject(props: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <section className="delete-project">
        <button type="button" onClick={() => setOpen(true)}>
          Delete project
        </button>
      </section>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!confirmsName(typed, props.name)) return;
    setBusy(true);
    setError(null);
    const result = await send(api.api.projects[':id'].$delete({ param: { id: props.id } }));
    setBusy(false);
    if (result.ok) navigate({ screen: 'projects' });
    else setError(describeError(result.error));
  };

  return (
    <section className="delete-project">
      <form onSubmit={(e) => void submit(e)} className="stack notice">
        <p>
          <strong>Delete “{props.name}”?</strong> The project, its plan, and its history are removed
          permanently. This cannot be undone.
        </p>
        <label className="field">
          <span>Type the project's name to confirm</span>
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            disabled={busy}
            autoComplete="off"
          />
        </label>
        <div className="row">
          <button
            type="submit"
            className="danger"
            disabled={busy || !confirmsName(typed, props.name)}
          >
            {busy ? 'Deleting…' : 'Delete permanently'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setOpen(false);
              setTyped('');
              setError(null);
            }}
          >
            Keep project
          </button>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </form>
    </section>
  );
}
