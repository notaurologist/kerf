import { createSnapshot, recordCabinet, visibleFields } from '@kerf/core';
import { describe, expect, it } from 'vitest';
import type { Project } from '../../lib/types.ts';
import { loadedDrawings, projectFrom } from '../../test/projects.ts';
import { render, renderText } from '../../test/render.tsx';
import { ModeView } from '../modes/modes.tsx';
import { startValues } from '../project-editor/ProjectEditor.tsx';
import { ProjectView } from './ProjectScreen.tsx';

// The record cabinet's worked example through the screens: the panels, wood movement, elevations,
// and the panel cut card, which only a template that makes panels reaches.

const template = recordCabinet.definition;
const example = template.examples[0];
if (!example) throw new Error('no worked example');
const made = createSnapshot(template, example.params, example.structuralInputs);
if (!made.ok) throw new Error('worked example does not generate');
const snapshot = JSON.parse(JSON.stringify(made.output)) as NonNullable<Project['snapshot']>;
const project = projectFrom(snapshot, {
  id: '6f1c2a3e-0000-4000-8000-0000000000c1',
  name: 'Record cabinet',
  templateId: 'record-cabinet',
});

describe('a record cabinet plan', () => {
  const text = renderText(<ProjectView project={project} drawings={loadedDrawings(project)} />);

  it("lists each panel's boards in the cut list", () => {
    expect(text).toContain('Panel (3/4" x 17-3/4")');
    expect(text).toContain('Ripped from 1 board of 13/16" x 5-1/2", 18-7/8" long, ripped to 3".');
    expect(text).toContain(
      'Glued up from 4 boards of 13/16" x 5-1/2", each 56" long, glued to 21-5/8" wide and ripped to 17-3/4".',
    );
  });

  it('shows the aprons’ check, the movement estimates, and the elevations', () => {
    expect(text).toContain('Deflection: Front and back aprons');
    expect(text).toContain('Wood movement');
    expect(text).toContain('Changes about 0.176 in across the grain');
    expect(text).toContain('Elevations and sections');
    expect(text).toContain('Section through the first bay');
  });
});

describe('a panel in Building mode', () => {
  const card = (step: string, part: string) =>
    renderText(
      <ModeView
        route={{ screen: 'build-part', id: project.id, step, part }}
        project={project}
        drawings={loadedDrawings(project)}
      />,
    );

  it("gives a panel's board length when its boards are cut", () => {
    const text = card('board-1', 'top');
    expect(text).toContain('Cut 1 of its boards from board 1');
    expect(text).toContain(`Each board's length 56"`);
  });

  it("gives the panel's length and width once it is glued up", () => {
    const text = card('size', 'top');
    expect(text).toContain('Make 1.');
    expect(text).toContain('Length 54"');
    expect(text).toContain('Width 17-3/4"');
  });

  it('draws the glue-up step as the boards pulled apart', () => {
    const html = render(
      <ModeView
        route={{ screen: 'build-step', id: project.id, step: 'panels' }}
        project={project}
        drawings={loadedDrawings(project)}
      />,
    );
    expect(html).toContain('Glue up 4 boards for A Top');
  });
});

describe('a record cabinet started from the worked example', () => {
  it('keeps the board stock, allowances, and joint sizes, so it saves without entering them', () => {
    const start = startValues(template, { kind: 'example', index: 0 }, null);
    if (!start.ok) throw new Error(start.message);
    // The dealer's fields are hidden while the board comes from a store.
    const shown = visibleFields(template.form.params, start.initial.params);
    const empty = shown.filter((f) => start.initial.params[f.path] === '');
    expect(empty.map((f) => f.path)).toEqual([
      'legStock.lengths.2',
      'legStock.lengths.3',
      'board.lengths.3',
    ]);
    expect(start.initial.params['board.source']).toBe('store');
    expect(start.initial.params.dadoDepth).toBe('3/16');
  });
});
