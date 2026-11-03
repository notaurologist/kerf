import { type BackupHost, useBackup } from '../../lib/backup.ts';
import { href } from '../../lib/route.ts';
import { ThemeSwitch } from '../../lib/theme.tsx';
import {
  Button,
  Cluster,
  LiveRegion,
  Notice,
  Row,
  RowLink,
  Rows,
  ScreenHeader,
  Stack,
  Text,
} from '../../ui/index.ts';

// Stage 12's Workshop (#356): what is not one project, out of the way of the plan. The glossary is
// mostly read from a marked term (#178), so here it is one way in of several.

const PLACES = [
  {
    label: 'My toolbox',
    href: href({ screen: 'tools' }),
    about: 'The tools you have. Build steps choose their methods from these.',
  },
  {
    label: 'Glossary',
    href: href({ screen: 'glossary' }),
    about: 'The woodworking and structural terms the plans use.',
  },
  {
    label: 'Deleted projects',
    href: href({ screen: 'trash' }),
    about: 'Kept for 30 days, then deleted for good. Restore one from here.',
  },
] as const;

export function WorkshopScreen(props: {
  onLogOut: () => void;
  backupHost?: () => BackupHost;
  fetchBackup?: Parameters<typeof useBackup>[1];
}) {
  const { backup, onDownload } = useBackup(props.backupHost, props.fetchBackup);
  return (
    <Stack>
      <ScreenHeader title="Workshop" />
      <Rows as="ul">
        {PLACES.map((place) => (
          <Row key={place.href} as="li">
            <Stack gap="3xs">
              <RowLink href={place.href}>{place.label}</RowLink>
              <Text tone="muted">{place.about}</Text>
            </Stack>
          </Row>
        ))}
        <Row as="li">
          {/* A copy to keep: the free database restores only the last few hours (#21). An action,
              so a button rather than a row's link. */}
          <Stack gap="xs">
            <Stack gap="3xs">
              <b>Backup</b>
              <Text tone="muted">
                Every project, including deleted ones still in the trash, and your tools, as one
                file to keep. Kerf cannot load this file back in; a full restore comes from a
                database dump (ARCHITECTURE.md, Backups).
              </Text>
            </Stack>
            <Cluster>
              <Button variant="secondary" onClick={onDownload}>
                Download a backup
              </Button>
            </Cluster>
            <LiveRegion>
              {backup.state === 'preparing' && <Text tone="muted">Preparing the backup…</Text>}
              {backup.state === 'ready' && (
                <Text>The backup is ready. Tap Download a backup again to save it.</Text>
              )}
            </LiveRegion>
            {backup.state === 'failed' && (
              <Notice icon={backup.failure.connection ? 'connection' : 'error'}>
                {backup.failure.message}
              </Notice>
            )}
          </Stack>
        </Row>
      </Rows>
      <Cluster>
        <ThemeSwitch named />
        <Button variant="secondary" onClick={props.onLogOut}>
          Log out
        </Button>
      </Cluster>
    </Stack>
  );
}
