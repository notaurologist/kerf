import { useState } from 'react';
import { api, describeError, send } from '../../lib/api.ts';
import { navigate } from '../../lib/route.ts';
import {
  Button,
  Card,
  Cluster,
  Field,
  InlineConfirm,
  Text,
  TextInput,
  useReturnFocus,
} from '../../ui/index.ts';

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
  const [nameError, setNameError] = useState<string | undefined>(undefined);
  const trigger = useReturnFocus(open);

  if (!open) {
    return (
      <Cluster>
        <Button ref={trigger} variant="destructive" onClick={() => setOpen(true)}>
          Delete project
        </Button>
      </Cluster>
    );
  }

  const remove = async () => {
    if (!confirmsName(typed, props.name)) {
      setNameError(`Type “${props.name.trim()}” exactly to delete this project.`);
      return;
    }
    setNameError(undefined);
    setBusy(true);
    setError(null);
    const result = await send(api.api.projects[':id'].$delete({ param: { id: props.id } }));
    setBusy(false);
    if (result.ok) navigate({ screen: 'projects' });
    else setError(describeError(result.error));
  };

  return (
    <Card as="section">
      <InlineConfirm
        confirm="Delete project"
        busyLabel="Deleting…"
        variant="destructive"
        keep="Keep project"
        busy={busy}
        error={error}
        onConfirm={() => void remove()}
        onKeep={() => {
          setOpen(false);
          setTyped('');
          setError(null);
          setNameError(undefined);
        }}
      >
        <Text>
          <b>Delete “{props.name}”?</b> This deletes the project, its plan, and its history. It
          cannot be undone.
        </Text>
        <Field label="Type the project's name to confirm" error={nameError}>
          {(c) => <TextInput {...c} value={typed} onChange={setTyped} autoComplete="off" />}
        </Field>
      </InlineConfirm>
    </Card>
  );
}
