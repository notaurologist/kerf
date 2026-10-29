import { useEffect, useState } from 'react';
import { api, describeError, type FieldIssue, send } from '../../lib/api.ts';
import { useLoad } from '../../lib/useLoad.ts';
import {
  Button,
  Card,
  Cluster,
  Code,
  ErrorSummary,
  Field,
  Loading,
  Notice,
  Select,
  Stack,
  StatusLine,
  type SummaryItem,
  Switcher,
  Text,
  TextInput,
} from '../../ui/index.ts';
import {
  type CapabilityDraft,
  type CapabilityKind,
  emptyCapability,
  emptyTool,
  fromInventory,
  issueFor,
  type ToolDraft,
  toInventory,
} from './draft.ts';

// The tool inventory editor (PRODUCT.md, MVP feature 1). Saving replaces the whole list.

export function ToolsScreen() {
  const { loaded, set } = useLoad(() => send(api.api.tools.$get()), 'tools');
  if (loaded.state === 'loading') return <Loading>Loading tools…</Loading>;
  if (loaded.state === 'error') return <Notice>{describeError(loaded.error)}</Notice>;
  return <ToolsEditor saved={fromInventory(loaded.value)} onSaved={set} />;
}

type SaveState =
  | { state: 'idle' }
  | { state: 'saving' }
  | { state: 'saved' }
  | { state: 'failed'; message: string };

export function ToolsEditor(props: {
  saved: ToolDraft[];
  onSaved?: (inventory: Parameters<typeof fromInventory>[0]) => void;
}) {
  const [tools, setTools] = useState(props.saved);
  const [issues, setIssues] = useState<FieldIssue[]>([]);
  const [save, setSave] = useState<SaveState>({ state: 'idle' });
  useEffect(() => setTools(props.saved), [props.saved]);

  const edit = (t: number, change: (tool: ToolDraft) => ToolDraft) => {
    setTools((list) => list.map((tool, i) => (i === t ? change(tool) : tool)));
    setSave({ state: 'idle' });
  };
  const editCapability = (t: number, c: number, change: Partial<CapabilityDraft>) =>
    edit(t, (tool) => ({
      ...tool,
      capabilities: tool.capabilities.map((cap, i) => (i === c ? { ...cap, ...change } : cap)),
    }));

  const submit = async () => {
    const checked = toInventory(tools);
    setIssues(checked.ok ? [] : checked.issues);
    if (!checked.ok) return;
    setSave({ state: 'saving' });
    const result = await send(api.api.tools.$put({ json: checked.inventory }));
    if (result.ok) {
      setSave({ state: 'saved' });
      props.onSaved?.(result.value);
    } else {
      if (result.error.kind === 'invalid') setIssues(result.error.issues);
      setSave({ state: 'failed', message: describeError(result.error) });
    }
  };

  return (
    <Stack>
      <h1>Tools</h1>
      <Text tone="muted">
        The tool types you own, with capabilities that matter for choosing methods, such as whether
        a saw bevels. Use generic names like <Code>circular-saw</Code> or <Code>drill-driver</Code>.
        Build steps will use these to choose a method for each cut and joint.
      </Text>
      <ErrorSummary items={summaryItems(issues)} />
      {tools.length === 0 && <Text>No tools yet. Add the tool types you own.</Text>}
      <Stack>
        {tools.map((tool, t) => (
          <ToolCard
            // biome-ignore lint/suspicious/noArrayIndexKey: tools are edited in place by position; IDs can be blank or repeated while typing.
            key={t}
            tool={tool}
            index={t}
            issues={issues}
            onId={(toolTypeId) => edit(t, (x) => ({ ...x, toolTypeId }))}
            onRemove={() => setTools((list) => list.filter((_, i) => i !== t))}
            onAddCapability={() =>
              edit(t, (x) => ({ ...x, capabilities: [...x.capabilities, emptyCapability()] }))
            }
            onCapability={(c, change) => editCapability(t, c, change)}
            onRemoveCapability={(c) =>
              edit(t, (x) => ({ ...x, capabilities: x.capabilities.filter((_, i) => i !== c) }))
            }
          />
        ))}
      </Stack>
      <Cluster>
        <Button variant="secondary" onClick={() => setTools((list) => [...list, emptyTool()])}>
          Add a tool
        </Button>
        <Button busy={save.state === 'saving'} onClick={() => void submit()}>
          {save.state === 'saving' ? 'Saving…' : 'Save tools'}
        </Button>
      </Cluster>
      {save.state === 'saved' && <StatusLine>Saved.</StatusLine>}
      {save.state === 'failed' && issues.length === 0 && (
        <Notice icon="connection">
          <b>Not saved.</b> {save.message} Your changes are still here.
        </Notice>
      )}
    </Stack>
  );
}

