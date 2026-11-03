import type { ReactNode } from 'react';
import type { SaveState } from '../../lib/api.ts';
import {
  Button,
  ButtonLink,
  Cluster,
  FormProgress,
  Notice,
  SaveFailed,
  Stack,
} from '../../ui/index.ts';

// Beside the editor's fields: how much is entered, what happened to the last save, and Save and
// Cancel.

/** A save, or one refused because another device saved the project first (0018). */
export type EditorSaveState = SaveState | { state: 'stale'; revision: number };

export function EditorActions(props: {
  progress: { entered: number; total: number; empty: { group: string; field: string }[] };
  saveState: EditorSaveState;
  /** Saves the form's changes over the newer revision another device saved. */
  onSaveOver: (revision: number) => void;
  /** Loads the project again, when the editor can. */
  onReload?: () => void;
  submit: ReactNode;
  cancelHref: string;
}) {
  const { saveState } = props;
  return (
    <Stack gap="s">
      <FormProgress {...props.progress} />
      {saveState.state === 'failed' && <SaveFailed failure={saveState.failure} />}
      {saveState.state === 'stale' && (
        <Stack gap="xs">
          <Notice>
            <b>Changed on another device.</b> This project was saved somewhere else after you opened
            it here. Your changes are still in the form.
          </Notice>
          <Cluster>
            <Button variant="secondary" onClick={() => props.onSaveOver(saveState.revision)}>
              Save my changes over it
            </Button>
            {props.onReload && (
              <Button variant="secondary" onClick={props.onReload}>
                Load the newer version
              </Button>
            )}
          </Cluster>
        </Stack>
      )}
      <Cluster>
        {props.submit}
        <ButtonLink variant="secondary" href={props.cancelHref}>
          Cancel
        </ButtonLink>
      </Cluster>
    </Stack>
  );
}
