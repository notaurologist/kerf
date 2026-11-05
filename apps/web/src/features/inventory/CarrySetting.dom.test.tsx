// @vitest-environment happy-dom
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { click, mount, settle } from '../../test/dom.tsx';
import { CarryEditor, readCarry } from './CarrySetting.tsx';

// The longest board the owner can carry (#690), entered once on My toolbox.

const sent: unknown[] = [];
afterEach(() => {
  sent.length = 0;
  vi.unstubAllGlobals();
});

function stubSave(status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      sent.push(body);
      const reply =
        status === 409
          ? { error: 'stale-settings', revision: body.revision + 1 }
          : { ...body, revision: body.revision + 1 };
      return new Response(JSON.stringify(reply), {
        status,
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
}

async function typeInto(input: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

const saveButton = (container: HTMLElement) =>
  [...container.querySelectorAll('button')].find(
    (b) => b.textContent?.trim() === 'Save',
  ) as HTMLButtonElement;

describe('readCarry', () => {
  it('reads feet and inches, empty as no limit, and refuses what is not a length over 0', () => {
    expect(readCarry("8'")).toEqual({ ok: true, value: 96 });
    expect(readCarry('97-1/2')).toEqual({ ok: true, value: 97.5 });
    expect(readCarry('  ')).toEqual({ ok: true, value: null });
    expect(readCarry('0')).toMatchObject({ ok: false });
    expect(readCarry('eight')).toMatchObject({ ok: false });
  });
});

describe('CarryEditor', () => {
  it('shows the saved length, saves a new one in inches, and clears it', async () => {
    stubSave();
    const saved = vi.fn();
    const { container } = mount(
      <CarryEditor saved={{ carryLength: 96, revision: 3 }} onSaved={saved} />,
    );
    const input = container.querySelector('#carry-length') as HTMLInputElement;
    expect(input.value).toBe('96');
    await typeInto(input, "10'");
    await click(saveButton(container));
    await settle();
    expect(sent).toEqual([{ carryLength: 120, revision: 3 }]);
    expect(saved).toHaveBeenCalledWith({ carryLength: 120, revision: 4 });

    await typeInto(input, '');
    await click(saveButton(container));
    await settle();
    expect(sent.at(-1)).toEqual({ carryLength: null, revision: 3 });
  });

  it('saves nothing it cannot read, and says what to enter', async () => {
    stubSave();
    const { container } = mount(
      <CarryEditor saved={{ carryLength: null, revision: 1 }} onSaved={() => {}} />,
    );
    await typeInto(container.querySelector('#carry-length') as HTMLInputElement, 'eight');
    await click(saveButton(container));
    await settle();
    expect(sent).toEqual([]);
    expect(container.textContent).toContain('Kerf cannot read this');
  });

  it('says when the setting was saved on another device, saving nothing over it', async () => {
    stubSave(409);
    const { container } = mount(
      <CarryEditor saved={{ carryLength: null, revision: 1 }} onSaved={() => {}} />,
    );
    await typeInto(container.querySelector('#carry-length') as HTMLInputElement, "8'");
    await click(saveButton(container));
    await settle();
    expect(container.textContent).toContain('Changed on another device.');
  });
});
