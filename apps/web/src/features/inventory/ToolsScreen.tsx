import {
  capabilityForm,
  findToolType,
  TOOL_GROUP_LABELS,
  TOOL_GROUPS,
  TOOL_TYPES,
} from '@kerf/core';
import { useEffect, useState } from 'react';
import { api, type FieldIssue, failureOf, type SaveState, send } from '../../lib/api.ts';
import { FieldInput } from '../../lib/FieldInput.tsx';
import { Loaded } from '../../lib/Loaded.tsx';
import { useLoad } from '../../lib/useLoad.ts';
import {
  Button,
  Card,
  Cluster,
  ErrorSummary,
  Field,
  Grid,
  SaveFailed,
  ScreenHeader,
  Stack,
  StatusLine,
  type SummaryItem,
  Text,
  TextInput,
} from '../../ui/index.ts';
import {
  addTool,
  fromInventory,
  type InventoryDraft,
  issueFor,
  type OtherDraft,
  type ToolDraft,
  toInventory,
} from './draft.ts';

// The tool inventory editor (PRODUCT.md, MVP feature 1). The owner picks tool types from the
// library by group and enters each one's capabilities, none filled in (hard rule 3). Tools the
// library does not have go under "Other tools", which build steps do not use. Saving replaces the
// whole inventory.

export function ToolsScreen() {
  const { loaded, set } = useLoad(() => send(api.api.tools.$get()), 'tools');
  return (
    <Loaded state={loaded} loading="Loading tools…">
      {(inventory) => <ToolsEditor saved={fromInventory(inventory)} onSaved={set} />}
    </Loaded>
  );
}

export function ToolsEditor(props: {
  saved: InventoryDraft;
  onSaved?: (inventory: Parameters<typeof fromInventory>[0]) => void;
}) {
  const [draft, setDraft] = useState(props.saved);
  const [issues, setIssues] = useState<FieldIssue[]>([]);
  const [save, setSave] = useState<SaveState>({ state: 'idle' });
  useEffect(() => setDraft(props.saved), [props.saved]);

  const change = (next: (d: InventoryDraft) => InventoryDraft) => {
    setDraft(next);
    setSave({ state: 'idle' });
  };
  const editTool = (t: number, path: string, text: string) =>
    change((d) => ({
      ...d,
      tools: d.tools.map((tool, i) =>
        i === t ? { ...tool, values: { ...tool.values, [path]: text } } : tool,
      ),
    }));
  const editOther = (o: number, edit: Partial<OtherDraft>) =>
    change((d) => ({
      ...d,
      other: d.other.map((x, i) => (i === o ? { ...x, ...edit } : x)),
    }));

  const submit = async () => {
    const checked = toInventory(draft);
    setIssues(checked.ok ? [] : checked.issues);
    if (!checked.ok) return;
    setSave({ state: 'saving' });
    const result = await send(api.api.tools.$put({ json: checked.inventory }));
    if (result.ok) {
      setSave({ state: 'saved' });
      props.onSaved?.(result.value);
    } else {
      if (result.error.kind === 'invalid') setIssues(result.error.issues);
      setSave({ state: 'failed', failure: failureOf(result.error) });
    }
  };

  const owned = new Set(draft.tools.map((t) => t.toolTypeId));

  return (
    <Stack>
      <ScreenHeader
        title="Tools"
        lede="The tool types you own. Build steps choose a method for each cut and joint from these, so enter each tool's details from its manual or by measuring it."
      />
      <ErrorSummary items={summaryItems(issues)} />

      <Stack as="section">
        <h2>Your tools</h2>
        {draft.tools.length === 0 && (
          <Text>No tools yet. Add the tool types you own from the library below.</Text>
        )}
        {TOOL_GROUPS.map((group) => {
          const inGroup = draft.tools
            .map((tool, t) => ({ tool, t }))
            .filter(({ tool }) => findToolType(tool.toolTypeId)?.group === group);
          if (inGroup.length === 0) return null;
          return (
            <Stack key={group} gap="s">
              <h3>{TOOL_GROUP_LABELS[group]}</h3>
              {inGroup.map(({ tool, t }) => (
                <ToolCard
                  key={tool.toolTypeId}
                  tool={tool}
                  index={t}
                  issues={issues}
                  onChange={(path, text) => editTool(t, path, text)}
                  onRemove={() =>
                    change((d) => ({ ...d, tools: d.tools.filter((_, i) => i !== t) }))
                  }
                />
              ))}
            </Stack>
          );
        })}
      </Stack>

      <Stack as="section">
        <h2>Other tools</h2>
        <Text tone="muted">
          Tools the library does not have. Kerf keeps them here, but build steps do not use them.
        </Text>
        {draft.other.map((other, o) => (
          <OtherCard
            // biome-ignore lint/suspicious/noArrayIndexKey: other tools are edited in place by position; names can be blank or repeated while typing.
            key={o}
            other={other}
            index={o}
            issues={issues}
            onChange={(edit) => editOther(o, edit)}
            onRemove={() => change((d) => ({ ...d, other: d.other.filter((_, i) => i !== o) }))}
          />
        ))}
        <Cluster>
          <Button
            variant="secondary"
            onClick={() => change((d) => ({ ...d, other: [...d.other, { name: '', note: '' }] }))}
          >
            Add another tool
          </Button>
        </Cluster>
      </Stack>

      <Stack as="section">
        <h2>Add from the library</h2>
        {TOOL_GROUPS.map((group) => {
          const types = TOOL_TYPES.filter((t) => t.group === group && !owned.has(t.id));
          if (types.length === 0) return null;
          return (
            <Stack key={group} gap="xs">
              <h3>{TOOL_GROUP_LABELS[group]}</h3>
              <Cluster gap="xs">
                {types.map((type) => (
                  <Button
                    key={type.id}
                    variant="secondary"
                    onClick={() => change((d) => addTool(d, type.id))}
                  >
                    {`Add ${type.name.toLowerCase()}`}
                  </Button>
                ))}
              </Cluster>
            </Stack>
          );
        })}
      </Stack>

      <Cluster>
        <Button busy={save.state === 'saving'} busyLabel="Saving…" onClick={() => void submit()}>
          Save tools
        </Button>
      </Cluster>
      {save.state === 'saved' && <StatusLine>Saved.</StatusLine>}
      {save.state === 'failed' && issues.length === 0 && <SaveFailed failure={save.failure} />}
    </Stack>
  );
}

