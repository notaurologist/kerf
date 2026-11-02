import { href } from '../../lib/route.ts';
import { ThemeSwitch } from '../../lib/theme.tsx';
import { Button, Cluster, Row, Rows, ScreenHeader, Stack, Text } from '../../ui/index.ts';

// Stage 12's Workshop (#356): what is not one project, out of the way of the plan. The glossary is
// mostly read from a marked term (#178), so here it is one way in of several.

const PLACES = [
  {
    label: 'Tools',
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

export function WorkshopScreen(props: { onLogOut: () => void }) {
  return (
    <Stack>
      <ScreenHeader title="Workshop" />
      <Rows as="ul">
        {PLACES.map((place) => (
          <Row key={place.href} as="li">
            <Stack gap="3xs">
              <a href={place.href}>{place.label}</a>
              <Text tone="muted">{place.about}</Text>
            </Stack>
          </Row>
        ))}
        <Row as="li">
          {/* A copy to keep: the free database restores only the last few hours (#21). */}
          <Stack gap="3xs">
            <a href="/api/export" download>
              Download a backup
            </a>
            <Text tone="muted">Every project and your tools, as one file to keep.</Text>
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
