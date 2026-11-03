import { geometry } from '@kerf/core';
import type { Context } from 'hono';
import { Hono } from 'hono';
import { stream } from 'hono/streaming';
import { z } from 'zod';
import { exportJson } from '../services/exportFile.ts';
import { ProgressChanges } from '../services/progress.ts';
import {
  NewProject,
  NewProjectPreview,
  ProjectChanges,
  ProjectRegenerate,
  ProjectSave,
  SuggestedChanges,
} from '../services/projectBodies.ts';
import type { ProjectService, Result } from '../services/projects.ts';
import { valid } from './validate.ts';

const ById = z.object({ id: z.uuid() });
const ByCorner = ById.extend({ corner: z.enum(geometry.CORNERS) });

/** Every project route answers a failed result the same way. */
function failure(c: Context, result: Extract<Result<unknown>, { ok: false }>) {
  switch (result.error) {
    case 'not-found':
      return c.json({ error: result.error }, 404);
    case 'unknown-template':
      return c.json({ error: result.error }, 400);
    case 'missing-template':
    case 'unreadable-snapshot':
      return c.json({ error: result.error }, 500);
    case 'invalid-project':
      return c.json({ error: result.error, issues: result.issues }, 422);
    case 'unknown-progress':
      return c.json({ error: result.error, items: result.items }, 422);
    case 'unknown-suggestion':
      return c.json({ error: result.error, fields: result.fields }, 422);
    case 'stale-project':
      return c.json({ error: result.error, revision: result.revision }, 409);
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
    .put('/projects/:id', valid('param', ById), valid('json', ProjectSave), async (c) => {
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
    .post(
      '/projects/:id/regenerate',
      valid('param', ById),
      valid('json', ProjectRegenerate),
      async (c) => {
        const result = await projects.regenerate(c.req.valid('param').id, c.req.valid('json'));
        return result.ok ? c.json(result.value, 200) : failure(c, result);
      },
    )
    .get('/projects/:id/drawings', valid('param', ById), async (c) => {
      const result = await projects.drawings(c.req.valid('param').id);
      return result.ok ? c.json(result.value, 200) : failure(c, result);
    })
    .get('/projects/:id/views/:corner', valid('param', ByCorner), async (c) => {
      const { id, corner } = c.req.valid('param');
      const result = await projects.views(id, corner);
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
    .patch(
      '/projects/:id/suggested',
      valid('param', ById),
      valid('json', SuggestedChanges),
      async (c) => {
        const result = await projects.confirmSuggested(
          c.req.valid('param').id,
          c.req.valid('json'),
        );
        return result.ok ? c.json(result.value, 200) : failure(c, result);
      },
    )
    .delete('/projects/:id', valid('param', ById), async (c) => {
      const result = await projects.remove(c.req.valid('param').id);
      return result.ok ? c.body(null, 204) : failure(c, result);
    })
    .get('/trash', async (c) => c.json({ projects: await projects.trash() }))
    .post('/trash/:id/restore', valid('param', ById), async (c) => {
      const result = await projects.restore(c.req.valid('param').id);
      return result.ok ? c.body(null, 204) : failure(c, result);
    })
    .delete('/trash/:id', valid('param', ById), async (c) => {
      const result = await projects.purgeOne(c.req.valid('param').id);
      return result.ok ? c.body(null, 204) : failure(c, result);
    })
    .get('/export', async (c) => {
      const exported = await projects.exportAll();
      const day = exported.exportedAt.slice(0, 10);
      c.header('Content-Disposition', `attachment; filename="kerf-${day}.json"`);
      c.header('Content-Type', 'application/json; charset=UTF-8');
      // Read in full before the first byte, so a database error is still a 500, not a cut file.
      return stream(c, async (out) => {
        for (const piece of exportJson(exported)) {
          if (out.aborted) return;
          await out.write(piece);
        }
      });
    });
}
