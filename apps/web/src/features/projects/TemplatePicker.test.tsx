import { describe, expect, it } from 'vitest';
import { render, textOf } from '../../test/render.tsx';
import { TemplateList } from './TemplatePicker.tsx';

const templates = [
  { id: 'a-frame', version: 3, name: 'Two-swing A-frame swing set', description: 'Two swings.' },
  { id: 'cabinet', version: 1, name: 'Record cabinet', description: 'Records and a turntable.' },
];

describe('TemplateList', () => {
  const html = render(<TemplateList templates={templates} />);

  it('asks what to make and lists every template with what it is', () => {
    expect(textOf(html)).toContain('New project What do you want to make?');
    expect(textOf(html)).toContain('Two-swing A-frame swing set Two swings.');
    expect(textOf(html)).toContain('Record cabinet Records and a turntable.');
  });

  it("opens each template's new-project form", () => {
    expect(html).toContain('<a class="k-row-link" href="#/projects/new?template=a-frame">');
    expect(html).toContain('<a class="k-row-link" href="#/projects/new?template=cabinet">');
  });
});
