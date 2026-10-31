// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { click, mount } from '../test/dom.tsx';
import { BlockingDialog, ConfirmDialog } from './Dialog.tsx';

function confirm(open: boolean, onStay = () => {}, onLeave = () => {}) {
  return (
    <ConfirmDialog
      open={open}
      title="Leave without saving?"
      stay="Keep editing"
      leave="Leave without saving"
      onStay={onStay}
      onLeave={onLeave}
    >
      Your changes will be lost.
    </ConfirmDialog>
  );
}

describe('ConfirmDialog', () => {
  it('opens as a modal when asked and closes when no longer asked', () => {
    const { container, rerender } = mount(confirm(false));
    const dialog = container.querySelector('dialog');
    expect(dialog?.open).toBe(false);
    rerender(confirm(true));
    expect(dialog?.open).toBe(true);
    rerender(confirm(false));
    expect(dialog?.open).toBe(false);
  });

  it('treats Escape as the safe choice and leaves closing to the caller', () => {
    const onStay = vi.fn();
    const { container } = mount(confirm(true, onStay));
    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    const cancel = new Event('cancel', { cancelable: true });
    dialog.dispatchEvent(cancel);
    expect(cancel.defaultPrevented).toBe(true);
    expect(onStay).toHaveBeenCalledOnce();
    expect(dialog.open).toBe(true);
  });

  it('calls each choice from its own button', async () => {
    const onStay = vi.fn();
    const onLeave = vi.fn();
    const { container } = mount(confirm(true, onStay, onLeave));
    const [stay, leave] = container.querySelectorAll('button');
    await click(stay as HTMLButtonElement);
    expect(onStay).toHaveBeenCalledOnce();
    await click(leave as HTMLButtonElement);
    expect(onLeave).toHaveBeenCalledOnce();
  });
});

describe('BlockingDialog', () => {
  it('opens on mount and stays open on Escape', () => {
    const { container } = mount(<BlockingDialog title="Signed out">Log in again.</BlockingDialog>);
    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    expect(dialog.open).toBe(true);
    const cancel = new Event('cancel', { cancelable: true });
    dialog.dispatchEvent(cancel);
    expect(cancel.defaultPrevented).toBe(true);
    expect(dialog.open).toBe(true);
  });
});
