import { capabilityForm, findToolType, TOOL_GROUP_LABELS, TOOL_GROUPS } from '@kerf/core';
import { useEffect, useRef, useState } from 'react';
import { api, type FieldIssue, failureOf, type SaveState, send } from '../../lib/api.ts';
import { FieldInput } from '../../lib/FieldInput.tsx';
import { Loaded } from '../../lib/Loaded.tsx';
import { href } from '../../lib/route.ts';
import { useLoad } from '../../lib/useLoad.ts';
import {
  Button,
  Cluster,
  Disclosure,
  ErrorSummary,
  Field,
  Grid,
  InputNeeded,
  Row,
  Rows,
  SaveFailed,
  ScreenHeader,
  Stack,
  StatusLine,
  type SummaryItem,
  Text,
  TextInput,
  ToolLabel,
  useDraft,
  useFormIssues,
} from '../../ui/index.ts';
import {
  addAnother,
  addTool,
  detailsNeeded,
  fromInventory,
  type InventoryDraft,
  issueFor,
  matchingTypes,
  removeAt,
  restoreTools,
  type ToolDraft,
  toInventory,
} from './draft.ts';

// My toolbox (PRODUCT.md, MVP feature 1; Stage 19, #363): the tools the owner has, each with the
// capabilities build steps choose methods by, none filled in (hard rule 3). A tool is added from
// the library in one tap and removed in one, with Undo; every change saves as it is made, typing
// a moment after the last key.

/** How long after the last key a typed capability saves. */
const TYPING_MS = 800;

export function ToolsScreen() {
  const { loaded, set, reload } = useLoad(() => send(api.api.tools.$get()), 'tools');
  return (
    <Loaded
      state={loaded}
      shape="list"
      loading="Loading tools…"
      onRetry={reload}
      title="My toolbox"
    >
      {(inventory) => <ToolsEditor saved={fromInventory(inventory)} onSaved={set} />}
    </Loaded>
  );
}

