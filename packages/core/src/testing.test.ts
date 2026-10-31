import { describe, expect, it } from 'vitest';
import { BRAND_NAMES, VERDICT_WORDS, withoutBrandExceptions } from './testing.ts';

describe('the copy word lists', () => {
  it.each([
    'The beam passes.',
    'This check fails under load.',
    'Safe for two riders.',
    'It passed',
    'unsafe',
  ])('find a verdict in "%s"', (text) => {
    expect(text).toMatch(VERDICT_WORDS);
  });

  it.each([
    'A bolt that passes through the leg.',
    'A bolt that passes all the way through the parts it joins.',
    'Check that it passes without being driven.',
    'The margin is 1.1x under these assumptions.',
  ])('find none in "%s"', (text) => {
    expect(text).not.toMatch(VERDICT_WORDS);
  });

  it('find a brand, and none in a named exception', () => {
    expect('Cut it with a Sawzall.').toMatch(BRAND_NAMES);
    expect('Use a Simpson Strong-Tie hanger.').toMatch(BRAND_NAMES);
    expect(withoutBrandExceptions('William T. Simpson, 1993.')).not.toMatch(BRAND_NAMES);
  });
});
