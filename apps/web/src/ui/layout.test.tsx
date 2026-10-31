import { describe, expect, it } from 'vitest';
import { render } from '../test/render.tsx';
import { Center, Grid, Sidebar, Switcher } from './layout.tsx';

describe('layout primitives', () => {
  it('take widths as steps of the width scale', () => {
    const html = render(
      <>
        <Grid min="m">a</Grid>
        <Center max="l">b</Center>
        <Sidebar sideWidth="xs">
          <span>c</span>
          <span>d</span>
        </Sidebar>
        <Switcher threshold="2xl">e</Switcher>
      </>,
    );
    expect(html).toContain('--grid-min:var(--width-m)');
    expect(html).toContain('--center-max:var(--width-l)');
    expect(html).toContain('--sidebar-width:var(--width-xs)');
    expect(html).toContain('--switcher-threshold:var(--width-2xl)');
  });
});
