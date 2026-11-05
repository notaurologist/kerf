// @vitest-environment happy-dom
import type { geometry } from '@kerf/core';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '../test/dom.tsx';
import { Contained } from './Contained.tsx';
import { Diagram } from './Diagram.tsx';
import { PlanSection } from './Section.tsx';

// One part of a screen that throws while rendering says so in its place; the rest stays.

let broken = true;
function Breaks(props: { text: string }): string {
  if (broken) throw new Error('render failed');
  return props.text;
}

beforeEach(() => {
  broken = true;
  // React reports each caught render error on the console.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

const NOTICE = 'Kerf could not show this section. Reload the page to try again.';

describe('Contained', () => {
  it('keeps the section heading and the other sections when one section throws', () => {
    const { container } = mount(
      <>
        <PlanSection id="cut-list" title="Cut list" project="Swing set">
          <Breaks text="Rails" />
        </PlanSection>
        <PlanSection id="boards" title="Boards" project="Swing set">
          Two 2x6 boards
        </PlanSection>
      </>,
    );
    const [first, second] = container.querySelectorAll('section');
    expect(first?.querySelector('h2')?.textContent).toBe('Cut list');
    expect(first?.textContent).toContain(NOTICE);
    expect(second?.textContent).toContain('Two 2x6 boards');
    expect(second?.textContent).not.toContain('could not show');
  });

  it('shows one drawing that throws as a line in its place', () => {
    const malformed = { title: 'Rail', bounds: { x: 0, y: 0, width: 1, height: 1 } };
    const { container } = mount(
      <>
        <Diagram drawing={malformed as geometry.Drawing} label="Rail" assumedWidth={343} />
        <p>The rest of the step</p>
      </>,
    );
    expect(container.textContent).toContain(
      'Kerf could not show this drawing. Reload the page to try again.',
    );
    expect(container.textContent).toContain('The rest of the step');
  });

  it('tries again when the address changes', () => {
    const { container } = mount(
      <Contained what="section">
        <Breaks text="Rails" />
      </Contained>,
    );
    expect(container.textContent).toBe(NOTICE);
    broken = false;
    act(() => {
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(container.textContent).toBe('Rails');
  });
});
