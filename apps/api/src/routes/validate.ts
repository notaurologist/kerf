import { zValidator } from '@hono/zod-validator';
import type { ValidationTargets } from 'hono';
import type { z } from 'zod';

/** A request part parsed with Zod; a bad one gets 400 with each problem and where it is. */
export function valid<Target extends keyof ValidationTargets, Schema extends z.ZodType>(
  target: Target,
  schema: Schema,
) {
  return zValidator(target, schema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          error: 'invalid-request' as const,
          issues: result.error.issues.map((i) => ({
            path: i.path.map(String),
            message: i.message,
          })),
        },
        400,
      );
    }
  });
}
