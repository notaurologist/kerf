import { describe, expect, it } from 'vitest';
import { render } from '../test/render.tsx';
import { Measured, Readings } from './numbers.tsx';

describe('Measured', () => {
  it('keeps each length and angle on one line, leaving the text as it was', () => {
    const text = `Top: level cut; saw at 20.0°, 70.0° to the edge. Each edge: 130-1/4", board 12' 0-1/2", hole 3/16"`;
    const html = render(<Measured text={text} />);
    expect(html).toContain('<span class="k-length">130-1/4&quot;</span>');
    expect(html).toContain('<span class="k-length">12&#x27; 0-1/2&quot;</span>');
    expect(html).toContain('<span class="k-length">3/16&quot;</span>');
    expect(html).toContain('<span class="k-length">20.0°</span>');
    expect(
      html
        .replace(/<[^>]+>/g, '')
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'"),
    ).toBe(text);
  });
});

describe('Readings', () => {
  it('keeps each reading on one line, with a space to break at between them', () => {
    expect(render(<Readings text={`170.2 in (170-3/16")`} />)).toBe(
      '<span class="k-length">170.2 in</span> <span class="k-length">(170-3/16&quot;)</span>',
    );
    expect(render(<Readings text="16,214 lb·in" />)).toBe(
      '<span class="k-length">16,214 lb·in</span>',
    );
  });
});
