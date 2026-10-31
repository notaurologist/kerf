import { randomBytes, type ScryptOptions, scrypt, timingSafeEqual } from 'node:crypto';

// The login password's hash (decision 0007), made with Node's scrypt and stored in the
// PASSWORD_HASH environment variable as `scrypt:N:r:p:salt:hash`, salt and hash in base64url.
// Colons rather than `$` so no env file or shell expands any part of it.

/** OWASP's recommended scrypt cost (N = 2^17, r = 8, p = 1); about 128 MiB per hash. */
const COST = { N: 2 ** 17, r: 8, p: 1 } as const;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
export const MIN_PASSWORD_LENGTH = 12;

/**
 * The lowest N a configured hash may use. `hashPassword` writes 2^17; this floor catches a hash
 * made with a test cost or edited by hand. Tests hash with a cheaper N and skip the config check,
 * so `verifyPassword` checks the shape and lengths but not this.
 */
const MIN_CONFIGURED_N = 2 ** 15;

const FORMAT = /^scrypt:(\d+):(\d+):(\d+):([A-Za-z0-9_-]+):([A-Za-z0-9_-]+)$/;

interface StoredHash {
  N: number;
  r: number;
  p: number;
  salt: Buffer;
  hash: Buffer;
}

/**
 * A stored hash in the shape `hashPassword` writes, or undefined. The lengths matter: a hash
 * segment cut short decodes to fewer bytes, and a key that short can be guessed, or with 0 bytes
 * matches every password.
 */
function parse(value: string): StoredHash | undefined {
  const match = FORMAT.exec(value);
  if (!match) return undefined;
  const [N, r, p] = [match[1], match[2], match[3]].map(Number) as [number, number, number];
  const salt = Buffer.from(match[4] ?? '', 'base64url');
  const hash = Buffer.from(match[5] ?? '', 'base64url');
  const powerOfTwo = Number.isSafeInteger(N) && N >= 2 && Number.isInteger(Math.log2(N));
  if (!powerOfTwo || r !== COST.r || p < 1) return undefined;
  if (salt.length !== SALT_LENGTH || hash.length !== KEY_LENGTH) return undefined;
  return { N, r, p, salt, hash };
}

function derive(password: string, salt: Buffer, length: number, cost: ScryptOptions) {
  // scrypt needs 128·N·r bytes; allow twice that so the default 32 MiB cap does not stop it.
  const maxmem = 256 * (cost.N ?? 0) * (cost.r ?? 0);
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password.normalize('NFKC'), salt, length, { ...cost, maxmem }, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}

/** `cost` is for tests, which use a cheap one; the stored hash records whichever was used. */
export async function hashPassword(
  password: string,
  cost: { N: number; r: number; p: number } = COST,
): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await derive(password, salt, KEY_LENGTH, cost);
  return [
    'scrypt',
    cost.N,
    cost.r,
    cost.p,
    salt.toString('base64url'),
    key.toString('base64url'),
  ].join(':');
}

/** True for a hash fit to configure: the shape `hashPassword` writes, at a cost of at least 2^15. */
export function isPasswordHash(value: string): boolean {
  const stored = parse(value);
  return stored !== undefined && stored.N >= MIN_CONFIGURED_N;
}

/** Compares in constant time. A malformed stored hash never matches. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parsed = parse(stored);
  if (!parsed) return false;
  const { N, r, p, salt, hash } = parsed;
  const key = await derive(password, salt, KEY_LENGTH, { N, r, p });
  return timingSafeEqual(key, hash);
}
