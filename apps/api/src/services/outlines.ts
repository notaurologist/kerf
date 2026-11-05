import {
  type ProgressOutline,
  type ProjectSnapshot,
  progressOutline,
  readSnapshot,
  type TemplateDefinition,
} from '@kerf/core';

// Each project's progress outline (#636), stored beside its snapshot so the projects list counts
// progress without reading the snapshot. Derived data: written with every snapshot under the key of
// the code that made it, and read again from the snapshot when the row's revision or that key has
// moved on, since a release can change how an older plan reads (0014).

/** The outline of a snapshot in the template's current shape. Throws if it cannot be counted. */
export const outlineOfSnapshot = (template: TemplateDefinition, snapshot: ProjectSnapshot) =>
  progressOutline(template, template.storedOutputs.parse(snapshot.outputs));

/**
 * A stored row's outline, read from its snapshot through the upgrades; null when the snapshot
 * cannot be read or counted, which is logged.
 */
export function outlineOf(
  templates: readonly TemplateDefinition[],
  row: { id: string; templateId: string; snapshot: unknown },
): ProgressOutline | null {
  const template = templates.find((t) => t.id === row.templateId);
  if (!template) return null;
  const read = readSnapshot(templates, row.snapshot);
  if (!read.ok) return null;
  try {
    return outlineOfSnapshot(template, read.snapshot);
  } catch (error) {
    console.error(`project ${row.id}: progress could not be counted`, error);
    return null;
  }
}
