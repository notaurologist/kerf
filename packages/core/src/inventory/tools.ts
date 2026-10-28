import { z } from 'zod';

// The tool inventory (PRODUCT.md, MVP feature 1; DOMAIN.md, Tool). The API stores it and the
// web app edits it, and both check it with these schemas. Tool type IDs will be checked against
// the knowledge base once it exists (M6); until then any lowercase ID is accepted.

export const Tool = z.object({
  toolTypeId: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'must be a lowercase ID like miter-saw'),
  /** Capabilities that matter for choosing methods, such as { bevels: true }. */
  capabilities: z.record(z.string(), z.union([z.boolean(), z.number(), z.string()])),
});
export type Tool = z.infer<typeof Tool>;

export const Inventory = z.object({
  tools: z
    .array(Tool)
    .refine(
      (list) => new Set(list.map((t) => t.toolTypeId)).size === list.length,
      'lists a tool type more than once',
    ),
});
export type Inventory = z.infer<typeof Inventory>;
