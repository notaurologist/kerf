import { api, send } from '../../lib/api.ts';
import { Loaded } from '../../lib/Loaded.tsx';
import { href } from '../../lib/route.ts';
import type { TemplateSummary } from '../../lib/types.ts';
import { useLoad } from '../../lib/useLoad.ts';
import { loadTemplateDrawing } from '../../lib/views.ts';
import { Card, Diagram, Grid, RowLink, ScreenHeader, Stack, Text } from '../../ui/index.ts';

// Choosing what to make (#357): every template in the catalog, each with what it is and its first
// worked example drawn assembled without part letters. Picking one opens its new-project form. No template is named
// here (hard rule 7).

export function TemplatePicker() {
  const { loaded, reload } = useLoad(() => send(api.api.templates.$get()), 'templates');
  return (
    <Loaded
      state={loaded}
      shape="list"
      loading="Loading templates…"
      onRetry={reload}
      title="New project"
    >
      {(value) => <TemplateList templates={value.templates} />}
    </Loaded>
  );
}

export function TemplateList(props: { templates: readonly TemplateSummary[] }) {
  return (
    <Stack>
      <ScreenHeader title="New project" lede="What do you want to make?" />
      {/* Side by side when there is room, so every template is in view on a laptop. */}
      <Grid min="l" gap="l">
        {props.templates.map((t) => (
          <Card key={t.id} as="section">
            <Stack gap="xs">
              <RowLink href={href({ screen: 'new-project', templateId: t.id })}>{t.name}</RowLink>
              <Text>{t.description}</Text>
              <TemplateDrawing id={t.id} />
            </Stack>
          </Card>
        ))}
      </Grid>
    </Stack>
  );
}

/** A template's worked example, or nothing while it loads or when it cannot be drawn. */
function TemplateDrawing(props: { id: string }) {
  const { loaded } = useLoad(() => loadTemplateDrawing(props.id), `template-drawing-${props.id}`);
  if (loaded.state !== 'ready' || !loaded.value) return null;
  return <Diagram drawing={loaded.value} label={loaded.value.description} />;
}
