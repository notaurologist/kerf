import { describe, expect, it } from 'vitest';
import type { Plan } from '../outputs/plan.ts';
import type { TemplateForm } from './form.ts';
import {
  placeStoreReadings,
  readingsBesideHardware,
  readingsBesideLumber,
} from './storeReadings.ts';

// Placing store readings is generic: a reading sits beside the lines it names, only while its
// field applies, and says what was entered.

const form: TemplateForm = {
  params: [
    {
      title: 'Top',
      fields: [
        { path: 'outdoors', label: 'Outdoors', kind: 'yes-no' },
        {
          path: 'clips',
          label: 'Clips per corner',
          kind: 'integer',
          when: (v) => v('outdoors') === 'true',
        },
      ],
    },
  ],
  structuralInputs: [
    {
      title: 'Top',
      fields: [{ path: 'rating', label: 'Clip rating', kind: 'number', unit: 'lb' }],
    },
  ],
};

const plan: Pick<Plan, 'lumber' | 'hardware'> = {
  lumber: {
    boards: [
      { nominal: '1x6', feet: 8, pieces: [{ partId: 'top', name: 'Top', length: 40 }], offcut: 1 },
      {
        nominal: '1x6',
        feet: 8,
        pieces: [{ partId: 'side', name: 'Side', length: 40 }],
        offcut: 1,
      },
      {
        nominal: '1x4',
        feet: 6,
        pieces: [{ partId: 'side', name: 'Side', length: 30 }],
        offcut: 1,
      },
    ],
    kerf: 0.125,
    trimPerEnd: 0.5,
    lines: [
      { nominal: '1x6', feet: 8, count: 2 },
      { nominal: '1x4', feet: 6, count: 1 },
    ],
    notes: [],
    issues: [],
    selection: [],
  },
  hardware: [{ description: 'Clips', quantity: 8, notes: [] }],
};

const readings = [
  {
    from: 'structuralInputs' as const,
    path: 'rating',
    beside: { hardware: 'Clips' },
    prompt: 'Read the rating.',
    how: 'On the package.',
  },
  {
    from: 'params' as const,
    path: 'clips',
    beside: { hardware: 'Clips' },
    prompt: 'Read the count.',
    how: 'On the package.',
  },
  {
    from: 'structuralInputs' as const,
    path: 'rating',
    beside: { part: 'side' },
    prompt: 'Read the stamp.',
    how: 'On the face.',
  },
  {
    from: 'structuralInputs' as const,
    path: 'rating',
    beside: { hardware: 'Screws' },
    prompt: 'Not in this plan.',
    how: 'Nowhere.',
  },
];

describe('placeStoreReadings', () => {
  it('puts a part reading beside every lumber line holding its pieces', () => {
    const placed = placeStoreReadings(readings, form, plan, { outdoors: false }, {});
    expect(
      readingsBesideLumber(placed, { nominal: '1x6', feet: 8 }).map((p) => p.reading.prompt),
    ).toEqual(['Read the stamp.']);
    expect(readingsBesideLumber(placed, { nominal: '1x4', feet: 6 })).toHaveLength(1);
  });

  it('leaves out a reading whose field does not apply, or whose line is not bought', () => {
    const placed = placeStoreReadings(readings, form, plan, { outdoors: false }, {});
    expect(
      readingsBesideHardware(placed, { description: 'Clips' }).map((p) => p.reading.path),
    ).toEqual(['rating']);
    expect(placed.hardware.has('Screws')).toBe(false);
  });

  it('says what was entered, through the form', () => {
    const placed = placeStoreReadings(
      readings,
      form,
      plan,
      { outdoors: true, clips: 2 },
      { rating: 150 },
    );
    expect(
      readingsBesideHardware(placed, { description: 'Clips' }).map((p) => [p.label, p.entered]),
    ).toEqual([
      ['Clip rating', '150 lb'],
      ['Clips per corner', '2'],
    ]);
  });
});
