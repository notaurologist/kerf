import { createSnapshot, GLOSSARY, readSnapshot, TEMPLATES, TOOL_TYPES } from '@kerf/core';
import {
  BRAND_EXCEPTIONS,
  BRAND_NAMES,
  VERDICT_WORDS,
  withoutBrandExceptions,
} from '@kerf/core/testing';
import { describe, expect, it } from 'vitest';
import { Screen } from './App.tsx';
import { GlossaryScreen } from './features/glossary/GlossaryScreen.tsx';
import { fromInventory } from './features/inventory/draft.ts';
import { ToolPage } from './features/inventory/ToolPage.tsx';
import { ToolsEditor } from './features/inventory/ToolsScreen.tsx';
import { LoginForm } from './features/login/LoginScreen.tsx';
import { ModeView, Waiting } from './features/modes/modes.tsx';
import { ProjectView } from './features/project/ProjectScreen.tsx';
import { EditProject } from './features/project-editor/EditProject.tsx';
import { ProjectEditor } from './features/project-editor/ProjectEditor.tsx';
import { StartChoice } from './features/project-editor/StartChoice.tsx';
import { newTitle, startValues } from './features/project-editor/start.ts';
import { ProjectList } from './features/projects/ProjectsScreen.tsx';
import { TemplateList } from './features/projects/TemplatePicker.tsx';
import { TrashList } from './features/projects/TrashScreen.tsx';
import { WorkshopScreen } from './features/workshop/WorkshopScreen.tsx';
import type { ApiError, ApiResult } from './lib/api.ts';
import { ErrorBoundary } from './lib/ErrorBoundary.tsx';
import { Loaded } from './lib/Loaded.tsx';
import { type SavedTick, TickQueue } from './lib/ticks.ts';
import type { Project, ProjectStatus, TrashedProject } from './lib/types.ts';
import {
  loadedDrawings,
  loadedStepDrawing,
  noTicks,
  projectFrom,
  stepsFor,
  storedSnapshots,
} from './test/projects.ts';
import { render, renderText, textOf } from './test/render.tsx';

// Hard rules 2 and 11 over everything a reader sees, on every route's screen: the whole plan
// (its build steps, flags, board guides, hardware notes and review) for each stored swing set
// fixture and for every template's worked examples at its current version; Shopping and Building
// on each worked example, every step and every cut card, with no tools and with every tool; the
// editor, the new-project start, the projects list, the template picker, deleted projects, the
// toolbox and each tool's page, Workshop, the login, every glossary page; and the problem screens
// and notices for each error the API can answer.

/** A worked example as the API returns it: generated, stored as JSON, and read back. */
function currentSnapshot(t: (typeof TEMPLATES)[number], e: (typeof t.examples)[number]) {
  const made = createSnapshot(t, e.params, e.structuralInputs);
  if (!made.ok) throw new Error(JSON.stringify(made.issues));
  const read = readSnapshot(TEMPLATES, JSON.parse(JSON.stringify(made.output)));
  if (!read.ok) throw new Error(read.message);
  return read.snapshot as NonNullable<Project['snapshot']>;
}

const examples = TEMPLATES.flatMap((t) =>
  t.examples.map((e, index) => ({ t, e, index, snapshot: currentSnapshot(t, e) })),
);

const NO_TOOLS = { tools: [] };
/** One of every tool in the library, each with no details entered yet. */
const EVERY_TOOL = { tools: TOOL_TYPES.map((type) => ({ toolTypeId: type.id, capabilities: {} })) };

function exampleProject(
  { t, snapshot }: (typeof examples)[number],
  inventory: { tools: { toolTypeId: string; capabilities: Record<string, never> }[] },
  status: ProjectStatus = 'planned',
): Project {
  return projectFrom(snapshot, {
    templateId: t.id,
    templateVersion: t.version,
    version: { status: 'current', version: t.version },
    steps: stepsFor(snapshot, inventory),
    status,
  });
}

