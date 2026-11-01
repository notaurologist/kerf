import { useState } from 'react';
import { api, describeError, send } from '../../lib/api.ts';
import { setFlash } from '../../lib/flash.ts';
import { projectStore } from '../../lib/projectStore.ts';
import { navigate } from '../../lib/route.ts';
import {
  Button,
  Card,
  Cluster,
  InlineConfirm,
  Stack,
  Text,
  useReturnFocus,
} from '../../ui/index.ts';

// Deleting moves the project to the trash, where it can be restored for 30 days before it is
// deleted for good (#21). Since it can be undone, one confirmation is enough. It sits at the foot
// of the Edit screen, away from the plan's Previous and Next, so it is never tapped on the way
// somewhere else.

export function DeleteProject(props: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trigger = useReturnFocus(open);

  if (!open) {
    return (
      <Stack as="section" gap="xs">
        <h2>Delete this project</h2>
        <Cluster>
          <Button ref={trigger} variant="destructive" onClick={() => setOpen(true)}>
            Delete project
          </Button>
        </Cluster>
      </Stack>
    );
  }

  const remove = async () => {
    setBusy(true);
    setError(null);
    const result = await send(api.api.projects[':id'].$delete({ param: { id: props.id } }));
    setBusy(false);
    if (result.ok) {
      projectStore.forget(props.id);
      setFlash(`Moved “${props.name.trim()}” to the trash. You can restore it there for 30 days.`);
      navigate({ screen: 'projects' });
    } else setError(describeError(result.error));
  };

  return (
    <Card as="section">
      <InlineConfirm
        confirm="Move to trash"
        busyLabel="Moving…"
        variant="destructive"
        keep="Keep project"
        busy={busy}
        error={error}
        onConfirm={() => void remove()}
        onKeep={() => {
          setOpen(false);
          setError(null);
        }}
      >
        <Text>
          <b>Delete “{props.name}”?</b> It moves to the trash with its plan and history. You can
          restore it there for 30 days, then it is deleted for good.
        </Text>
      </InlineConfirm>
    </Card>
  );
}
