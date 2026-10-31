import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.ts';

const HASH = 'scrypt:131072:8:1:c2FsdHNhbHRzYWx0c2FsdA:a2V5a2V5a2V5a2V5a2V5a2V5a2V5a2V5a2V5a2V5a2U';

describe('loadConfig', () => {
  it('reads a valid environment', () => {
    expect(loadConfig({ DATABASE_URL: 'postgres://u@h/d', PASSWORD_HASH: HASH })).toEqual({
      databaseUrl: 'postgres://u@h/d',
      passwordHash: HASH,
      port: 3000,
    });
  });

  it('rejects a password hash that would accept any password, or one cut short', () => {
    const env = (hash: string) => ({ DATABASE_URL: 'postgres://u@h/d', PASSWORD_HASH: hash });
    expect(() => loadConfig(env('scrypt:2:1:1:A:A'))).toThrow(/PASSWORD_HASH/);
    expect(() => loadConfig(env(HASH.slice(0, -10)))).toThrow(/PASSWORD_HASH/);
  });

  it('names every bad variable without printing its value', () => {
    let message = '';
    try {
      loadConfig({ DATABASE_URL: 'mysql://secret-host', PASSWORD_HASH: 'hunter2hunter2' });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('DATABASE_URL');
    expect(message).toContain('PASSWORD_HASH');
    expect(message).not.toContain('secret-host');
    expect(message).not.toContain('hunter2');
  });
});