/** Shopping, the list of steps, and every step and cut card in Building, for one project. */
function modePages(name: string, p: Project) {
  const drawings = loadedDrawings(p);
  const view = (route: Parameters<typeof ModeView>[0]['route'], stepId?: string) => (
    <ModeView
      route={route}
      project={p}
      drawings={drawings}
      stepDrawing={stepId === undefined ? undefined : loadedStepDrawing(p, stepId)}
    />
  );
  const steps: { id: string }[] = p.steps?.steps ?? [];
  expect(steps.length).toBeGreaterThan(0);
  return [
    { name: `Shopping for ${name}`, text: renderText(view({ screen: 'shop', id: p.id })) },
    {
      name: `the steps of ${name}`,
      text: renderText(view({ screen: 'build-steps', id: p.id })),
    },
    ...steps.flatMap(({ id: step }) => {
      const html = render(view({ screen: 'build-step', id: p.id, step }, step));
      const cards = [
        ...new Set(
          [...html.matchAll(new RegExp(`#/projects/${p.id}/build/${step}/([^"/]+)"`, 'g'))].map(
            (m) => m[1] as string,
          ),
        ),
      ];
      return [
        { name: `step ${step} of ${name}`, text: textOf(html) },
        ...cards.map((part) => ({
          name: `the cut card for ${part}, step ${step} of ${name}`,
          text: renderText(view({ screen: 'build-part', id: p.id, step, part })),
        })),
      ];
    }),
  ];
}

/** Every error the API client can give, as the screens receive it. */
const API_ERRORS: ApiError[] = [
  { kind: 'login-required' },
  { kind: 'wrong-password' },
  { kind: 'rate-limited', retryAfterSeconds: null },
  { kind: 'rate-limited', retryAfterSeconds: 900 },
  { kind: 'invalid', issues: [{ field: 'name', message: 'is required' }] },
  { kind: 'not-found' },
  { kind: 'stale', revision: 2 },
  { kind: 'failed', status: 0, message: 'Kerf could not reach the server.' },
  { kind: 'failed', status: 500, message: 'The request failed.' },
];

type TickAnswer = ApiResult<{ ticks: SavedTick[]; status: ProjectStatus }>;

/** What Building and Shopping say about ticks after the server gives `answer` to `count` of them. */
async function waitingAfter(answer: TickAnswer, count: number): Promise<string> {
  const queue = new TickQueue(async () => answer, { set: () => null, clear: () => {} });
  for (let i = 0; i < count; i++) queue.set({ kind: 'step', key: `step-${i}` }, true);
  await queue.flush();
  return renderText(<Waiting ticks={{ ...noTicks, ...queue.getState() }} />);
}

const tickAnswers: { name: string; answer: TickAnswer }[] = [
  ...API_ERRORS.map((error) => ({
    name: `${error.kind} ${'status' in error ? error.status : ''}`,
    answer: { ok: false as const, error },
  })),
  {
    name: 'invalid, items gone from the plan',
    answer: {
      ok: false,
      error: {
        kind: 'invalid',
        issues: [],
        items: [
          { kind: 'step', key: 'step-0' },
          { kind: 'step', key: 'step-1' },
        ],
      },
    },
  },
];

const trashed: TrashedProject = {
  id: '6f1c2a3e-0000-4000-8000-000000000001',
  name: 'Backyard swing set',
  status: 'planned',
  templateId: 'swing-set-a-frame',
  templateVersion: 2,
  revision: 1,
  templateBehind: false,
  progress: null,
  createdAt: '2026-10-01T12:00:00.000Z',
  updatedAt: '2026-10-01T12:00:00.000Z',
  deletedAt: '2026-10-28T12:00:00.000Z',
  purgeAt: '2026-11-27T12:00:00.000Z',
};

const boundary = new ErrorBoundary({ children: null });
boundary.state = { failed: true };

