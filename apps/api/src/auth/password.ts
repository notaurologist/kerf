import { randomBytes, type ScryptOptions, scrypt, timingSafeEqual } from 'node:crypto';

// The login password's hash (decision 0007), made with Node's scrypt and stored in the
// PASSWORD_HASH environment variable as `scrypt:N:r:p:salt:hash`, salt and hash in base64url.
// Colons rather than `$` so no env file or shell expands any part of it.

/** OWASP's recommended scrypt cost (N = 2^17, r = 8, p = 1); about 128 MiB per hash. */
const COST = { N: 2 ** 17, r: 8, p: 1 } as const;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
export const MIN_PASSWORD_LENGTH = 12;

/** Only the config check enforces this, so tests can hash cheaply. */
const MIN_CONFIGURED_N = 2 ** 15;

const FORMAT = /^scrypt:(\d+):(\d+):(\d+):([A-Za-z0-9_-]+):([A-Za-z0-9_-]+)$/;

interface StoredHash {
  N: number;
  r: number;
  p: number;
  salt: Buffer;
  hash: Buffer;
}

/** A key cut short is guessable, and an empty one matches every password, so lengths are exact. */
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

// Each hash holds about 128 MiB while it runs. Node's thread pool (4 threads by default) already
// caps how many run at once; this keeps the cap at 2 per instance whatever the pool size, so a
// burst of logins cannot use up the function's memory. Waiting logins hold nothing large.
export const MAX_CONCURRENT_HASHES = 2;
let running = 0;
const waiting: (() => void)[] = [];

async function oneOfFew<T>(work: () => Promise<T>): Promise<T> {
  if (running >= MAX_CONCURRENT_HASHES) await new Promise<void>((go) => waiting.push(go));
  else running++;
  try {
    return await work();
  } finally {
    const next = waiting.shift();
    if (next) next();
    else running--;
  }
}

function derive(password: string, salt: Buffer, length: number, cost: ScryptOptions) {
  // scrypt needs 128·N·r bytes; allow twice that so the default 32 MiB cap does not stop it.
  const maxmem = 256 * (cost.N ?? 0) * (cost.r ?? 0);
  return oneOfFew(
    () =>
      new Promise<Buffer>((resolve, reject) => {
        scrypt(password.normalize('NFKC'), salt, length, { ...cost, maxmem }, (error, key) =>
          error ? reject(error) : resolve(key),
        );
      }),
  );
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
