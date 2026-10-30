import type { Context } from 'hono';
import { Hono } from 'hono';
import { z } from 'zod';
import { ProgressChanges } from '../services/progress.ts';
import {
  NewProject,
  NewProjectPreview,
  ProjectChanges,
  type ProjectService,
  type Result,
} from '../services/projects.ts';
import { valid } from './validate.ts';

const ById = z.object({ id: z.uuid() });

/** Every project route answers a failed result the same way. */
function failure(c: Context, result: Extract<Result<unknown>, { ok: false }>) {
  switch (result.error) {
    case 'not-found':
      return c.json({ error: result.error }, 404);
    case 'unknown-template':
      return c.json({ error: result.error }, 400);
    case 'unreadable-snapshot':
      return c.json({ error: result.error }, 500);
    case 'invalid-project':
      return c.json({ error: result.error, issues: result.issues }, 422);
    case 'unknown-progress':
      return c.json({ error: result.error, items: result.items }, 422);
  }
}

export function projectRoutes(projects: ProjectService) {
  return new Hono()
    .get('/projects', async (c) => c.json({ projects: await projects.list() }))
    .post('/projects', valid('json', NewProject), async (c) => {
      const result = await projects.create(c.req.valid('json'));
      return result.ok ? c.json(result.value, 201) : failure(c, result);
    })
    .post('/projects/preview', valid('json', NewProjectPreview), (c) => {
      const result = projects.previewNew(c.req.valid('json'));
      return result.ok ? c.json(result.value, 200) : failure(c, result);
    })
    .get('/projects/:id', valid('param', ById), async (c) => {
      const result = await projects.get(c.req.valid('param').id);
      return result.ok ? c.json(result.value, 200) : failure(c, result);
    })
    .put('/projects/:id', valid('param', ById), valid('json', ProjectChanges), async (c) => {
      const result = await projects.update(c.req.valid('param').id, c.req.valid('json'));
      return result.ok ? c.json(result.value, 200) : failure(c, result);
    })
    .post(
      '/projects/:id/preview',
      valid('param', ById),
      valid('json', ProjectChanges),
      async (c) => {
        const result = await projects.preview(c.req.valid('param').id, c.req.valid('json'));
        return result.ok ? c.json(result.value, 200) : failure(c, result);
      },
    )
    .post('/projects/:id/regenerate', valid('param', ById), async (c) => {
      const result = await projects.regenerate(c.req.valid('param').id);
      return result.ok ? c.json(result.value, 200) : failure(c, result);
    })
    .get('/projects/:id/progress', valid('param', ById), async (c) => {
      const result = await projects.progress(c.req.valid('param').id);
      return result.ok ? c.json({ ticks: result.value }, 200) : failure(c, result);
    })
    .patch(
      '/projects/:id/progress',
      valid('param', ById),
      valid('json', ProgressChanges),
      async (c) => {
        const result = await projects.setProgress(c.req.valid('param').id, c.req.valid('json'));
        return result.ok ? c.json(result.value, 200) : failure(c, result);
      },
    )
    .delete('/projects/:id', valid('param', ById), async (c) => {
      const result = await projects.remove(c.req.valid('param').id);
      return result.ok ? c.body(null, 204) : failure(c, result);
    });
}
