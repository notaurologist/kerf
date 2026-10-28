import { describe, expect, it } from 'vitest';
import { render } from '../test/render.tsx';
import { Measured } from './Measured.tsx';

describe('Measured', () => {
  it('keeps each length and angle on one line, leaving the text as it was', () => {
    const text = `Top: level cut; saw at 20.0°, 70.0° to the edge. Each edge: 130-1/4", board 12' 0-1/2", hole 3/16"`;
    const html = render(<Measured text={text} />);
    expect(html).toContain('<span class="nowrap">130-1/4&quot;</span>');
    expect(html).toContain('<span class="nowrap">12&#x27; 0-1/2&quot;</span>');
    expect(html).toContain('<span class="nowrap">3/16&quot;</span>');
    expect(html).toContain('<span class="nowrap">20.0°</span>');
    expect(
      html
        .replace(/<[^>]+>/g, '')
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'"),
    ).toBe(text);
  });
});
