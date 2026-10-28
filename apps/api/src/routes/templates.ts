import type { TemplateDefinition } from '@kerf/core';
import { Hono } from 'hono';

export function templateRoutes(templates: readonly TemplateDefinition[]) {
  return new Hono().get('/templates', (c) =>
    c.json({ templates: templates.map(({ id, version, name }) => ({ id, version, name })) }),
  );
}
