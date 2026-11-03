import { findTemplate, type SuggestedItem, suggestedItems } from '@kerf/core';
import { useMemo, useState } from 'react';
import { api, describeError, send } from './api.ts';
import { projectStore } from './projectStore.ts';
import type { Project } from './types.ts';

// Suggested values ticked in the structural review (#417). A tick confirms the value on the server,
// against the revision the plan on screen was made with (0018), and changes no number, so the
// plan's revision and status stay as they are. Sent at once, not queued for later like Shopping's
// ticks: confirming is done at a desk with the plan open, not in the garage.

export interface Suggested {
  /** Each suggestion the project holds, in the form's order. */
  items: SuggestedItem[];
  /** Keys of the items whose change has not reached the server yet. */
  sending: ReadonlySet<string>;
  /** Why the last change did not go through, in words. */
  problem: string | null;
  set: (item: SuggestedItem, confirmed: boolean) => void;
}

export function useSuggested(project: Project, onChange?: (project: Project) => void): Suggested {
  const [sending, setSending] = useState<ReadonlySet<string>>(new Set());
  const [problem, setProblem] = useState<string | null>(null);
  const items = useMemo(() => {
    const template = findTemplate(project.templateId);
    return template && project.snapshot ? suggestedItems(template.form, project.snapshot) : [];
  }, [project]);
  const set = async (item: SuggestedItem, confirmed: boolean) => {
    const { snapshot } = project;
    if (!snapshot) return;
    setSending((s) => new Set([...s, item.key]));
    setProblem(null);
    const result = await send(
      api.api.projects[':id'].suggested.$patch({
        param: { id: project.id },
        json: {
          revision: project.revision,
          changes: [{ from: item.from, path: item.path, confirmed }],
        },
      }),
    );
    setSending((s) => new Set([...s].filter((k) => k !== item.key)));
    if (result.ok) {
      const next = { ...project, snapshot: { ...snapshot, suggested: result.value.suggested } };
      projectStore.set(next);
      onChange?.(next);
    } else if (result.error.kind === 'stale') {
      setProblem('Changed on another device. Reload to see the newer plan, then tick it again.');
    } else {
      setProblem(`Not saved. ${describeError(result.error)}`);
    }
  };
  return {
    items,
    sending,
    problem,
    set: (item, confirmed) => void set(item, confirmed),
  };
}
