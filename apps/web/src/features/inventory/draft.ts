import { Inventory } from '@kerf/core';
import type { FieldIssue } from '../../lib/api.ts';

// The inventory as the form edits it. Values stay as typed until saving, when `toInventory`
// checks them with core's schema, the same one the API uses.

export type CapabilityKind = 'yes-no' | 'number' | 'text';

export interface CapabilityDraft {
  name: string;
  kind: CapabilityKind;
  /** 'true' or 'false' for yes/no; the typed text otherwise. */
  value: string;
}

export interface ToolDraft {
  toolTypeId: string;
  capabilities: CapabilityDraft[];
}

export function fromInventory(inventory: Inventory): ToolDraft[] {
  return inventory.tools.map((tool) => ({
    toolTypeId: tool.toolTypeId,
    capabilities: Object.entries(tool.capabilities).map(([name, value]) => ({
      name,
      kind: typeof value === 'boolean' ? 'yes-no' : typeof value === 'number' ? 'number' : 'text',
      value: String(value),
    })),
  }));
}

export const emptyTool = (): ToolDraft => ({ toolTypeId: '', capabilities: [] });

export const emptyCapability = (): CapabilityDraft => ({ name: '', kind: 'yes-no', value: 'true' });

/** The inventory to send, or the problems that stop it, by field (`tools.0.toolTypeId`). */
export function toInventory(
  drafts: readonly ToolDraft[],
): { ok: true; inventory: Inventory } | { ok: false; issues: FieldIssue[] } {
  const issues: FieldIssue[] = [];
  const tools = drafts.map((draft, t) => {
    const toolTypeId = draft.toolTypeId.trim();
    if (drafts.slice(0, t).some((d) => d.toolTypeId.trim() === toolTypeId)) {
      issues.push({ field: `tools.${t}.toolTypeId`, message: 'is already in the list' });
    }
    const capabilities: Record<string, boolean | number | string> = {};
    draft.capabilities.forEach((c, i) => {
      const at = `tools.${t}.capabilities.${i}`;
      const name = c.name.trim();
      if (!name) issues.push({ field: `${at}.name`, message: 'needs a name' });
      else if (name in capabilities)
        issues.push({ field: `${at}.name`, message: 'is listed twice' });
      if (c.kind === 'yes-no') capabilities[name] = c.value === 'true';
      else if (c.kind === 'number') {
        const n = Number(c.value);
        if (c.value.trim() === '' || !Number.isFinite(n)) {
          issues.push({ field: `${at}.value`, message: 'must be a number' });
        }
        capabilities[name] = n;
      } else capabilities[name] = c.value.trim();
    });
    return { toolTypeId, capabilities };
  });
  const parsed = Inventory.safeParse({ tools });
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = issue.path.map(String).join('.');
      // Duplicates are already pointed at the second entry above.
      if (field !== 'tools') issues.push({ field, message: issue.message });
    }
  }
  if (issues.length > 0 || !parsed.success) return { ok: false, issues };
  return { ok: true, inventory: parsed.data };
}

export function issueFor(issues: readonly FieldIssue[], field: string): string | undefined {
  return issues.find((i) => i.field === field)?.message;
}
