import { type geometry, type TemplateDefinition, unletteredView } from '@kerf/core';
import { Hono } from 'hono';
import { z } from 'zod';
import { valid } from './validate.ts';

const ById = z.object({ id: z.string().min(1) });

/**
 * Each template's first worked example, assembled and with no part letters, for choosing a
 * template (#357). Drawn by core on the first request and kept, since it changes only with the
 * template.
 */
function exampleDrawing(template: TemplateDefinition): geometry.Drawing | null {
  const example = template.examples[0];
  if (!example) return null;
  const made = template.generate(example.params, example.structuralInputs);
  return made.ok ? unletteredView(template, made.output) : null;
}

export function templateRoutes(templates: readonly TemplateDefinition[]) {
  const drawn = new Map<string, geometry.Drawing | null>();
  return new Hono()
    .get('/templates', (c) =>
      c.json({
        templates: templates.map(({ id, version, name, description }) => ({
          id,
          version,
          name,
          description,
        })),
      }),
    )
    .get('/templates/:id/drawing', valid('param', ById), (c) => {
      const template = templates.find((t) => t.id === c.req.valid('param').id);
      if (!template) return c.json({ error: 'not-found' as const }, 404);
      if (!drawn.has(template.id)) drawn.set(template.id, exampleDrawing(template));
      return c.json({ drawing: drawn.get(template.id) ?? null }, 200);
    });
}
