import type { InferResponseType } from 'hono/client';
import type { api } from './api.ts';

// Response types from the API's routes, named for the screens that use them.

export type ProjectSummary = InferResponseType<
  typeof api.api.projects.$get,
  200
>['projects'][number];
export type Project = InferResponseType<(typeof api.api.projects)[':id']['$get'], 200>;
export type TemplateSummary = InferResponseType<
  typeof api.api.templates.$get,
  200
>['templates'][number];
export type ProjectStatus = ProjectSummary['status'];

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  planned: 'Planned',
  'in-progress': 'In progress',
  built: 'Built',
};

export const STATUSES = Object.keys(STATUS_LABELS) as ProjectStatus[];
