import type { ResetNote } from '@kerf/core';
import { useState } from 'react';
import { api, failureOf, send } from '../../lib/api.ts';
import { projectStore } from '../../lib/projectStore.ts';
import type { Project } from '../../lib/types.ts';
import {
  Button,
  Cluster,
  type Failure,
  InfoNotice,
  Measured,
  PlainList,
  SaveFailed,
  Stack,
  Text,
} from '../../ui/index.ts';

// What a change made mid-build cleared (#444). Each note is core's, read against the current
// plan by the API: the item as the plan names it, what it was done to and what the plan has now,
// and what to do. The notes stay on the project until the owner dismisses them, on the plan for
// all of them and on a step or the shopping list for those about it.

type ProjectReset = Project['resets'][number];

const id = (r: Pick<ProjectReset, 'kind' | 'key' | 'resetAt'>) => `${r.kind}:${r.key}:${r.resetAt}`;

/** One note: the item, what changed, and what to do. */
export function ResetLine(props: { note: Pick<ResetNote, 'item' | 'change' | 'action'> }) {
  const { note } = props;
  return (
    <>
      <b>
        <Measured text={note.item} />
      </b>
      : <Measured text={note.change} />.
      {note.action && (
        <>
          {' '}
          <Measured text={note.action} />
        </>
      )}
    </>
  );
}

/**
 * The notes on a project, or the ones `only` keeps, with Dismiss. Nothing when there are none.
 * Dismissing sends each note's time, so it never clears a later reset of the same item.
 */
export function ResetNotes(props: { project: Project; only?: (note: ProjectReset) => boolean }) {
  const { project } = props;
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const notes = project.resets.filter(
    (n) => !dismissed.has(id(n)) && (props.only ? props.only(n) : true),
  );
  if (notes.length === 0) return null;

  const dismiss = async () => {
    setBusy(true);
    setFailure(null);
    const result = await send(
      api.api.projects[':id'].resets.dismiss.$post({
        param: { id: project.id },
        json: { resets: notes.map(({ kind, key, resetAt }) => ({ kind, key, resetAt })) },
      }),
    );
    setBusy(false);
    if (!result.ok) {
      setFailure(failureOf(result.error));
      return;
    }
    setDismissed(new Set([...dismissed, ...notes.map(id)]));
    projectStore.set({ ...project, resets: result.value.resets });
  };

  return (
    <InfoNotice>
      <Stack gap="xs">
        <Text>
          <b>Done before a change to the plan.</b> The change cleared{' '}
          {notes.length === 1 ? 'this mark' : 'these marks'}, but the work is still done. Check it
          against the plan as it is now.
        </Text>
        <PlainList gap="xs">
          {notes.map((note) => (
            <li key={id(note)}>
              <ResetLine note={note} />
            </li>
          ))}
        </PlainList>
        {failure && (
          <SaveFailed
            failure={failure}
            title="Not dismissed."
            kept={notes.length === 1 ? 'The note is still here.' : 'The notes are still here.'}
          />
        )}
        <Cluster>
          <Button variant="secondary" onClick={dismiss} busy={busy}>
            {notes.length === 1 ? 'Dismiss note' : 'Dismiss notes'}
          </Button>
        </Cluster>
      </Stack>
    </InfoNotice>
  );
}

/** The boards to buy for pieces cut shorter than the plan now needs. */
export function replacementsOf(resets: readonly ResetNote[]) {
  return resets.flatMap((r) => (r.replacement ? [r.replacement] : []));
}
