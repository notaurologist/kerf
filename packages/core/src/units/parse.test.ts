import { describe, expect, it } from 'vitest';
import {
  describeLength,
  lengthForEntry,
  parseAngle,
  parseFractionalNumber,
  parseLength,
} from './parse.ts';

// Cases from the entry standard (#67, docs/design/entry.html). Each expected value is worked by
// hand in the comment beside it: feet times 12, plus inches, plus the fraction.

const value = (text: string) => {
  const r = parseLength(text);
  if (!r.ok) throw new Error(`${text}: ${r.message}`);
  return r.value;
};
const problem = (text: string) => {
  const r = parseLength(text);
  return r.ok ? `read as ${r.value}` : r.problem;
};

describe('parseLength reads', () => {
  it.each([
    ['138', 138], // a number on its own is inches
    ['138.375', 138.375],
    ['.5', 0.5],
    ['138-3/8', 138.375], // 138 + 3/8
    ['138 3/8', 138.375],
    ['138 - 3/8', 138.375],
    ['3/8', 0.375],
    ['138-3/8"', 138.375],
    ['96"', 96],
    ["8'", 96], // 8 * 12
    ["11'", 132], // 11 * 12
    ["11' 6", 138], // 132 + 6
    ["11'6", 138],
    [`11'-6"`, 138], // drafting style
    [`11' 6-3/8"`, 138.375], // 132 + 6 + 3/8
    ["11'6-3/8", 138.375],
    ["11'6 3/8", 138.375],
    ["11' 3/8", 132.375], // 132 + 3/8
    ["0' 6", 6],
    ["11.5'", 138], // 11.5 * 12
    ["11' 14", 146], // 132 + 14: read, and the echo shows it normalized
    ['6/16', 0.375], // unreduced
    ['1/64', 0.015625],
    ['  96  ', 96],
  ] as [string, number][])('%s as %s"', (text, inches) => {
    expect(value(text)).toBe(inches);
  });

  it('reads the marks a phone types: curly quotes and primes', () => {
    expect(value('11’ 6-3/8”')).toBe(138.375);
    expect(value('11′ 6-3/8″')).toBe(138.375);
    expect(value("11'' ")).toBe(11); // two apostrophes for inches
  });

  it('reads the words for the marks', () => {
    expect(value('11 ft 6 in')).toBe(138);
    expect(value('11ft 6-3/8in')).toBe(138.375);
    expect(value('11 feet')).toBe(132);
    expect(value('6 inches')).toBe(6);
  });

  it('keeps finer fractions and decimals exactly', () => {
    expect(value('1/32')).toBe(0.03125);
    expect(value('138.4')).toBe(138.4);
  });
});

describe('parseLength refuses', () => {
  it.each([
    ['', 'empty'],
    ['   ', 'empty'],
    ['11 6', 'unmarked-feet'], // feet and inches, or a slip?
    ['11 6"', 'unmarked-feet'],
    ['3500 mm', 'metric'],
    ['3.5m', 'metric'],
    ['90 cm', 'metric'],
    ['-4', 'negative'],
    ['1/3', 'denominator'],
    ['138 3/10', 'denominator'],
    ['3/0', 'denominator'],
    ['138 9/8', 'improper'],
    ['138 8/8', 'improper'],
    ['138.5 3/8', 'decimal-with-fraction'],
    ['abc', 'unread'],
    ["11' 6'", 'unread'],
    ['6-3', 'unread'],
    ["'", 'unread'],
    ['"', 'unread'],
    ['1/2/3', 'unread'],
  ])('%j as %s', (text, expected) => {
    expect(problem(text)).toBe(expected);
  });

  it('says what to enter', () => {
    const r = parseLength('11 6');
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(r.message).toBe(`Mark feet with ': such as 11' 6". A number on its own is inches.`);
  });
});

describe('parseAngle', () => {
  it.each([
    ['20', 20],
    ['20.5', 20.5],
    ['20°', 20],
    ['20 °', 20],
    ['20 deg', 20],
    ['20 degrees', 20],
    ['-3', -3],
  ])('reads %s as %s°', (text, degrees) => {
    expect(parseAngle(text)).toEqual({ ok: true, value: degrees });
  });

  it('refuses degrees and minutes, and words', () => {
    expect(parseAngle(`20°30'`)).toMatchObject({ ok: false, problem: 'minutes' });
    expect(parseAngle('twenty')).toMatchObject({ ok: false, problem: 'unread' });
    expect(parseAngle('')).toMatchObject({ ok: false, problem: 'empty' });
  });
});

describe('parseFractionalNumber', () => {
  it.each([
    ['1', 1],
    ['0.25', 0.25],
    ['1/4', 0.25],
    ['1 1/2', 1.5],
    ['1-1/2', 1.5],
    ['-1/4', -0.25],
    ['-0.5', -0.5],
    ['0', 0],
  ])('reads %s as %s', (text, n) => {
    expect(parseFractionalNumber(text)).toEqual({ ok: true, value: n });
  });

  it('refuses other fractions and text', () => {
    expect(parseFractionalNumber('1/3')).toMatchObject({ ok: false, problem: 'denominator' });
    expect(parseFractionalNumber('a lot')).toMatchObject({ ok: false, problem: 'unread' });
  });
});

describe('describeLength', () => {
  it('gives feet and inches, then inches', () => {
    expect(describeLength(138.375)).toBe(`11' 6-3/8" · 138-3/8"`);
    expect(describeLength(96)).toBe(`8' 0" · 96"`);
  });

  it('gives a length under a foot once', () => {
    expect(describeLength(6)).toBe('6"');
  });

  it('says when the display is rounded, and that the exact value is kept', () => {
    // 138.4 is 6.4/16 past 138; the nearest sixteenth is 6/16 = 3/8.
    expect(describeLength(138.4)).toBe(
      `11' 6-3/8" · 138-3/8" to the nearest 1/16; Kerf keeps 138.4 exactly`,
    );
  });
});

describe('lengthForEntry', () => {
  it('writes a whole number of sixteenths in inches, without the mark', () => {
    expect(lengthForEntry(138.375)).toBe('138-3/8');
    expect(lengthForEntry(96)).toBe('96');
    expect(lengthForEntry(0.5)).toBe('1/2');
    expect(lengthForEntry(0)).toBe('0');
  });

  it('writes anything else as the decimal, never rounded', () => {
    expect(lengthForEntry(138.4)).toBe('138.4');
    expect(lengthForEntry(1 / 32)).toBe('0.03125');
  });

  it('round-trips: reading back what it writes gives the same value', () => {
    for (const inches of [0, 0.5, 96, 120, 138.375, 138.4, 1 / 32, 1 / 64, 12.0625]) {
      expect(value(lengthForEntry(inches))).toBe(inches);
    }
  });
});
