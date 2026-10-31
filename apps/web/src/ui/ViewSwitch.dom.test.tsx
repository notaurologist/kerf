// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { click, mount } from '../test/dom.tsx';
import { type View, ViewSwitch } from './ViewSwitch.tsx';

const assembled: View = {
  id: 'a',
  label: 'Assembled',
  action: 'Assemble',
  content: <p>Drawing A</p>,
};
const exploded: View = { id: 'b', label: 'Exploded', action: 'Explode', content: <p>Drawing B</p> };

const shownText = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLElement>('.k-views__view')]
    .filter((v) => !v.hidden)
    .map((v) => v.querySelector('p')?.textContent);

const buttons = (container: HTMLElement) => [...container.querySelectorAll('button')];

describe('ViewSwitch', () => {
  it('shows the first view, with one button naming what it does next, and keeps the other in the page', () => {
    const { container } = mount(<ViewSwitch views={[assembled, exploded]} />);
    expect(buttons(container).map((b) => b.textContent)).toEqual(['Explode']);
    expect(buttons(container)[0]?.hasAttribute('aria-pressed')).toBe(false);
    expect(container.querySelector('[role="group"]')).toBeNull();
    expect(shownText(container)).toEqual(['Drawing A']);
    expect(container.textContent).toContain('Drawing B');
  });

  it('switches in place and back, the label naming the other view, without changing the address', async () => {
    window.history.replaceState(null, '', '#/projects/abc/diagrams');
    const entries = window.history.length;
    const { container } = mount(<ViewSwitch views={[assembled, exploded]} />);
    await click(buttons(container)[0] as HTMLElement);
    expect(shownText(container)).toEqual(['Drawing B']);
    expect(buttons(container).map((b) => b.textContent)).toEqual(['Assemble']);
    expect(buttons(container)[0]?.hasAttribute('aria-pressed')).toBe(false);
    expect(window.location.hash).toBe('#/projects/abc/diagrams');
    expect(window.history.length).toBe(entries);
    await click(buttons(container)[0] as HTMLElement);
    expect(shownText(container)).toEqual(['Drawing A']);
    expect(buttons(container).map((b) => b.textContent)).toEqual(['Explode']);
  });

  it('names the view asked for while another is still on screen', async () => {
    const asked: string[] = [];
    const { container } = mount(
      <ViewSwitch
        views={[assembled, exploded]}
        control={{ asked: 'b', shown: 'a', press: (id) => asked.push(id) }}
      />,
    );
    expect(buttons(container).map((b) => b.textContent)).toEqual(['Assemble']);
    expect(shownText(container)).toEqual(['Drawing A']);
    await click(buttons(container)[0] as HTMLElement);
    expect(asked).toEqual(['a']);
  });

  it('shows a lone view under its heading, with no button', () => {
    const { container } = mount(<ViewSwitch views={[exploded]} />);
    expect(container.querySelector('button')).toBeNull();
    expect(container.querySelector('h3')?.textContent).toBe('Exploded');
    expect(container.textContent).toContain('Drawing B');
  });
});
