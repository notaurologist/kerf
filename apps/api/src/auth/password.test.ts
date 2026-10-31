import { describe, expect, it } from 'vitest';
import { hashPassword, isPasswordHash, verifyPassword } from './password.ts';

const CHEAP = { N: 1024, r: 8, p: 1 };

describe('password hashes', () => {
  it('verify the password they were made from, and no other', async () => {
    const hash = await hashPassword('a long test password', CHEAP);
    expect(hash).toMatch(/^scrypt:1024:8:1:/);
    expect(await verifyPassword('a long test password', hash)).toBe(true);
    expect(await verifyPassword('a long test passwore', hash)).toBe(false);
  });

  it('use a fresh salt each time', async () => {
    expect(await hashPassword('same', CHEAP)).not.toBe(await hashPassword('same', CHEAP));
  });

  it('default to scrypt N = 2^17, r = 8, p = 1', async () => {
    expect(await hashPassword('x')).toMatch(/^scrypt:131072:8:1:/);
  });

  it('never match a malformed hash', async () => {
    expect(isPasswordHash('plain text')).toBe(false);
    expect(await verifyPassword('plain text', 'plain text')).toBe(false);
  });

  it('are refused for configuration below N = 2^15, or with the wrong lengths or r', async () => {
    const real = await hashPassword('a long test password', { N: 2 ** 15, r: 8, p: 1 });
    expect(isPasswordHash(real)).toBe(true);
    const [, , , , salt, key] = real.split(':');
    const made = (N: number, r: number, p: number, s = salt, k = key) =>
      ['scrypt', N, r, p, s, k].join(':');
    expect(isPasswordHash(made(2 ** 14, 8, 1))).toBe(false);
    expect(isPasswordHash(made(3 * 2 ** 14, 8, 1))).toBe(false);
    expect(isPasswordHash(made(2 ** 15, 4, 1))).toBe(false);
    expect(isPasswordHash(made(2 ** 15, 8, 0))).toBe(false);
    expect(isPasswordHash(made(2 ** 15, 8, 1, salt?.slice(0, -2)))).toBe(false);
    expect(isPasswordHash(made(2 ** 15, 8, 1, salt, key?.slice(0, -10)))).toBe(false);
    expect(isPasswordHash('scrypt:2:1:1:A:A')).toBe(false);
  });

  it('never match a stored hash shorter than 32 bytes, even the password it was cut from', async () => {
    const hash = await hashPassword('a long test password', CHEAP);
    expect(await verifyPassword('a long test password', hash.slice(0, -10))).toBe(false);
    expect(await verifyPassword('anything at all', 'scrypt:2:1:1:A:A')).toBe(false);
  });

  it('treat composed and decomposed accents as the same password', async () => {
    const hash = await hashPassword('café au lait!', CHEAP);
    expect(await verifyPassword('café au lait!', hash)).toBe(true);
  });
});
