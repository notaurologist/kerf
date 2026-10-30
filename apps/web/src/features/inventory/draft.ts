import {
  buildFromForm,
  capabilityForm,
  entryProblems,
  type FormValues,
  findToolType,
  formValues,
  Inventory,
  TOOL_TYPES,
} from '@kerf/core';
import type { FieldIssue } from '../../lib/api.ts';

// The inventory as the form edits it. Capabilities are typed like any form field and read by
// core's form helpers; `toInventory` then checks the whole list with core's schema, the same one
// the API uses. An empty capability is left out, so it stays "input needed".

export interface ToolDraft {
  toolTypeId: string;
  name: string;
  /** The text typed for each capability, by capability ID. */
  values: FormValues;
}

export interface OtherDraft {
  name: string;
  note: string;
}

export interface InventoryDraft {
  tools: ToolDraft[];
  other: OtherDraft[];
}

const ORDER: ReadonlyMap<string, number> = new Map(TOOL_TYPES.map((t, i) => [t.id, i]));

/** Library order, so a tool lands in the same place however it was added. */
const byLibrary = (a: ToolDraft, b: ToolDraft) =>
  (ORDER.get(a.toolTypeId) ?? 0) - (ORDER.get(b.toolTypeId) ?? 0);

export function fromInventory(inventory: Inventory): InventoryDraft {
  return {
    tools: inventory.tools
      .map((tool) => {
        const type = findToolType(tool.toolTypeId);
        const values = type ? formValues([capabilityForm(type)], tool.capabilities) : {};
        return { toolTypeId: tool.toolTypeId, name: tool.name ?? '', values };
      })
      .sort(byLibrary),
    other: inventory.other.map((o) => ({ ...o })),
  };
}

export const emptyInventory = (): InventoryDraft => ({ tools: [], other: [] });

/** Adds a library tool with nothing entered. */
export function addTool(draft: InventoryDraft, toolTypeId: string): InventoryDraft {
  if (draft.tools.some((t) => t.toolTypeId === toolTypeId)) return draft;
  return addAnother(draft, toolTypeId);
}

export function addAnother(draft: InventoryDraft, toolTypeId: string): InventoryDraft {
  const tool = { toolTypeId, name: '', values: {} };
  return { ...draft, tools: [...draft.tools, tool].sort(byLibrary) };
}

export function restoreTools(draft: InventoryDraft, tools: readonly ToolDraft[]): InventoryDraft {
  return { ...draft, tools: [...draft.tools, ...tools].sort(byLibrary) };
}

export function removeAt(draft: InventoryDraft, index: number): InventoryDraft {
  return { ...draft, tools: draft.tools.filter((_, i) => i !== index) };
}

export function removeTool(draft: InventoryDraft, toolTypeId: string): InventoryDraft {
  return { ...draft, tools: draft.tools.filter((t) => t.toolTypeId !== toolTypeId) };
}

const nameKey = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, ' ');

/** The library type an other tool's name names, as typed or as an old ID like `table-saw`. */
export function libraryMatch(name: string) {
  const key = nameKey(name);
  return key ? TOOL_TYPES.find((t) => nameKey(t.name) === key || nameKey(t.id) === key) : undefined;
}

export function moveToLibrary(draft: InventoryDraft, other: number, toolTypeId: string) {
  const moved = addTool(draft, toolTypeId);
  return { ...moved, other: moved.other.filter((_, i) => i !== other) };
}

export function matchingTypes(query: string) {
  const q = query.trim().toLowerCase();
  return q ? TOOL_TYPES.filter((t) => t.name.toLowerCase().includes(q)) : TOOL_TYPES;
}

export function detailsNeeded(tool: ToolDraft): number {
  const type = findToolType(tool.toolTypeId);
  if (!type) return 0;
  return capabilityForm(type).fields.filter((f) => !(tool.values[f.path] ?? '').trim()).length;
}

/** The inventory to send, or the problems that stop it, by field (`tools.0.capabilities.depthOfCut`). */
export function toInventory(
  draft: InventoryDraft,
): { ok: true; inventory: Inventory } | { ok: false; issues: FieldIssue[] } {
  const issues: FieldIssue[] = [];
  const tools = draft.tools.map((tool, t) => {
    const type = findToolType(tool.toolTypeId);
    if (!type) return { toolTypeId: tool.toolTypeId, capabilities: {} };
    const form = [capabilityForm(type)];
    const capabilities = buildFromForm(form, tool.values);
    for (const p of entryProblems(form, tool.values)) {
      issues.push({ field: `tools.${t}.capabilities.${p.field}`, message: p.message });
      // Reported above with what to type; left out so core checks the rest.
      delete capabilities[p.field];
    }
    const name = tool.name.trim();
    return { toolTypeId: tool.toolTypeId, ...(name ? { name } : {}), capabilities };
  });
  const other = draft.other.map((o) => ({ name: o.name.trim(), note: o.note.trim() }));
  const parsed = Inventory.safeParse({ tools, other });
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = issue.path.map(String).join('.');
      issues.push({ field, message: issue.message });
    }
  }
  if (issues.length > 0 || !parsed.success) return { ok: false, issues };
  return { ok: true, inventory: parsed.data };
}

export function issueFor(issues: readonly FieldIssue[], field: string): string | undefined {
  return issues.find((i) => i.field === field)?.message;
}
