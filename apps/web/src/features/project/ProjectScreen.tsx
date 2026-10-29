import { findTemplate } from '@kerf/core';
import { Notice } from '../../components/Shell.tsx';
import { api, describeError, send } from '../../lib/api.ts';
import { readPlan } from '../../lib/plan.ts';
import { href } from '../../lib/route.ts';
import { type Project, STATUS_LABELS } from '../../lib/types.ts';
import { useLoad } from '../../lib/useLoad.ts';
import { CutList } from '../cut-list/CutList.tsx';
import { ShoppingList } from '../shopping-list/ShoppingList.tsx';
import { StructuralReview } from '../structural/StructuralReview.tsx';
import { DeleteProject } from './DeleteProject.tsx';
import { VersionNotice } from './VersionNotice.tsx';

// One project, rendered from the snapshot the API returns (ARCHITECTURE.md, apps/web). The
// stored plan is shown as stored; the web app computes none of its numbers.

export function ProjectScreen(props: { id: string }) {
  const { loaded, set } = useLoad(
    () => send(api.api.projects[':id'].$get({ param: { id: props.id } })),
    props.id,
  );
  if (loaded.state === 'loading') return <Notice>Loading project…</Notice>;
  if (loaded.state === 'error') return <Notice tone="error">{describeError(loaded.error)}</Notice>;
  return <ProjectView project={loaded.value} onChange={set} />;
}

export function ProjectView(props: { project: Project; onChange?: (project: Project) => void }) {
  const { project } = props;
  const template = findTemplate(project.templateId);
  const plan = readPlan(project);
  return (
    <article className="project">
      <header className="project-header">
        <h1>{project.name}</h1>
        <p className="muted">
          {STATUS_LABELS[project.status]}. {template?.name ?? project.templateId}, version{' '}
          {project.templateVersion}.{' '}
          {plan.ok && <a href={href({ screen: 'edit-project', id: project.id })}>Edit</a>}
        </p>
      </header>
      <VersionNotice project={project} onRegenerated={(p) => props.onChange?.(p)} />
      {!plan.ok ? (
        <Notice tone="error">{plan.message}</Notice>
      ) : (
        <>
          <nav className="jump row" aria-label="Sections">
            <button type="button" className="link" onClick={() => jump('cut-list')}>
              Cut list
            </button>
            <button type="button" className="link" onClick={() => jump('shopping-list')}>
              Shopping list
            </button>
            <button type="button" className="link" onClick={() => jump('structural-review')}>
              Structural review
            </button>
          </nav>
          <section id="cut-list">
            <h2>Cut list</h2>
            <p className="muted">
              Lengths are long point to long point, rounded to 1/16". Angles are miter-saw settings
              (0° is square), with the angle to the board's edge for a protractor or sliding bevel.
            </p>
            <CutList rows={plan.plan.cutList} />
          </section>
          <section id="shopping-list">
            <h2>Shopping list</h2>
            <ShoppingList
              lumber={plan.plan.lumber}
              hardware={plan.plan.hardware}
              hardwareNotes={plan.plan.hardwareNotes}
            />
          </section>
          <section id="structural-review">
            <h2>Structural review</h2>
            <StructuralReview
              projectId={project.id}
              checks={plan.plan.checks}
              flags={plan.plan.flags}
              checklist={plan.plan.checklist}
            />
          </section>
        </>
      )}
      <DeleteProject id={project.id} name={project.name} />
    </article>
  );
}

/** Scrolls to a section. The hash picks the screen, so in-page jumps cannot use it. */
function jump(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
