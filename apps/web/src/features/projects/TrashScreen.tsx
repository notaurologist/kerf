import { type ReactNode, useState } from 'react';
import { api, describeError, send } from '../../lib/api.ts';
import { Loaded } from '../../lib/Loaded.tsx';
import { href } from '../../lib/route.ts';
import type { TrashedProject } from '../../lib/types.ts';
import { useLoad } from '../../lib/useLoad.ts';
import {
  Button,
  Cluster,
  ErrorText,
  InlineConfirm,
  Row,
  Rows,
  ScreenHeader,
  Stack,
  StatusLine,
  Text,
} from '../../ui/index.ts';
import { Restored } from './Restored.tsx';

// Deleted projects wait here for 30 days before they are deleted for good (#21). Each can be
// restored as it was, or deleted now.

const day = (iso: string) => new Date(iso).toLocaleDateString();

export function TrashScreen() {
  const { loaded, update, reload } = useLoad(() => send(api.api.trash.$get()), 'trash');
  const [said, setSaid] = useState<ReactNode>(null);
  const drop = (id: string) =>
    update((value: { projects: TrashedProject[] }) => ({
      projects: value.projects.filter((p) => p.id !== id),
    }));
  return (
    <Loaded
      state={loaded}
      shape="list"
      loading="Loading deleted projects…"
      onRetry={reload}
      title="Deleted projects"
    >
      {(value) => (
        <TrashList
          projects={value.projects}
          said={said}
          onGone={(project, how) => {
            drop(project.id);
            setSaid(
              how === 'restored' ? (
                <Restored project={project} />
              ) : (
                `Deleted “${project.name}” for good.`
              ),
            );
          }}
        />
      )}
    </Loaded>
  );
}

export function TrashList(props: {
  projects: readonly TrashedProject[];
  said?: ReactNode;
  onGone: (project: TrashedProject, how: 'restored' | 'deleted') => void;
}) {
  return (
    <Stack>
      <ScreenHeader
        title="Deleted projects"
        lede="Deleted projects wait here for 30 days, then are deleted for good."
        status={props.said && <StatusLine>{props.said}</StatusLine>}
      />
      {props.projects.length === 0 ? (
        <Text>No deleted projects.</Text>
      ) : (
        <Rows as="ul">
          {props.projects.map((p) => (
            <Row key={p.id} as="li">
              <TrashedRow project={p} onGone={(how) => props.onGone(p, how)} />
            </Row>
          ))}
        </Rows>
      )}
      <Text>
        <a href={href({ screen: 'projects' })}>Back to projects</a>
      </Text>
    </Stack>
  );
}

function TrashedRow(props: {
  project: TrashedProject;
  onGone: (how: 'restored' | 'deleted') => void;
}) {
  const { project } = props;
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const param = { param: { id: project.id } };

  const run = async (how: 'restored' | 'deleted') => {
    setBusy(true);
    setError(null);
    const result = await send(
      how === 'restored'
        ? api.api.trash[':id'].restore.$post(param)
        : api.api.trash[':id'].$delete(param),
    );
    setBusy(false);
    if (result.ok) props.onGone(how);
    else setError(describeError(result.error));
  };

  return (
    <Stack gap="2xs">
      <b>{project.name}</b>
      <Text tone="muted">
        Deleted {day(project.deletedAt)}. Deleted for good on {day(project.purgeAt)}.
      </Text>
      {confirming ? (
        <InlineConfirm
          confirm="Delete project for good"
          busyLabel="Deleting…"
          variant="destructive"
          keep="Keep it here"
          busy={busy}
          error={error}
          onConfirm={() => void run('deleted')}
          onKeep={() => {
            setConfirming(false);
            setError(null);
          }}
        >
          <Text>
            <b>Delete “{project.name}” for good?</b> Its plan and history go with it. This cannot be
            undone.
          </Text>
        </InlineConfirm>
      ) : (
        <>
          <Cluster>
            <Button
              variant="secondary"
              busy={busy}
              busyLabel="Restoring…"
              onClick={() => void run('restored')}
            >
              Restore
            </Button>
            <Button variant="destructive" onClick={() => setConfirming(true)}>
              Delete project for good
            </Button>
          </Cluster>
          {error && <ErrorText alert>{error}</ErrorText>}
        </>
      )}
    </Stack>
  );
}
