import { z } from 'zod';
import { type CapabilityField, findToolType, type ToolType } from '../knowledge/tools.ts';
import type { FormSection } from '../model/form.ts';
import { formatAngle } from '../units/angle.ts';
import { formatLength } from '../units/length.ts';

// The tool inventory (PRODUCT.md, MVP feature 1; DOMAIN.md, Tool). The API stores it and the
// web app edits it, and both check it with these schemas. Tools come from the tool-type library
// (knowledge/tools.ts) with the capabilities it defines; a capability left out is "input needed"
// (hard rule 3). Only library tools are kept: methods can use nothing else (#363).

export const CapabilityValue = z.union([z.boolean(), z.number()]);
export type CapabilityValue = z.infer<typeof CapabilityValue>;

/** Why a value does not fit its capability, or undefined when it fits. */
function capabilityProblem(field: CapabilityField, value: unknown): string | undefined {
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
    toolTypeId: z.string().max(80),
    /** Tells two tools of one type apart, such as "Long clamps"; build steps say it. */
    name: z.string().trim().max(80).optional(),
    /** By capability ID. A capability not entered is left out. */
    capabilities: z.record(z.string().max(80), CapabilityValue),
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

export const Inventory = z.object({
  tools: z
    .array(Tool)
    .max(200)
    .superRefine((list, ctx) => {
      list.forEach((tool, i) => {
        const same = list.filter((t) => t.toolTypeId === tool.toolTypeId);
        if (same.length < 2) return;
        const type = findToolType(tool.toolTypeId)?.name.toLowerCase() ?? 'tool';
        if (!tool.name) {
          ctx.addIssue({
            code: 'custom',
            path: [i, 'name'],
            message: `Name each one, so build steps can say which ${type} to use.`,
          });
        } else if (
          same.filter((t) => t.name?.toLowerCase() === tool.name?.toLowerCase()).length > 1
        ) {
          ctx.addIssue({
            code: 'custom',
            path: [i, 'name'],
            message: 'Give each one a different name.',
          });
        }
      });
    }),
});
export type Inventory = z.infer<typeof Inventory>;

/**
 * The inventory with the revision it was read at, which a save must send back (#426). A save made
 * on an older list is refused, so two devices cannot overwrite each other.
 */
export const RevisedInventory = Inventory.extend({ revision: z.number().int().positive() });
export type RevisedInventory = z.infer<typeof RevisedInventory>;

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
  name?: string;
  capabilities: unknown;
}

/**
 * Reads stored tool rows into the current shape. A row whose ID is a library tool keeps the
 * capabilities that fit it; a row whose ID is not, and any capability that does not fit, is left
 * out, since no method could use it (#363).
 */
export function readStoredTools(rows: readonly StoredTool[]): Tool[] {
  return rows.flatMap((row) => {
    const type = findToolType(row.toolTypeId);
    if (!type) return [];
    const entries = Object.entries(
      typeof row.capabilities === 'object' && row.capabilities !== null ? row.capabilities : {},
    );
    const capabilities: Record<string, CapabilityValue> = {};
    for (const [id, value] of entries) {
      const field = type.capabilities.find((c) => c.id === id);
      if (field && !capabilityProblem(field, value)) capabilities[id] = value as CapabilityValue;
    }
    return [{ toolTypeId: type.id, ...(row.name ? { name: row.name } : {}), capabilities }];
  });
}
