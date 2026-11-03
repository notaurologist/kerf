import { describe, expect, it } from 'vitest';
import { createLeaveGate } from './leave.ts';

function setup(start = '#/projects/1/edit') {
  let hash = start;
  const log: string[] = [];
  const gate = createLeaveGate({
    hash: () => hash,
    restore: (h) => {
      hash = h;
      log.push(`restore ${h}`);
    },
    go: (h) => {
      hash = h;
      log.push(`go ${h}`);
    },
  });
  const asked: (() => void)[] = [];
  const hold = () => gate.hold((go) => asked.push(go));
  const browse = (h: string) => {
    const from = hash;
    hash = h;
    return gate.follow(from);
  };
  return { gate, log, asked, hold, browse, hash: () => hash };
}

describe('leave gate', () => {
  it('follows Back at once when no draft is held', () => {
    const t = setup();
    expect(t.browse('#/projects')).toBe(true);
    expect(t.asked).toHaveLength(0);
  });

  it('puts the address back and asks on Back while a draft is held', () => {
    const t = setup();
    t.hold();
    expect(t.browse('#/projects')).toBe(false);
    expect(t.hash()).toBe('#/projects/1/edit');
    expect(t.log).toEqual(['restore #/projects/1/edit']);
    expect(t.asked).toHaveLength(1);
  });

  it('goes where Back pointed once the owner chooses to leave, and lets that hashchange through', () => {
    const t = setup();
    t.hold();
    t.browse('#/projects');
    t.asked[0]?.();
    expect(t.hash()).toBe('#/projects');
    expect(t.gate.follow('#/projects/1/edit')).toBe(true);
    expect(t.asked).toHaveLength(1);
  });

  it('stays when the owner keeps editing', () => {
    const t = setup();
    t.hold();
    t.browse('#/projects');
    expect(t.hash()).toBe('#/projects/1/edit');
    expect(t.browse('#/projects')).toBe(false);
    expect(t.asked).toHaveLength(2);
  });

  it("lets the app's own navigation through without asking, as after a save", () => {
    const t = setup();
    t.hold();
    t.gate.pass('#/projects/1');
    expect(t.gate.follow('#/projects/1/edit')).toBe(true);
    expect(t.asked).toHaveLength(0);
  });

  it('runs Log out at once without a draft, and only after asking with one', () => {
    const t = setup();
    let loggedOut = 0;
    t.gate.confirm(() => loggedOut++);
    expect(loggedOut).toBe(1);
    t.hold();
    t.gate.confirm(() => loggedOut++);
    expect(loggedOut).toBe(1);
    t.asked[0]?.();
    expect(loggedOut).toBe(2);
  });

  it('stops asking once the draft is released, as when it is saved or the screen goes', () => {
    const t = setup();
    const release = t.hold();
    release();
    expect(t.browse('#/projects')).toBe(true);
    expect(t.asked).toHaveLength(0);
  });

  it("keeps the newer screen's hold when an older one releases late", () => {
    const t = setup();
    const older = t.hold();
    t.hold();
    older();
    expect(t.browse('#/projects')).toBe(false);
  });
});
