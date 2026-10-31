import { capabilityForm, findToolType, TOOL_GROUP_LABELS, TOOL_GROUPS } from '@kerf/core';
import { useEffect, useState } from 'react';
import { api, type FieldIssue, failureOf, type SaveState, send } from '../../lib/api.ts';
import { FieldInput } from '../../lib/FieldInput.tsx';
import { Loaded } from '../../lib/Loaded.tsx';
import { href } from '../../lib/route.ts';
import { useLoad } from '../../lib/useLoad.ts';
import {
  Button,
  Card,
  Cluster,
  Disclosure,
  ErrorSummary,
  Field,
  FieldGroup,
  Grid,
  InputNeeded,
  SaveFailed,
  ScreenHeader,
  Stack,
  StatusLine,
  type SummaryItem,
  Text,
  TextInput,
  Tick,
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
  libraryMatch,
  matchingTypes,
  moveToLibrary,
  type OtherDraft,
  removeAt,
  removeTool,
  restoreTools,
  type ToolDraft,
  toInventory,
} from './draft.ts';

// The tool inventory editor (PRODUCT.md, MVP feature 1). The owner ticks the tool types they own,
// then enters each one's capabilities when ready, none filled in (hard rule 3). Tools the library
// does not have go under "Other tools", which build steps do not use. Saving replaces the whole
// inventory.

export function ToolsScreen() {
  const { loaded, set, reload } = useLoad(() => send(api.api.tools.$get()), 'tools');
  return (
    <Loaded state={loaded} loading="Loading tools…" onRetry={reload} title="Tools">
      {(inventory) => <ToolsEditor saved={fromInventory(inventory)} onSaved={set} />}
    </Loaded>
  );
}

export function ToolsEditor(props: {
  saved: InventoryDraft;
  onSaved?: (inventory: Parameters<typeof fromInventory>[0]) => void;
}) {
  const { draft, setDraft, dialog } = useDraft(props.saved);
  const { issues, attempt, report } = useFormIssues<FieldIssue[]>([]);
  const [save, setSave] = useState<SaveState>({ state: 'idle' });
  const [query, setQuery] = useState('');
  // Tools unticked by mistake come back, with what was typed, when ticked again.
  const [unticked, setUnticked] = useState<Record<string, ToolDraft[]>>({});
  useEffect(() => setDraft(props.saved), [props.saved, setDraft]);

  const change = (next: (d: InventoryDraft) => InventoryDraft) => {
    setDraft(next);
    setSave({ state: 'idle' });
  };
  const editTool = (t: number, edit: (tool: ToolDraft) => ToolDraft) =>
    change((d) => ({ ...d, tools: d.tools.map((tool, i) => (i === t ? edit(tool) : tool)) }));
  const editOther = (o: number, edit: Partial<OtherDraft>) =>
    change((d) => ({
      ...d,
      other: d.other.map((x, i) => (i === o ? { ...x, ...edit } : x)),
    }));

  const submit = async () => {
    const checked = toInventory(draft);
    report(checked.ok ? [] : checked.issues, !checked.ok);
    if (!checked.ok) return;
    setSave({ state: 'saving' });
    const result = await send(api.api.tools.$put({ json: checked.inventory }));
    if (result.ok) {
      setSave({ state: 'saved' });
      props.onSaved?.(result.value);
    } else {
      if (result.error.kind === 'invalid') report(result.error.issues, true);
      setSave({ state: 'failed', failure: failureOf(result.error) });
    }
  };

  const owned = new Set(draft.tools.map((t) => t.toolTypeId));
  const ofType = (toolTypeId: string) => draft.tools.filter((t) => t.toolTypeId === toolTypeId);
  const setOwned = (toolTypeId: string, own: boolean) => {
    if (!own) setUnticked((u) => ({ ...u, [toolTypeId]: ofType(toolTypeId) }));
    const restore = unticked[toolTypeId];
    change((d) => {
      if (!own) return removeTool(d, toolTypeId);
      return restore ? restoreTools(d, restore) : addTool(d, toolTypeId);
    });
  };
  const matching = matchingTypes(query);
  const withDetails = draft.tools
    .map((tool, t) => ({ tool, t, repeated: ofType(tool.toolTypeId).length > 1 }))
    .filter(
      ({ tool, repeated }) =>
        repeated || (findToolType(tool.toolTypeId)?.capabilities.length ?? 0) > 0,
    );

  return (
    <Stack>
      <ScreenHeader
        title="Tools"
        lede="The tool types you own. Build steps choose a method for each cut and joint from these."
      />
      <ErrorSummary items={summaryItems(issues)} attempt={attempt} />

      <Stack as="section">
        <h2>Your tools</h2>
        <Field id="tool-search" label="Find a tool">
          {(c) => <TextInput {...c} type="search" value={query} onChange={setQuery} />}
        </Field>
        {matching.length === 0 && (
          <Text>No tool in the library matches "{query.trim()}". Add it under Other tools.</Text>
        )}
        {TOOL_GROUPS.map((group) => {
          const types = matching.filter((t) => t.group === group);
          if (types.length === 0) return null;
          return (
            <FieldGroup key={group} legend={TOOL_GROUP_LABELS[group]}>
              <Grid min="14rem" gap="2xs">
                {types.map((type) => (
                  <Tick
                    key={type.id}
                    done={owned.has(type.id)}
                    onChange={(own) => setOwned(type.id, own)}
                  >
                    <ToolLabel toolTypeId={type.id}>{type.name}</ToolLabel>
                  </Tick>
                ))}
              </Grid>
            </FieldGroup>
          );
        })}
      </Stack>

      {withDetails.length > 0 && (
        <Stack as="section">
          <h2>Tool details</h2>
          <Text tone="muted">
            Build steps use these to choose between methods. Enter each from the tool's manual or by
            measuring it. One not entered is input needed.
          </Text>
          {withDetails.map(({ tool, t, repeated }) => (
            <ToolDetails
              // biome-ignore lint/suspicious/noArrayIndexKey: tools are edited in place by position; names can be blank or repeated while typing.
              key={t}
              tool={tool}
              index={t}
              repeated={repeated}
              issues={issues}
              onChange={(path, text) =>
                editTool(t, (x) => ({ ...x, values: { ...x.values, [path]: text } }))
              }
              onName={(name) => editTool(t, (x) => ({ ...x, name }))}
              onAddAnother={() => change((d) => addAnother(d, tool.toolTypeId))}
              onRemove={() => change((d) => removeAt(d, t))}
            />
          ))}
        </Stack>
      )}

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
            onMove={(toolTypeId) => change((d) => moveToLibrary(d, o, toolTypeId))}
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

      <Cluster>
        <Button busy={save.state === 'saving'} busyLabel="Saving…" onClick={() => void submit()}>
          Save tools
        </Button>
      </Cluster>
      {save.state === 'saved' && <StatusLine>Saved.</StatusLine>}
      {save.state === 'failed' && issues.length === 0 && <SaveFailed failure={save.failure} />}
      {dialog}
    </Stack>
  );
}