const pages = [
  ...storedSnapshots.map((snapshot, i) => ({
    name: `the plan for stored example ${i}`,
    text: renderText(
      <ProjectView
        project={projectFrom(snapshot)}
        drawings={loadedDrawings(projectFrom(snapshot))}
      />,
    ),
  })),
  ...examples.map((x) => {
    const p = exampleProject(x, NO_TOOLS);
    return {
      name: `the plan for ${x.t.id}, ${x.e.name}`,
      text: renderText(<ProjectView project={p} drawings={loadedDrawings(p)} />),
    };
  }),
  ...examples.flatMap((x) => [
    ...modePages(`${x.t.id}, ${x.e.name}, no tools`, exampleProject(x, NO_TOOLS)),
    // The methods follow the tools; each template's first example is enough to show them all.
    ...(x.index === 0
      ? modePages(`${x.t.id}, ${x.e.name}, every tool`, exampleProject(x, EVERY_TOOL))
      : []),
  ]),
  ...TEMPLATES.flatMap((t) =>
    [undefined, ...t.examples.map((_, index) => ({ kind: 'example' as const, index }))].flatMap(
      (from) => {
        const start = startValues(t, from, null);
        if (!start.ok) return [];
        return [
          {
            name: `a new ${t.id}, ${from ? `from example ${from.index}` : 'empty'}`,
            text: renderText(<ProjectEditor template={t} initial={start.initial} />),
          },
        ];
      },
    ),
  ),
  ...examples.map((x) => ({
    name: `Edit for ${x.t.id}, ${x.e.name}`,
    text: renderText(<EditProject project={exampleProject(x, NO_TOOLS)} onReload={() => {}} />),
  })),
  ...TEMPLATES.map((t) => ({
    name: `how to start a new ${t.id}`,
    text: renderText(<StartChoice template={t} title={newTitle(t)} earlier={[]} />),
  })),
  {
    name: 'the projects list',
    text: renderText(
      <ProjectList
        projects={examples.map((x, i) =>
          exampleProject(x, NO_TOOLS, i % 2 === 0 ? 'planned' : 'in-progress'),
        )}
        templates={[]}
      />,
    ),
  },
  {
    name: 'the empty projects list',
    text: renderText(<ProjectList projects={[]} templates={[]} />),
  },
  {
    name: 'the template picker',
    text: renderText(
      <TemplateList
        templates={TEMPLATES.map((t) => ({
          id: t.id,
          version: t.version,
          name: t.name,
          description: t.description,
        }))}
      />,
    ),
  },
  {
    name: 'deleted projects',
    text: renderText(<TrashList projects={[trashed]} onGone={() => {}} />),
  },
  { name: 'no deleted projects', text: renderText(<TrashList projects={[]} onGone={() => {}} />) },
  {
    name: 'the empty toolbox',
    text: renderText(<ToolsEditor saved={fromInventory(NO_TOOLS)} revision={1} />),
  },
  {
    name: 'the full toolbox',
    text: renderText(<ToolsEditor saved={fromInventory(EVERY_TOOL)} revision={1} />),
  },
  ...TOOL_TYPES.map((type) => ({
    name: `the page for ${type.id}`,
    text: renderText(<ToolPage id={type.id} />),
  })),
  { name: 'Workshop', text: renderText(<WorkshopScreen onLogOut={() => {}} />) },
  ...[null, ...API_ERRORS].map((error) => ({
    name: `the login, ${error?.kind ?? 'no error'}`,
    text: renderText(<LoginForm busy={false} error={error} onSubmit={() => {}} />),
  })),
  { name: 'the glossary index', text: renderText(<GlossaryScreen />) },
  ...GLOSSARY.map((entry) => ({
    name: `the glossary entry ${entry.id}`,
    text: renderText(<GlossaryScreen term={entry.id} />),
  })),
  {
    name: 'a page that is not there',
    text: renderText(<Screen route={{ screen: 'not-found' }} />),
  },
  { name: 'a page that could not be shown', text: renderText(boundary.render()) },
  ...API_ERRORS.map((error) => ({
    name: `a screen that did not load, ${error.kind}`,
    text: renderText(
      <Loaded
        state={{ state: 'error', error }}
        loading="Loading…"
        onRetry={() => {}}
        title="Project"
      />,
    ),
  })),
  ...(await Promise.all(
    tickAnswers.flatMap(({ name, answer }) =>
      [1, 2].map(async (count) => ({
        name: `ticks waiting, ${count}, ${name}`,
        text: await waitingAfter(answer, count),
      })),
    ),
  )),
];

describe('copy on every page', () => {
  it.each(pages)('$name gives no verdicts', ({ text }) => {
    expect(text.length).toBeGreaterThan(0);
    expect(text.match(VERDICT_WORDS)?.[0]).toBeUndefined();
  });

  it.each(pages)('$name names no brands', ({ text }) => {
    expect(withoutBrandExceptions(text).match(BRAND_NAMES)?.[0]).toBeUndefined();
  });

  it.each(BRAND_EXCEPTIONS)('still needs the exception for "$text"', ({ text }) => {
    expect(pages.some((page) => page.text.includes(text))).toBe(true);
  });
});
