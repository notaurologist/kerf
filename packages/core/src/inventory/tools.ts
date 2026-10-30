import { z } from 'zod';
import { type CapabilityField, findToolType, type ToolType } from '../knowledge/tools.ts';
import type { FormSection } from '../templates/form.ts';
import { formatAngle } from '../units/angle.ts';
import { formatLength } from '../units/length.ts';

// The tool inventory (PRODUCT.md, MVP feature 1; DOMAIN.md, Tool). The API stores it and the
// web app edits it, and both check it with these schemas. Tools come from the tool-type library
// (knowledge/tools.ts) with the capabilities it defines; a capability left out is "input needed"
// (hard rule 3). Tools the library does not have go in `other`, by name, and methods ignore them.

export const CapabilityValue = z.union([z.boolean(), z.number()]);
export type CapabilityValue = z.infer<typeof CapabilityValue>;

/** Why a value does not fit its capability, or undefined when it fits. */
export function capabilityProblem(field: CapabilityField, value: unknown): string | undefined {
  if (field.kind === 'yes-no') return typeof value === 'boolean' ? undefined : 'Choose yes or no.';
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Enter a number.';
  if (field.kind === 'integer' && !Number.isInteger(value)) return 'Enter a whole number.';
  const { min, max } = field;
  if ((min === undefined || value >= min) && (max === undefined || value <= max)) return undefined;
  const range =
    min !== undefined && max !== undefined
      ? `from ${inUnits(field, min)} to ${inUnits(field, max)}`
      : min !== undefined
        ? `at least ${inUnits(field, min)}`
        : `at most ${inUnits(field, max ?? 0)}`;
  return `${field.label} must be ${range}.`;
}

function inUnits(field: CapabilityField, n: number): string {
  if (field.kind === 'length') return formatLength(n, 'feet-inches');
  if (field.kind === 'angle') return formatAngle(n);
  return field.unit ? `${n} ${field.unit}` : String(n);
}

export const Tool = z
  .object({
    toolTypeId: z.string(),
    /** By capability ID. A capability not entered is left out. */
    capabilities: z.record(z.string(), CapabilityValue),
  })
  .superRefine((tool, ctx) => {
    const type = findToolType(tool.toolTypeId);
    if (!type) {
      ctx.addIssue({
        code: 'custom',
        path: ['toolTypeId'],
        message: 'is not a tool type in the library',
      });
      return;
    }
    for (const [id, value] of Object.entries(tool.capabilities)) {
      const field = type.capabilities.find((c) => c.id === id);
      const message = field
        ? capabilityProblem(field, value)
        : `is not a capability of a ${type.name.toLowerCase()}`;
      if (message) ctx.addIssue({ code: 'custom', path: ['capabilities', id], message });
    }
  });
export type Tool = z.infer<typeof Tool>;

/** A tool the library does not have. Build steps do not use it. */
export const OtherTool = z.object({
  name: z.string().trim().min(1, 'Enter a name.').max(80),
  note: z.string().trim().max(500),
});
export type OtherTool = z.infer<typeof OtherTool>;

export const Inventory = z.object({
  tools: z
    .array(Tool)
    .refine(
      (list) => new Set(list.map((t) => t.toolTypeId)).size === list.length,
      'lists a tool type more than once',
    ),
  other: z.array(OtherTool),
});
export type Inventory = z.infer<typeof Inventory>;

/** The capabilities of a tool not yet entered: each is "input needed". */
export function missingCapabilities(tool: Tool): CapabilityField[] {
  return (
    findToolType(tool.toolTypeId)?.capabilities.filter((c) => !(c.id in tool.capabilities)) ?? []
  );
}

/** A tool type's capabilities as a form section, so the web app enters them like any field. */
export function capabilityForm(type: ToolType): FormSection {
  return {
    title: type.name,
    fields: type.capabilities.map((c) => ({
      path: c.id,
      label: c.label,
      kind: c.kind,
      unit: c.unit,
      help: `${c.help} Read it from: ${lowerFirst(c.readFrom)}`,
    })),
  };
}

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** A tool row as stored before the library (M3 to M5): any lowercase ID and free capabilities. */
export interface StoredTool {
  toolTypeId: string;
  capabilities: unknown;
}

/**
 * Reads stored tool rows into the current shape, losing nothing. A row whose ID is a library
 * tool keeps the capabilities that fit it; a row whose ID is not, and any capability that does
 * not fit, moves to `other` under the old ID, with the old values written in its note.
 */
export function readStoredTools(rows: readonly StoredTool[]): {
  tools: Tool[];
  moved: OtherTool[];
} {
  const tools: Tool[] = [];
  const moved: OtherTool[] = [];
  for (const row of rows) {
    const entries = Object.entries(
      typeof row.capabilities === 'object' && row.capabilities !== null ? row.capabilities : {},
    );
    const type = findToolType(row.toolTypeId);
    if (!type) {
      moved.push(movedTool(row.toolTypeId, 'Not a tool type in the library.', entries));
      continue;
    }
    const capabilities: Record<string, CapabilityValue> = {};
    const left: [string, unknown][] = [];
    for (const [id, value] of entries) {
      const field = type.capabilities.find((c) => c.id === id);
      if (field && !capabilityProblem(field, value)) capabilities[id] = value as CapabilityValue;
      else left.push([id, value]);
    }
    tools.push({ toolTypeId: type.id, capabilities });
    if (left.length > 0) {
      moved.push(
        movedTool(row.toolTypeId, `Details the ${type.name.toLowerCase()} entry cannot use.`, left),
      );
    }
  }
  return { tools, moved };
}

function movedTool(name: string, why: string, entries: [string, unknown][]): OtherTool {
  const values = entries.map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join('; ');
  const note = `Moved here from your tool list. ${why}${values ? ` Earlier values: ${values}.` : ''}`;
  return { name, note: note.slice(0, 500) };
}