/** The control an issue's path points at, such as a capability or an other tool's name. */
export function controlId(path: string): string {
  return `tool-${path.replace(/\./g, '-')}`;
}

function summaryItems(issues: readonly FieldIssue[]): SummaryItem[] {
  return issues.map((i) => ({ field: controlId(i.field ?? ''), message: i.message }));
}

function ToolCard(props: {
  tool: ToolDraft;
  index: number;
  issues: FieldIssue[];
  onChange: (path: string, text: string) => void;
  onRemove: () => void;
}) {
  const type = findToolType(props.tool.toolTypeId);
  // The API accepts only library tools, so every saved tool is found.
  if (!type) return null;
  const fields = capabilityForm(type).fields;
  const at = `tools.${props.index}.capabilities`;
  return (
    <Card as="section">
      <Stack gap="s">
        <h4>{type.name}</h4>
        {fields.length > 0 && (
          <Grid min="16rem" gap="s">
            {fields.map((field) => (
              <FieldInput
                key={field.path}
                id={controlId(`${at}.${field.path}`)}
                field={field}
                text={props.tool.values[field.path] ?? ''}
                issue={issueFor(props.issues, `${at}.${field.path}`)}
                onChange={(text) => props.onChange(field.path, text)}
                needed
              />
            ))}
          </Grid>
        )}
        <Cluster>
          <Button variant="link" onClick={props.onRemove}>
            {`Remove ${type.name.toLowerCase()}`}
          </Button>
        </Cluster>
      </Stack>
    </Card>
  );
}

function OtherCard(props: {
  other: OtherDraft;
  index: number;
  issues: FieldIssue[];
  onChange: (edit: Partial<OtherDraft>) => void;
  onRemove: () => void;
}) {
  const at = `other.${props.index}`;
  return (
    <Card as="section">
      <Stack gap="s">
        <Grid min="16rem" gap="s">
          <Field
            id={controlId(`${at}.name`)}
            label="Name"
            error={issueFor(props.issues, `${at}.name`)}
          >
            {(c) => (
              <TextInput
                {...c}
                value={props.other.name}
                onChange={(name) => props.onChange({ name })}
              />
            )}
          </Field>
          <Field
            id={controlId(`${at}.note`)}
            label="Note"
            hint="Optional."
            error={issueFor(props.issues, `${at}.note`)}
          >
            {(c) => (
              <TextInput
                {...c}
                value={props.other.note}
                onChange={(note) => props.onChange({ note })}
              />
            )}
          </Field>
        </Grid>
        <Cluster>
          <Button variant="link" onClick={props.onRemove}>
            {`Remove ${props.other.name.trim() || 'this tool'}`}
          </Button>
        </Cluster>
      </Stack>
    </Card>
  );
}
