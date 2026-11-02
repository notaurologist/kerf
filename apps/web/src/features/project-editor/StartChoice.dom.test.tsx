// @vitest-environment happy-dom
import { findTemplate, type TemplateDefinition } from '@kerf/core';
import { act } from 'react';
import { describe, expect, it } from 'vitest';
import type { ProjectSummary } from '../../lib/types.ts';
import { mount } from '../../test/dom.tsx';
import { render, textOf } from '../../test/render.tsx';
import { StartChoice, StartedFrom } from './StartChoice.tsx';

const swingSet = findTemplate('swing-set-a-frame') as TemplateDefinition;
const base = '#/projects/new?template=swing-set-a-frame';

const earlier = (n: number): ProjectSummary[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    name: i === 4 ? 'Grandkids swing set' : `Swing set ${i + 1}`,
    status: 'planned',
    templateId: swingSet.id,
    templateVersion: swingSet.version,
    revision: 1,
    templateBehind: false,
    progress: null,
    createdAt: '2026-11-01T12:00:00.000Z',
    updatedAt: '2026-11-01T12:00:00.000Z',
  }));

const headings = (html: string) =>
  [...html.matchAll(/<h2[^>]*>(.*?)<\/h2>/g)].map((m) => textOf(m[1] ?? ''));

describe('how to start a new project (#358)', () => {
  it('asks how to start, with the questions first and each choice saying what it does', () => {
    const html = render(
      <StartChoice template={swingSet} title="New swing set" earlier={earlier(1)} />,
    );
    expect(textOf(html)).toContain('New swing set How do you want to start?');
    expect(headings(html)).toEqual([
      'Answer a few questions',
      'Start from an example',
      'Copy an earlier project',
      'Empty form',
    ]);
    expect(textOf(html)).toContain('Kerf suggests the rest');
    expect(html).toContain(`href="${base}&amp;questions"`);
    expect(html).toContain(`href="${base}&amp;empty"`);
    expect(html).toContain(`href="${base}&amp;example=0"`);
    expect(html).toContain(`href="${base}&amp;project=p1"`);
  });

  it('puts the examples first for a template with no questions', () => {
    const { questions: _, ...rest } = swingSet;
    const html = render(<StartChoice template={rest} title="New" earlier={[]} />);
    expect(headings(html)).toEqual(['Start from an example', 'Empty form']);
  });

  it('leaves out the copy when there is nothing to copy', () => {
    const html = render(<StartChoice template={swingSet} title="New" earlier={[]} />);
    expect(headings(html)).not.toContain('Copy an earlier project');
  });

  it('offers the three most recent earlier projects, and a search through the rest', () => {
    const { container } = mount(
      <StartChoice template={swingSet} title="New" earlier={earlier(5)} />,
    );
    const copies = () =>
      [...container.querySelectorAll('a[href*="&project="]')].map((a) => a.textContent);
    expect(copies()).toEqual(['Swing set 1', 'Swing set 2', 'Swing set 3']);
    const search = container.querySelector<HTMLInputElement>('#start-copy-search');
    if (!search) throw new Error('no search');
    act(() => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      set?.call(search, 'grand');
      search.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(copies()).toEqual(['Grandkids swing set']);
  });

  it('has no search with three earlier projects or fewer', () => {
    const html = render(<StartChoice template={swingSet} title="New" earlier={earlier(3)} />);
    expect(html).not.toContain('start-copy-search');
  });
});

describe('the form’s line on how it was started', () => {
  it('names the start and links back to the choice', () => {
    const line = (start: Parameters<typeof StartedFrom>[0]['start']) =>
      render(<StartedFrom template={swingSet} start={start} earlier={earlier(1)} />);
    expect(textOf(line({ kind: 'empty' }))).toBe(
      'Started from: An empty form. Change how you started',
    );
    expect(textOf(line({ kind: 'project', id: 'p1' }))).toContain('A copy of Swing set 1.');
    expect(textOf(line({ kind: 'questions' }))).toContain('Your answers.');
    expect(textOf(line({ kind: 'example', index: 0 }))).toContain(
      `${swingSet.examples[0]?.start}.`,
    );
    expect(line({ kind: 'empty' })).toContain(`<a href="${base}">Change how you started</a>`);
  });
});
