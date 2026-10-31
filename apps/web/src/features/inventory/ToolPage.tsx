import { findToolType, methodsUsing, OPERATION_TYPE_LABELS, TOOL_GROUP_LABELS } from '@kerf/core';
import { api, send } from '../../lib/api.ts';
import { Loaded } from '../../lib/Loaded.tsx';
import { href } from '../../lib/route.ts';
import { useLoad } from '../../lib/useLoad.ts';
import { PlainList, ScreenHeader, Stack, Text, ToolLabel } from '../../ui/index.ts';
import { keptTools } from './ToolsScreen.tsx';

// A tool type's own page (#/tools/<id>): what it is, whether the owner has one, the details Kerf
// asks for about it, and the methods that can use it. A method's tool names link here.

export function ToolPage(props: { id: string }) {
  const type = findToolType(props.id);
  const { loaded, reload } = useLoad(() => send(api.api.tools.$get()), 'tools', keptTools);
  if (!type) return <Text>There is no page here.</Text>;
  const uses = methodsUsing(type.id);
  const toolList = href({ screen: 'tools' });
  return (
    <Stack>
      <ScreenHeader
        title={type.name}
        heading={<ToolLabel toolTypeId={type.id}>{type.name}</ToolLabel>}
        meta={
          <>
            {TOOL_GROUP_LABELS[type.group]} · <a href={toolList}>All tools</a>
          </>
        }
      />
      <Text>{type.description}</Text>
      <Loaded state={loaded} loading="Checking your tools…" onRetry={reload}>
        {(inventory) => {
          const count = inventory.tools.filter((t) => t.toolTypeId === type.id).length;
          return (
            <Text>
              {count === 0 ? (
                <>
                  Not in your tool list. <a href={toolList}>Add it on the Tools screen</a> for build
                  steps to choose methods that use it.
                </>
              ) : count === 1 ? (
                'In your tool list.'
              ) : (
                `${count} in your tool list.`
              )}
            </Text>
          );
        }}
      </Loaded>

      {type.capabilities.length > 0 && (
        <Stack as="section" gap="xs">
          <h2>Details Kerf asks for</h2>
          <PlainList>
            {type.capabilities.map((c) => (
              <li key={c.id}>
                <Stack gap="3xs">
                  <b>{c.label}</b>
                  <span>{c.help}</span>
                  <Text tone="muted" as="span">
                    Where to get it: {c.readFrom}
                  </Text>
                </Stack>
              </li>
            ))}
          </PlainList>
        </Stack>
      )}

      <Stack as="section" gap="xs">
        <h2>Methods that use it</h2>
        {uses.length === 0 ? (
          <Text>No method in Kerf uses it yet, so it does not change the build steps.</Text>
        ) : (
          <PlainList gap="xs">
            {uses.map(({ method, use }) => (
              <li key={method.id}>
                {OPERATION_TYPE_LABELS[method.operation]}: {method.name.toLowerCase()}, for {use}.
              </li>
            ))}
          </PlainList>
        )}
      </Stack>
    </Stack>
  );
}
