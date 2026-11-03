import { describe, expect, it } from 'vitest';
import type { Part } from '../model/types.ts';
import { preservativeFor } from './treatment.ts';

describe('preservativeFor', () => {
  const part = { id: 'post' } as Part;

  it('lists one preservative in the store group given when any part is treated', () => {
    const [item, ...rest] = preservativeFor([part, { ...part, treated: true }], 'Paint');
    expect(rest).toEqual([]);
    expect(item).toMatchObject({
      id: 'preservative',
      quantity: 1,
      structural: false,
      group: 'Paint',
    });
    // The source it is required by, and the edition its figures come from.
    expect(item?.notes.join(' ')).toContain('IRC 2021 R317.1.1');
    expect(item?.notes.join(' ')).toContain('AWPA M4-06, 7.1.1 and 7.1.2');
  });

  it('lists none when no part is treated', () => {
    expect(preservativeFor([part], 'Paint')).toEqual([]);
  });
});
