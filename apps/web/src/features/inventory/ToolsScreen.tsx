import { useEffect, useState } from 'react';
import { Notice } from '../../components/Shell.tsx';
import { api, describeError, type FieldIssue, send } from '../../lib/api.ts';
import { useLoad } from '../../lib/useLoad.ts';
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
  if (loaded.state === 'loading') return <Notice>Loading tools…</Notice>;
  if (loaded.state === 'error') return <Notice tone="error">{describeError(loaded.error)}</Notice>;
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
    <>
      <h1>Tools</h1>
      <p className="muted">
        The tool types you own, with capabilities that matter for choosing methods, such as whether
        a saw bevels. Use generic names like <code>circular-saw</code> or <code>drill-driver</code>.
        Build steps will check these against the knowledge base once it exists.
      </p>
      {tools.length === 0 && <Notice>No tools yet.</Notice>}
      <div className="stack">
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
      </div>
      <div className="row" style={{ marginTop: '1rem' }}>
        <button type="button" onClick={() => setTools((list) => [...list, emptyTool()])}>
          Add a tool
        </button>
        <button
          type="button"
          className="primary"
          onClick={() => void submit()}
          disabled={save.state === 'saving'}
        >
          {save.state === 'saving' ? 'Saving…' : 'Save tools'}
        </button>
        {save.state === 'saved' && <span className="muted">Saved.</span>}
      </div>
      {issues.length > 0 && save.state !== 'failed' && (
        <Notice tone="error">Fix the marked fields, then save again.</Notice>
      )}
      {save.state === 'failed' && <Notice tone="error">{save.message}</Notice>}
    </>
  );
}

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
    <section className="card stack">
      <label className="field">
        <span>Tool type</span>
        <input
          value={props.tool.toolTypeId}
          onChange={(e) => props.onId(e.target.value)}
          placeholder="circular-saw"
          aria-invalid={idIssue ? true : undefined}
          autoCapitalize="none"
          spellCheck={false}
        />
        {idIssue && <span className="error">{idIssue}</span>}
      </label>
      {props.tool.capabilities.length > 0 && <strong>Capabilities</strong>}
      {props.tool.capabilities.map((cap, c) => {
        const nameIssue = issueFor(props.issues, `${at}.capabilities.${c}.name`);
        const valueIssue = issueFor(props.issues, `${at}.capabilities.${c}.value`);
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: capabilities are edited in place by position.
          <div className="row capability" key={c}>
            <label className="field">
              <span>Name</span>
              <input
                value={cap.name}
                onChange={(e) => props.onCapability(c, { name: e.target.value })}
                placeholder="bevels"
                aria-invalid={nameIssue ? true : undefined}
                autoCapitalize="none"
                spellCheck={false}
              />
              {nameIssue && <span className="error">{nameIssue}</span>}
            </label>
            <label className="field">
              <span>Kind</span>
              <select
                value={cap.kind}
                onChange={(e) => {
                  const kind = e.target.value as CapabilityKind;
                  props.onCapability(c, { kind, value: kind === 'yes-no' ? 'true' : '' });
                }}
              >
                {KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
            </label>
            {cap.kind === 'yes-no' ? (
              <label className="field">
                <span>Value</span>
                <select
                  value={cap.value}
                  onChange={(e) => props.onCapability(c, { value: e.target.value })}
                >
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </label>
            ) : (
              <label className="field">
                <span>Value</span>
                <input
                  value={cap.value}
                  inputMode={cap.kind === 'number' ? 'decimal' : undefined}
                  onChange={(e) => props.onCapability(c, { value: e.target.value })}
                  aria-invalid={valueIssue ? true : undefined}
                />
                {valueIssue && <span className="error">{valueIssue}</span>}
              </label>
            )}
            <button type="button" className="link" onClick={() => props.onRemoveCapability(c)}>
              Remove
            </button>
          </div>
        );
      })}
      <div className="row">
        <button type="button" onClick={props.onAddCapability}>
          Add a capability
        </button>
        <button type="button" className="link" onClick={props.onRemove}>
          Remove this tool
        </button>
      </div>
    </section>
  );
}