export function ToolsEditor(props: {
  saved: InventoryDraft;
  onSaved?: (inventory: Parameters<typeof fromInventory>[0]) => void;
}) {
  // What the server has, so leaving with a change not yet saved asks first.
  const [stored, setStored] = useState(props.saved);
  const { draft, setDraft, dialog } = useDraft(stored);
  const { issues, attempt, report } = useFormIssues<FieldIssue[]>([]);
  const [save, setSave] = useState<SaveState>({ state: 'idle' });
  const [removed, setRemoved] = useState<{ tools: ToolDraft[]; name: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const saveNow = async (next: InventoryDraft) => {
    clearTimeout(timer.current);
    const checked = toInventory(next);
    report(checked.ok ? [] : checked.issues, !checked.ok);
    if (!checked.ok) return;
    setSave({ state: 'saving' });
    const result = await send(api.api.tools.$put({ json: checked.inventory }));
    if (result.ok) {
      setSave({ state: 'saved' });
      setStored(next);
      props.onSaved?.(result.value);
    } else {
      if (result.error.kind === 'invalid') report(result.error.issues, true);
      setSave({ state: 'failed', failure: failureOf(result.error) });
    }
  };
  /** A tool added or removed saves at once; typing waits for a pause. */
  const change = (next: InventoryDraft, when: 'now' | 'after-typing') => {
    setDraft(next);
    setSave({ state: 'idle' });
    clearTimeout(timer.current);
    if (when === 'now') void saveNow(next);
    else timer.current = setTimeout(() => void saveNow(next), TYPING_MS);
  };
  const editTool = (t: number, edit: (tool: ToolDraft) => ToolDraft) =>
    change(
      { ...draft, tools: draft.tools.map((tool, i) => (i === t ? edit(tool) : tool)) },
      'after-typing',
    );
  const add = (toolTypeId: string) => {
    setRemoved(null);
    change(addTool(draft, toolTypeId), 'now');
  };
  const remove = (t: number) => {
    const tool = draft.tools[t];
    if (!tool) return;
    const type = findToolType(tool.toolTypeId);
    setRemoved({ tools: [tool], name: tool.name.trim() || type?.name || tool.toolTypeId });
    change(removeAt(draft, t), 'now');
  };
  const undo = () => {
    if (!removed) return;
    setRemoved(null);
    change(restoreTools(draft, removed.tools), 'now');
  };

  const owned = draft.tools.map((tool, t) => ({
    tool,
    t,
    type: findToolType(tool.toolTypeId),
    repeated: draft.tools.filter((x) => x.toolTypeId === tool.toolTypeId).length > 1,
  }));
  return (
    <Stack>
      <ScreenHeader
        title="My toolbox"
        lede="The tools you have. Build steps choose a method for each cut and joint from these."
        status={
          removed ? (
            <StatusLine>
              Removed {removed.name}.{' '}
              <Button variant="link" onClick={undo}>
                Undo
              </Button>
            </StatusLine>
          ) : save.state === 'saved' ? (
            <StatusLine>Saved.</StatusLine>
          ) : save.state === 'saving' ? (
            <StatusLine>Saving…</StatusLine>
          ) : undefined
        }
      />
      <ErrorSummary items={summaryItems(issues)} attempt={attempt} />
      {save.state === 'failed' && issues.length === 0 && <SaveFailed failure={save.failure} />}

      {owned.length === 0 ? (
        <Text>No tools yet. Add the ones you have, and build steps choose methods from them.</Text>
      ) : (
        TOOL_GROUPS.map((group) => {
          const mine = owned.filter(({ type }) => type?.group === group);
          if (mine.length === 0) return null;
          return (
            <Stack key={group} as="section" gap="xs">
              <h2>{TOOL_GROUP_LABELS[group]}</h2>
              <Rows as="ul">
                {mine.map(({ tool, t, repeated }) => (
                  // Keyed by position: names can be blank or repeated while typing.
                  <Row key={t} as="li">
                    <OwnedTool
                      tool={tool}
                      index={t}
                      repeated={repeated}
                      issues={issues}
                      onChange={(path, text) =>
                        editTool(t, (x) => ({ ...x, values: { ...x.values, [path]: text } }))
                      }
                      onName={(name) => editTool(t, (x) => ({ ...x, name }))}
                      onAddAnother={() => change(addAnother(draft, tool.toolTypeId), 'now')}
                      onRemove={() => remove(t)}
                    />
                  </Row>
                ))}
              </Rows>
            </Stack>
          );
        })
      )}

      {/* After your tools, so one just added is in view; open while there are none. */}
      <AddTool
        owned={new Set(draft.tools.map((t) => t.toolTypeId))}
        open={owned.length === 0}
        onAdd={add}
      />
      {dialog}
    </Stack>
  );
}

/** The library, searched, with each tool not yet owned one tap from being added. */
function AddTool(props: {
  owned: ReadonlySet<string>;
  open: boolean;
  onAdd: (toolTypeId: string) => void;
}) {
  const [query, setQuery] = useState('');
  const matching = matchingTypes(query).filter((t) => !props.owned.has(t.id));
  return (
    <Disclosure summary="Add a tool" open={props.open || undefined}>
      <Stack gap="s">
        <Field id="tool-search" label="Find a tool">
          {(c) => <TextInput {...c} type="search" value={query} onChange={setQuery} />}
        </Field>
        {matching.length === 0 && (
          <Text>
            {query.trim()
              ? `No tool in the library matches "${query.trim()}" that you do not have already.`
              : 'You have every tool in the library.'}
          </Text>
        )}
        {TOOL_GROUPS.map((group) => {
          const types = matching.filter((t) => t.group === group);
          if (types.length === 0) return null;
          return (
            <Stack key={group} gap="2xs">
              <h3>{TOOL_GROUP_LABELS[group]}</h3>
              <Cluster gap="xs">
                {types.map((type) => (
                  <Button key={type.id} variant="secondary" onClick={() => props.onAdd(type.id)}>
                    <ToolLabel toolTypeId={type.id}>{type.name}</ToolLabel>
                  </Button>
                ))}
              </Cluster>
            </Stack>
          );
        })}
      </Stack>
    </Disclosure>
  );
}

/** The control an issue's path points at, such as a capability or an other tool's name. */
function controlId(path: string): string {
  return `tool-${path.replace(/\./g, '-')}`;
}

function summaryItems(issues: readonly FieldIssue[]): SummaryItem[] {
  return issues.map((i) => ({ field: controlId(i.field ?? ''), message: i.message }));
}

function OwnedTool(props: {
  tool: ToolDraft;
  index: number;
  repeated: boolean;
  issues: FieldIssue[];
  onChange: (path: string, text: string) => void;
  onName: (name: string) => void;
  onAddAnother: () => void;
  onRemove: () => void;
}) {
  const type = findToolType(props.tool.toolTypeId);
  // The API accepts only library tools, so every saved tool is found.
  if (!type) return null;
  const fields = capabilityForm(type).fields;
  const at = `tools.${props.index}`;
  const needed = detailsNeeded(props.tool);
  const name = props.tool.name.trim();
  const lower = type.name.toLowerCase();
  const nameIssue = issueFor(props.issues, `${at}.name`);
  return (
    <Stack gap="xs">
      <Cluster spread>
        <span>
          <ToolLabel toolTypeId={type.id}>{name ? `${type.name}: ${name}` : type.name}</ToolLabel>{' '}
          {needed > 0 && (
            <InputNeeded>
              {needed === 1 ? '1 detail needed' : `${needed} details needed`}
            </InputNeeded>
          )}
        </span>
        <Button variant="link" label={`Remove ${name || lower}`} onClick={props.onRemove}>
          Remove
        </Button>
      </Cluster>
      {(fields.length > 0 || props.repeated) && (
        <Grid min="m" gap="s">
          {props.repeated && (
            <Field
              id={controlId(`${at}.name`)}
              label="Name"
              hint="Build steps use it to say which one."
              error={nameIssue}
            >
              {(c) => <TextInput {...c} value={props.tool.name} onChange={props.onName} />}
            </Field>
          )}
          {fields.map((field) => (
            <FieldInput
              key={field.path}
              id={controlId(`${at}.capabilities.${field.path}`)}
              field={field}
              text={props.tool.values[field.path] ?? ''}
              issue={issueFor(props.issues, `${at}.capabilities.${field.path}`)}
              onChange={(text) => props.onChange(field.path, text)}
              needed
            />
          ))}
        </Grid>
      )}
      {fields.length > 0 && (
        <Cluster>
          <Button variant="link" onClick={props.onAddAnother}>
            {lower.endsWith('s') ? `Add another set of ${lower}` : `Add another ${lower}`}
          </Button>
          <a href={href({ screen: 'tools', tool: type.id })}>About this tool</a>
        </Cluster>
      )}
    </Stack>
  );
}