/** The control an issue's path points at: the tool type, or a capability's name or value. */
export function controlId(path: string): string {
  return `tool-${path.replace(/\./g, '-')}`;
}

function summaryItems(issues: readonly FieldIssue[]): SummaryItem[] {
  return issues.map((i) => ({ field: controlId(i.field ?? ''), message: i.message }));
}

const YES_NO = [
  { value: 'true', label: 'Yes' },
  { value: 'false', label: 'No' },
];

const KINDS: { value: CapabilityKind; label: string }[] = [
  { value: 'yes-no', label: 'Yes or no' },
  { value: 'number', label: 'Number' },
  { value: 'text', label: 'Text' },
];

function ToolCard(props: {
  tool: ToolDraft;
  index: number;
  issues: FieldIssue[];
  onId: (id: string) => void;
  onRemove: () => void;
  onAddCapability: () => void;
  onCapability: (c: number, change: Partial<CapabilityDraft>) => void;
  onRemoveCapability: (c: number) => void;
}) {
  const at = `tools.${props.index}`;
  const idIssue = issueFor(props.issues, `${at}.toolTypeId`);
  return (
    <Card as="section">
      <Stack gap="s">
        <Field id={controlId(`${at}.toolTypeId`)} label="Tool type" error={idIssue}>
          {(c) => <TextInput {...c} value={props.tool.toolTypeId} onChange={props.onId} />}
        </Field>
        {props.tool.capabilities.length > 0 && <b>Capabilities</b>}
        {props.tool.capabilities.map((cap, c) => {
          const nameIssue = issueFor(props.issues, `${at}.capabilities.${c}.name`);
          const valueIssue = issueFor(props.issues, `${at}.capabilities.${c}.value`);
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: capabilities are edited in place by position.
            <Switcher key={c} threshold="36rem" gap="xs">
              <Field id={controlId(`${at}.capabilities.${c}.name`)} label="Name" error={nameIssue}>
                {(f) => (
                  <TextInput
                    {...f}
                    value={cap.name}
                    onChange={(name) => props.onCapability(c, { name })}
                  />
                )}
              </Field>
              <Field label="Kind">
                {(f) => (
                  <Select
                    {...f}
                    value={cap.kind}
                    options={KINDS}
                    placeholder={false}
                    onChange={(value) => {
                      const kind = value as CapabilityKind;
                      props.onCapability(c, { kind, value: kind === 'yes-no' ? 'true' : '' });
                    }}
                  />
                )}
              </Field>
              <Field
                id={controlId(`${at}.capabilities.${c}.value`)}
                label="Value"
                error={valueIssue}
              >
                {(f) =>
                  cap.kind === 'yes-no' ? (
                    <Select
                      {...f}
                      value={cap.value}
                      options={YES_NO}
                      placeholder={false}
                      onChange={(value) => props.onCapability(c, { value })}
                    />
                  ) : (
                    <TextInput
                      {...f}
                      keyboard={cap.kind === 'number' ? 'decimal' : 'text'}
                      value={cap.value}
                      onChange={(value) => props.onCapability(c, { value })}
                    />
                  )
                }
              </Field>
              <div>
                <Button variant="link" onClick={() => props.onRemoveCapability(c)}>
                  Remove
                </Button>
              </div>
            </Switcher>
          );
        })}
        <Cluster>
          <Button variant="secondary" onClick={props.onAddCapability}>
            Add a capability
          </Button>
          <Button variant="link" onClick={props.onRemove}>
            Remove this tool
          </Button>
        </Cluster>
      </Stack>
    </Card>
  );
}
