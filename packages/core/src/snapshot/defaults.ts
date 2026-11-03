import { z } from 'zod';

// A snapshot stores a field with a schema default only when it differs from the default, such as
// a part's mortises when it has some. Reading parses with the same schema, which fills the
// default back in. So a field added later with a default, such as a new kind of part feature,
// changes nothing a template stores unless the template uses it (decision 0014).

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** The value as stored: every field still at its schema default left out, at any depth. */
export function leaveOutDefaults(schema: z.ZodType, value: unknown): unknown {
  if (schema instanceof z.ZodObject) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return value;
    const shape = schema.shape as Record<string, z.ZodType>;
    const kept: [string, unknown][] = [];
    for (const [key, child] of Object.entries(value)) {
      const field = shape[key];
      if (!field) kept.push([key, child]);
      else if (!(field instanceof z.ZodDefault && same(child, field.def.defaultValue))) {
        kept.push([key, leaveOutDefaults(field, child)]);
      }
    }
    return Object.fromEntries(kept);
  }
  if (schema instanceof z.ZodArray) {
    return Array.isArray(value)
      ? value.map((item) => leaveOutDefaults(schema.element as z.ZodType, item))
      : value;
  }
  if (schema instanceof z.ZodTuple) {
    if (!Array.isArray(value)) return value;
    const { items, rest } = schema.def;
    return value.map((item, i) => {
      const at = items[i] ?? rest;
      return at ? leaveOutDefaults(at as z.ZodType, item) : item;
    });
  }
  if (schema instanceof z.ZodUnion) {
    const option = (schema.options as z.ZodType[]).find((o) => o.safeParse(value).success);
    return option ? leaveOutDefaults(option, value) : value;
  }
  if (
    schema instanceof z.ZodOptional ||
    schema instanceof z.ZodNullable ||
    schema instanceof z.ZodDefault ||
    schema instanceof z.ZodReadonly
  ) {
    return value === undefined || value === null
      ? value
      : leaveOutDefaults(schema.def.innerType as z.ZodType, value);
  }
  if (schema instanceof z.ZodPipe) return leaveOutDefaults(schema.def.in as z.ZodType, value);
  if (schema instanceof z.ZodLazy) return leaveOutDefaults(schema.def.getter() as z.ZodType, value);
  return value;
}
