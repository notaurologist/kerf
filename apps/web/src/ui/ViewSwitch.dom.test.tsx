// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { byText, click, mount } from '../test/dom.tsx';
import { ViewSwitch } from './ViewSwitch.tsx';

const views = [
  { id: 'a', label: 'Assembled', content: <p>Drawing A</p> },
  { id: 'b', label: 'Exploded', content: <p>Drawing B</p> },
];

const shownText = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLElement>('.k-views__view')]
    .filter((v) => !v.hidden)
    .map((v) => v.querySelector('p')?.textContent);

describe('ViewSwitch', () => {
  it('shows the first view, with its button pressed, and keeps the others in the page', () => {
    const { container } = mount(<ViewSwitch label="Assembly view" views={views} />);
    const group = container.querySelector('[role="group"]');
    expect(group?.getAttribute('aria-label')).toBe('Assembly view');
    expect(byText(container, 'button', 'Assembled').getAttribute('aria-pressed')).toBe('true');
    expect(byText(container, 'button', 'Exploded').getAttribute('aria-pressed')).toBe('false');
    expect(shownText(container)).toEqual(['Drawing A']);
    expect(container.textContent).toContain('Drawing B');
  });

  it('switches in place, without changing the address or adding a history entry', async () => {
    window.history.replaceState(null, '', '#/projects/abc/diagrams');
    const entries = window.history.length;
    const { container } = mount(<ViewSwitch label="Assembly view" views={views} />);
    await click(byText(container, 'button', 'Exploded'));
    expect(shownText(container)).toEqual(['Drawing B']);
    expect(byText(container, 'button', 'Exploded').getAttribute('aria-pressed')).toBe('true');
    expect(byText(container, 'button', 'Assembled').getAttribute('aria-pressed')).toBe('false');
    expect(window.location.hash).toBe('#/projects/abc/diagrams');
    expect(window.history.length).toBe(entries);
    await click(byText(container, 'button', 'Assembled'));
    expect(shownText(container)).toEqual(['Drawing A']);
  });

  it('gives every button room for the tick, which shows on the pressed one', () => {
    const { container } = mount(<ViewSwitch label="Assembly view" views={views} />);
    expect(byText(container, 'button', 'Assembled').querySelector('.k-icon')).not.toBeNull();
    expect(byText(container, 'button', 'Exploded').querySelector('.k-icon')).not.toBeNull();
  });

  it('shows a lone view under its heading, with no control', () => {
    const { container } = mount(<ViewSwitch label="Assembly view" views={views.slice(1)} />);
    expect(container.querySelector('[role="group"]')).toBeNull();
    expect(container.querySelector('button')).toBeNull();
    expect(container.querySelector('h3')?.textContent).toBe('Exploded');
    expect(container.textContent).toContain('Drawing B');
  });
});
