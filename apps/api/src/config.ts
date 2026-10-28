import { z } from 'zod';
import { isPasswordHash } from './auth/password.ts';

const Env = z.object({
  DATABASE_URL: z
    .string()
    .regex(/^postgres(ql)?:\/\//, 'must be a postgres:// or postgresql:// URL'),
  PASSWORD_HASH: z
    .string()
    .refine(isPasswordHash, 'must be the output of pnpm --filter @kerf/api hash-password'),
  PORT: z
    .string()
    .regex(/^\d+$/, 'must be a whole number')
    .transform(Number)
    .pipe(z.number().int().min(1).max(65535))
    .default(3000),
});

export interface Config {
  databaseUrl: string;
  passwordHash: string;
  port: number;
}

// Validates the environment at startup and fails fast, listing every problem by variable name.
// Messages never include the values, which are secrets.
export function loadConfig(env: Record<string, string | undefined>): Config {
  const parsed = Env.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid configuration:\n${problems.join('\n')}\nSee .env.example.`);
  }
  return {
    databaseUrl: parsed.data.DATABASE_URL,
    passwordHash: parsed.data.PASSWORD_HASH,
    port: parsed.data.PORT,
  };
}
