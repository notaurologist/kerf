// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { frameFor } from '../App.tsx';
import { mount } from '../test/dom.tsx';
import { type Back, Frame, type FrameProject, useFrameProject } from './Shell.tsx';

const places = [
  { label: 'Projects', href: '#/projects', icon: 'projects', current: 'true' },
  { label: 'Tools', href: '#/tools', icon: 'tools' },
  { label: 'Glossary', href: '#/glossary', icon: 'glossary' },
] as const;

const project: FrameProject = {
  name: 'Backyard swing set',
  href: '#/projects/p1',
  sections: {
    items: [
      { id: 'summary', title: 'Summary', href: '#/projects/p1' },
      { id: 'structural', title: 'Structural review', href: '#/projects/p1/structural' },
    ],
    current: 'structural',
  },
};

function Screen(props: { project: FrameProject }) {
  useFrameProject(props.project);
  return <p>Plan</p>;
}

const mountFrame = (screen: FrameProject | null, back: Back) =>
  mount(
    <Frame brandHref="#/projects" places={places} back={back} actions={null}>
      {screen && <Screen project={screen} />}
    </Frame>,
  ).container;

describe('the frame with a project open', () => {
  it('lists the project and its sections under Projects, marking the section on screen', () => {
    const frame = mountFrame(project, { label: 'Projects', href: '#/projects' });
    const sidebar = frame.querySelector('.k-sidebar');
    expect(sidebar?.textContent).toBe(
      'ProjectsBackyard swing setSummaryStructural reviewToolsGlossary',
    );
    expect(sidebar?.querySelector('[aria-current="page"]')?.textContent).toBe('Structural review');
    expect(sidebar?.querySelector('a[href="#/projects/p1"]')?.getAttribute('aria-current')).toBe(
      'true',
    );
    expect(frame.querySelector('.k-titlebar__title')?.textContent).toBe('Backyard swing set');
    // The plan's own contents column gives way to the sidebar's list.
    expect(frame.querySelector('.k-frame')?.hasAttribute('data-sections')).toBe(true);
  });

  it('names the project in the editor back link, and forgets it when the screen goes', () => {
    const { name, href } = project;
    const view = mount(
      <Frame brandHref="#/projects" places={places} back="project" actions={null}>
        <Screen project={{ name, href }} />
      </Frame>,
    );
    const back = view.container.querySelector('.k-titlebar__back');
    expect(back?.getAttribute('href')).toBe('#/projects/p1');
    expect(back?.textContent).toBe('Backyard swing set');
    expect(view.container.querySelector('.k-frame')?.hasAttribute('data-sections')).toBe(false);
    view.rerender(
      <Frame brandHref="#/projects" places={places} back="project" actions={null}>
        {null}
      </Frame>,
    );
    expect(view.container.querySelector('.k-sidebar')?.textContent).toBe('ProjectsToolsGlossary');
  });
});

describe('frameFor', () => {
  it('puts each screen in its place, with a back link below the top', () => {
    expect(frameFor({ screen: 'projects' })).toEqual({ place: 'projects', top: true });
    expect(frameFor({ screen: 'tools' })).toEqual({ place: 'tools', top: true });
    expect(frameFor({ screen: 'glossary' })).toEqual({ place: 'glossary', top: true });
    expect(frameFor({ screen: 'tools', tool: 'rafter-square' })).toEqual({
      place: 'tools',
      top: false,
      back: { label: 'Tools', href: '#/tools' },
    });
    expect(frameFor({ screen: 'project', id: 'p1' })).toEqual({
      place: 'projects',
      top: false,
      back: { label: 'Projects', href: '#/projects' },
    });
    expect(frameFor({ screen: 'edit-project', id: 'p1' })).toEqual({
      place: 'projects',
      top: false,
      back: 'project',
    });
  });
});