/** The control an issue's path points at, such as a capability or an other tool's name. */
function controlId(path: string): string {
  return `tool-${path.replace(/\./g, '-')}`;
}

function summaryItems(issues: readonly FieldIssue[]): SummaryItem[] {
  return issues.map((i) => ({ field: controlId(i.field ?? ''), message: i.message }));
}

function ToolDetails(props: {
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
  const hasIssue =
    nameIssue !== undefined ||
    fields.some((f) => issueFor(props.issues, `${at}.capabilities.${f.path}`));
  return (
    <Disclosure
      open={hasIssue || undefined}
      summary={
        <>
          <ToolLabel toolTypeId={type.id}>{name ? `${type.name}: ${name}` : type.name}</ToolLabel>{' '}
          {needed > 0 ? (
            <InputNeeded>
              {needed === 1 ? '1 detail needed' : `${needed} details needed`}
            </InputNeeded>
          ) : (
            fields.length > 0 && (
              <Text as="span" tone="muted">
                Details entered
              </Text>
            )
          )}
        </>
      }
    >
      <Stack gap="s">
        <Text tone="muted">
          {type.description} <a href={href({ screen: 'tools', tool: type.id })}>About this tool</a>
        </Text>
        <Grid min="16rem" gap="s">
          <Field
            id={controlId(`${at}.name`)}
            label="Name"
            hint="Optional unless you add another. Build steps use it to say which one."
            error={nameIssue}
          >
            {(c) => <TextInput {...c} value={props.tool.name} onChange={props.onName} />}
          </Field>
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
        <Cluster>
          <Button variant="secondary" onClick={props.onAddAnother}>
            {lower.endsWith('s') ? `Add another set of ${lower}` : `Add another ${lower}`}
          </Button>
          {props.repeated && (
            <Button variant="link" onClick={props.onRemove}>
              {`Remove ${name || 'this one'}`}
            </Button>
          )}
        </Cluster>
      </Stack>
    </Disclosure>
  );
}

function OtherCard(props: {
  other: OtherDraft;
  index: number;
  issues: FieldIssue[];
  onChange: (edit: Partial<OtherDraft>) => void;
  onRemove: () => void;
  onMove: (toolTypeId: string) => void;
}) {
  const at = `other.${props.index}`;
  const match = libraryMatch(props.other.name);
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
        {match && (
          <Text>
            {match.name} is in the library now.
            {props.other.note.trim() && ' Moving it does not keep the note.'}
          </Text>
        )}
        <Cluster>
          {match && (
            <Button variant="secondary" onClick={() => props.onMove(match.id)}>
              {`Move ${match.name.toLowerCase()} to your tools`}
            </Button>
          )}
          <Button variant="link" onClick={props.onRemove}>
            {`Remove ${props.other.name.trim() || 'this tool'}`}
          </Button>
        </Cluster>
      </Stack>
    </Card>
  );
}
