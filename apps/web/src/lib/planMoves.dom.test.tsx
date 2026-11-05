// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '../test/dom.tsx';
import { usePlanMoves } from './planMoves.ts';

const rect = (top: number, height: number) =>
  ({ top, bottom: top + height, height, left: 0, right: 0, width: 0, x: 0, y: top }) as DOMRect;

function Plan(props: { section: string; focusId: string }) {
  usePlanMoves(props.section, props.focusId);
  return (
    <>
      <header className="k-titlebar" style={{ position: 'sticky' }} />
      <section>
        <h2 id={`${props.section}-heading`} tabIndex={-1}>
          {props.section}
        </h2>
        <h3 id="cut-detail-top" tabIndex={-1}>
          Top
        </h3>
        <a id="cut-list-top" href="#/top">
          Top
        </a>
      </section>
    </>
  );
}

let scrollTo: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// The page as a phone shows it: the title bar is 45 px tall and the target is 900 px down.
const layOut = () => {
  const bar = document.querySelector<HTMLElement>('.k-titlebar');
  if (!bar) throw new Error('no title bar');
  vi.spyOn(bar, 'getBoundingClientRect').mockReturnValue(rect(0, 45));
  for (const id of ['cut-detail-top', 'cut-list-top']) {
    const target = document.getElementById(id);
    if (!target) throw new Error(`no ${id}`);
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue(rect(900, 30));
  }
};

describe('usePlanMoves', () => {
  it('scrolls a heading further in to just below the title bar', () => {
    const { rerender } = mount(<Plan section="cut-list" focusId="cut-list-heading" />);
    layOut();
    rerender(<Plan section="diagrams" focusId="cut-detail-top" />);
    const heading = document.getElementById('cut-detail-top');
    expect(document.activeElement).toBe(heading);
    expect(scrollTo).toHaveBeenCalledWith({ top: window.scrollY + 900 - 45 - 12 });
  });

  it('centers a target that is not a heading', () => {
    const { rerender } = mount(<Plan section="diagrams" focusId="diagrams-heading" />);
    layOut();
    const link = document.getElementById('cut-list-top');
    if (!link) throw new Error('no link');
    const centered = vi.spyOn(link, 'scrollIntoView').mockImplementation(() => {});
    rerender(<Plan section="cut-list" focusId="cut-list-top" />);
    expect(document.activeElement).toBe(link);
    expect(centered).toHaveBeenCalledWith({ block: 'center' });
  });

  it('starts a new section at the top of the page', () => {
    const { rerender } = mount(<Plan section="cut-list" focusId="cut-list-heading" />);
    rerender(<Plan section="diagrams" focusId="diagrams-heading" />);
    expect(document.activeElement).toBe(document.getElementById('diagrams-heading'));
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
  });
});
