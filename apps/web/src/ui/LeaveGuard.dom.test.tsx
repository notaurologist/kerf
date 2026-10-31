// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { useRoute } from '../lib/route.ts';
import { byText, click, goTo, mount } from '../test/dom.tsx';
import { useDraft } from './LeaveGuard.tsx';

function Screen() {
  const route = useRoute();
  const { setDraft, dialog } = useDraft('saved');
  return (
    <>
      <p id="screen">{route.screen}</p>
      <a href="#/tools">Tools</a>
      <button type="button" onClick={() => setDraft('changed')}>
        Change
      </button>
      {dialog}
    </>
  );
}

const screen = () => document.getElementById('screen')?.textContent;
const dialog = () => document.querySelector('dialog') as HTMLDialogElement;

beforeEach(() => {
  window.history.replaceState(null, '', '#/projects');
});

describe('the leave guard', () => {
  it('lets a link change the screen when nothing is unsaved', async () => {
    const { container } = mount(<Screen />);
    await click(byText(container, 'a', 'Tools'));
    expect(window.location.hash).toBe('#/tools');
    expect(screen()).toBe('tools');
    expect(dialog().open).toBe(false);
  });

  it('asks before a link leaves unsaved changes, without touching the address', async () => {
    const { container } = mount(<Screen />);
    await click(byText(container, 'button', 'Change'));
    const entries = window.history.length;
    await click(byText(container, 'a', 'Tools'));
    expect(dialog().open).toBe(true);
    expect(window.location.hash).toBe('#/projects');
    expect(window.history.length).toBe(entries);
    await click(byText(container, 'button', 'Keep editing'));
    expect(dialog().open).toBe(false);
    expect(screen()).toBe('projects');
  });

  it('follows the link once the owner chooses to leave', async () => {
    const { container } = mount(<Screen />);
    await click(byText(container, 'button', 'Change'));
    await click(byText(container, 'a', 'Tools'));
    await click(byText(container, 'button', 'Leave without saving'));
    expect(window.location.hash).toBe('#/tools');
    expect(screen()).toBe('tools');
  });

  it('puts the address back on Back and asks', async () => {
    const { container } = mount(<Screen />);
    await click(byText(container, 'button', 'Change'));
    await goTo('#/tools');
    expect(window.location.hash).toBe('#/projects');
    expect(screen()).toBe('projects');
    expect(dialog().open).toBe(true);
    await click(byText(container, 'button', 'Leave without saving'));
    expect(screen()).toBe('tools');
  });

  it('asks the browser to confirm closing the page only while changes are unsaved', async () => {
    const { container } = mount(<Screen />);
    const unload = () => {
      const e = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(e);
      return e.defaultPrevented;
    };
    expect(unload()).toBe(false);
    await click(byText(container, 'button', 'Change'));
    expect(unload()).toBe(true);
  });
});
