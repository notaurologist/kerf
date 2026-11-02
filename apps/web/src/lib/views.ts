import { geometry } from '@kerf/core';
import { type ApiResult, api, send } from './api.ts';

const CornerViews = geometry.Drawings.pick({ isometric: true, exploded: true });
export type CornerViews = Pick<geometry.Drawings, 'isometric' | 'exploded'>;

/**
 * A plan's assembled and exploded views from one corner (#364), drawn by the API on read and
 * parsed with core's schema (hard rule 8).
 */
export async function loadCornerViews(
  id: string,
  corner: geometry.Corner,
): Promise<ApiResult<CornerViews>> {
  const result = await send(
    api.api.projects[':id'].views[':corner'].$get({ param: { id, corner } }),
  );
  if (!result.ok) return result;
  const parsed = CornerViews.safeParse(result.value);
  return parsed.success
    ? { ok: true, value: parsed.data }
    : {
        ok: false,
        error: {
          kind: 'failed',
          status: 200,
          message: 'The drawings the server sent could not be read.',
        },
      };
}
