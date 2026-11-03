import type { LumberPlan, ShoppingLine } from '@kerf/core';
import { describe, expect, it } from 'vitest';
import { render, renderText } from '../../test/render.tsx';
import { ShoppingList } from './ShoppingList.tsx';

type Line = Omit<ShoppingLine, 'notes' | 'alternatives'> &
  Partial<Pick<ShoppingLine, 'notes' | 'alternatives'>>;
const plan = (lines: Line[]): LumberPlan => ({
  boards: [],
  kerf: 0.125,
  trimPerEnd: 0.5,
  lines: lines.map((l) => ({ notes: [], alternatives: [], ...l })),
  notes: [],
  issues: [],
  selection: [],
});
const shown = (lines: Line[]) =>
  renderText(<ShoppingList lumber={plan(lines)} hardware={[]} hardwareNotes={[]} />);

describe('ShoppingList', () => {
  it('adds board feet, rounded up to a tenth, for hardwood sold by the board foot', () => {
    const text = shown([{ nominal: '4/4 hardwood', feet: 6, count: 2, boardFeet: 7.2000001 }]);
    expect(text).toContain('Board feet');
    expect(text).toContain('7.3');
  });

  it('leaves the column out when nothing is sold by the board foot', () => {
    expect(shown([{ nominal: '2x4', feet: 8, count: 1 }])).not.toContain('Board feet');
  });

  it('puts the count to buy first, in a table as wide as its columns (#361)', () => {
    const html = render(
      <ShoppingList
        lumber={plan([{ nominal: '2x4', feet: 8, count: 3 }])}
        hardware={[]}
        hardwareNotes={[]}
      />,
    );
    expect([...html.matchAll(/<th scope="col"[^>]*>([^<]*)<\/th>/g)].map((m) => m[1])).toEqual([
      'Buy',
      'Stock',
      'Length',
    ]);
    expect(html).toContain('data-keep="" data-narrow=""');
  });

  it("gives each hardware group the column's width and a count column as narrow as it can be", () => {
    const html = render(
      <ShoppingList
        lumber={plan([])}
        hardware={[
          {
            description: '1/2" through-bolt, grip 8-15/16"',
            quantity: 2,
            group: 'Bolts',
            notes: [],
          },
          { description: 'Swing hangers', quantity: 4, group: 'Swing hardware', notes: [] },
        ]}
        hardwareNotes={[]}
      />,
    );
    const tables = [...html.matchAll(/<table class="k-table"[^>]*>/g)].map((m) => m[0]);
    expect(tables).toEqual([
      '<table class="k-table" data-keep="" data-narrow="">',
      '<table class="k-table" data-keep="">',
      '<table class="k-table" data-keep="">',
    ]);
    expect(html.match(/<th scope="col" data-numeric="" data-width="fit">Buy<\/th>/g)).toHaveLength(
      2,
    );
  });

  it('marks a hardware count still to be read at the store as input needed (#406)', () => {
    const text = renderText(
      <ShoppingList
        lumber={plan([])}
        hardware={[
          { description: 'Swing hangers', quantity: 4, group: 'Swing hardware', notes: [] },
          {
            description: 'Ground anchors',
            quantityNeeded: {
              key: 'hardware.anchorsPerFoot',
              label: 'Ground anchors per leg foot',
            },
            group: 'Ground anchors',
            notes: [],
          },
        ]}
        hardwareNotes={[]}
      />,
    );
    expect(text).toContain('4 Swing hangers');
    expect(text).toContain('Input needed Ground anchors');
    expect(text).not.toContain('undefined');
  });

  it("lists each hardware line's notes under its group, named by the line (#449)", () => {
    const text = renderText(
      <ShoppingList
        lumber={plan([])}
        hardware={[
          {
            description: '1/2" × 10" through-bolt',
            quantity: 2,
            group: 'Bolts',
            notes: ['Grip 8-15/16".'],
          },
          { description: '1/2" flat washers', quantity: 4, group: 'Bolts', notes: [] },
          { description: 'Swing hangers', quantity: 4, group: 'Swing', notes: ['Rated.'] },
        ]}
        hardwareNotes={[]}
      />,
    );
    expect(text).toMatch(
      /2 1\/2" × 10" through-bolt .*1\/2" × 10" through-bolt: Grip 8-15\/16"\. Swing/,
    );
    expect(text).toContain('Swing hangers: Rated.');
  });
});

describe("each lumber line's notes (#450)", () => {
  it('lists them with the notes for the whole list', () => {
    const text = renderText(
      <ShoppingList
        lumber={{
          ...plan([{ nominal: '4x6', feet: 12, count: 1, notes: ["Beam: listed as 12'."] }]),
          notes: ['Allows 1/8" for each saw cut.'],
        }}
        hardware={[]}
        hardwareNotes={[]}
      />,
    );
    expect(text).toMatch(/Beam: listed as 12'\. .*Allows 1\/8" for each saw cut\./);
  });
});

describe('values read at the store in the plan (#390)', () => {
  const lumber: LumberPlan = {
    ...plan([
      { nominal: '4x6', feet: 12, count: 1 },
      { nominal: '4x4', feet: 12, count: 2 },
    ]),
    boards: [
      {
        nominal: '4x6',
        feet: 12,
        pieces: [{ partId: 'top', name: 'Top', length: 120 }],
        offcut: 1,
      },
      {
        nominal: '4x4',
        feet: 12,
        pieces: [{ partId: 'post', name: 'Post', length: 120 }],
        offcut: 1,
      },
    ],
  };
  const stamp = {
    from: 'structuralInputs' as const,
    path: 'grade',
    beside: { part: 'top' },
    prompt: 'Read the grade stamp on the top boards.',
    how: 'Inked on a face of each board.',
    illustration: 'grade-stamp' as const,
  };
  const rating = {
    from: 'structuralInputs' as const,
    path: 'rating',
    beside: { hardware: 'Clips' },
    prompt: 'Read the rating on the clip package.',
    how: 'Printed on the package.',
  };
  const list = (entered: string | null) => (
    <ShoppingList
      lumber={lumber}
      hardware={[{ description: 'Clips', quantity: 4, notes: [] }]}
      hardwareNotes={[]}
      readings={{
        byLine: {
          lumber: new Map([['4x6/12', [{ reading: stamp, label: 'Grade', entered }]]]),
          hardware: new Map([['Clips', [{ reading: rating, label: 'Clip rating', entered }]]]),
        },
        href: (r) => `#edit/${r.path}`,
      }}
    />
  );

  it('follows the table of the lines they are read from, each opening its field', () => {
    const text = renderText(list(null));
    expect(text).toContain(
      'Read the grade stamp on the top boards. Input needed Inked on a face of each board.',
    );
    expect(text).toContain('Grade stamp: what each part says');
    expect(text.indexOf('Read the rating')).toBeGreaterThan(text.indexOf('Clips'));
    const html = render(list(null));
    expect(html).toContain('href="#edit/grade"');
    expect(html).toContain('href="#edit/rating"');
  });

  it('says what was entered once it is', () => {
    const text = renderText(list('No. 2'));
    expect(text).toContain('Grade: No. 2. Change');
    expect(text).not.toContain('Input needed');
  });
});
