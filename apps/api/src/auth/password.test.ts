import { describe, expect, it } from 'vitest';
import { hashPassword, isPasswordHash, verifyPassword } from './password.ts';

const CHEAP = { N: 1024, r: 8, p: 1 };

describe('password hashes', () => {
  it('verify the password they were made from, and no other', async () => {
    const hash = await hashPassword('a long test password', CHEAP);
    expect(isPasswordHash(hash)).toBe(true);
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

  it('treat composed and decomposed accents as the same password', async () => {
    const hash = await hashPassword('café au lait!', CHEAP);
    expect(await verifyPassword('café au lait!', hash)).toBe(true);
  });
});
