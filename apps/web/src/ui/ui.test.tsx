import { describe, expect, it } from 'vitest';
import { render, renderText } from '../test/render.tsx';
import { Catalog } from './Catalog.tsx';
import { ICON_NAMES } from './Icon.tsx';
import {
  Button,
  Changed,
  Diagram,
  Disclosure,
  ErrorSummary,
  ExpertCheck,
  Field,
  Glance,
  Header,
  Icon,
  Length,
  Loading,
  MarginLine,
  Measured,
  MeasureTable,
  ModeFrame,
  Notice,
  PartLetter,
  SawSetting,
  Select,
  StateTag,
  StatusLine,
  TextInput,
  Tick,
} from './index.ts';

// Each component's states and what assistive technology is told about them (#45). The catalog
// shows the same states for a person to look at.

const none = () => {};

describe('Field', () => {
  const field = (props: Partial<Parameters<typeof Field>[0]> = {}) =>
    render(
      <Field id="f" label="Beam height" hint="Inches, or feet and inches." {...props}>
        {(c) => <TextInput {...c} value="8'" onChange={none} />}
      </Field>,
    );

  it('ties the label, hint, and echo to the control', () => {
    const html = field({ echo: `8' 0" · 96"` });
    expect(html).toContain('<label class="k-field__label" for="f">');
    expect(html).toMatch(/<input id="f" aria-describedby="f-hint f-echo"/);
    expect(html).toContain('id="f-echo"');
    expect(html).not.toContain('aria-invalid');
  });

  it('marks an error, says it first, and puts it before the control', () => {
    const html = field({ error: 'Enter a length.' });
    expect(html).toContain('data-state="error"');
    expect(html).toMatch(/<input id="f" aria-describedby="f-error f-hint" aria-invalid="true"/);
    expect(html.indexOf('Enter a length.')).toBeLessThan(html.indexOf('<input'));
  });

  it('shows an empty structural input as input needed, not as an error', () => {
    const html = field({ needed: true });
    expect(html).toContain('data-state="needed"');
    expect(
      renderText(
        <Field label="Deflection limit" needed>
          {(c) => <TextInput {...c} value="" onChange={none} />}
        </Field>,
      ),
    ).toContain('Deflection limit Input needed');
    expect(html).not.toContain('aria-invalid');
  });

  it('gives a typed length the full keyboard with corrections off', () => {
    expect(field()).toMatch(
      /inputMode="text" autoCapitalize="off" autoCorrect="off" spellCheck="false"/,
    );
  });
});

describe('Select', () => {
  it('starts with nothing chosen: no option is a stand-in value', () => {
    const html = render(
      <Field id="s" label="Beam stock">
        {(c) => (
          <Select {...c} value="" onChange={none} options={[{ value: '4x6', label: '4x6' }]} />
        )}
      </Field>,
    );
    expect(html).toContain('<option value="" selected="">Choose…</option>');
    expect(html).not.toMatch(/value="4x6" selected/);
  });
});

describe('Button', () => {
  it('is a plain button unless told to submit', () => {
    expect(render(<Button>Save changes</Button>)).toContain('type="button"');
    expect(render(<Button type="submit">Save changes</Button>)).toContain('type="submit"');
  });

  it('says it is busy without looking disabled', () => {
    const html = render(<Button busy>Saving…</Button>);
    expect(html).toContain('aria-disabled="true"');
    expect(html).not.toContain('disabled=""');
  });

  it('carries its variant as data', () => {
    expect(render(<Button variant="destructive">Delete project</Button>)).toContain(
      'data-variant="destructive"',
    );
  });
});

describe('ErrorSummary', () => {
  const items = [
    { field: 'a', message: 'Enter a length.' },
    { field: 'b', message: 'Beam height must be from 5\' 0" to 12\' 0".' },
  ];

  it('is announced, can take focus, and links each problem to its field', () => {
    const html = render(<ErrorSummary items={items} />);
    expect(html).toContain('role="alert"');
    expect(html).toContain('tabindex="-1"');
    expect(html).toContain('<a href="#a">Enter a length.</a>');
    expect(renderText(<ErrorSummary items={items} />)).toContain(
      '2 fields need fixing before this can be saved',
    );
  });

  it('counts problems that are not fields as problems', () => {
    expect(
      renderText(<ErrorSummary items={[]} general={['The plan cannot be made.']} />),
    ).toContain('1 problem needs fixing');
  });

  it('shows nothing when there is nothing to fix', () => {
    expect(render(<ErrorSummary items={[]} />)).toBe('');
  });
});

describe('notices', () => {
  it('labels an expert check in words, with the icon hidden from screen readers', () => {
    const html = render(
      <ExpertCheck why="Buried legs anchor the frame.">Confirm the burial depth.</ExpertCheck>,
    );
    expect(renderText(<ExpertCheck why="x">y</ExpertCheck>)).toBe('Expert check y Why: x');
    expect(html).toContain('aria-hidden="true"');
  });

  it('announces status without moving focus, and problems as alerts', () => {
    expect(render(<StatusLine>Saved.</StatusLine>)).toContain('role="status"');
    expect(render(<Notice>Not saved.</Notice>)).toContain('role="alert"');
  });

  it('waits before showing loading text, so a fast load does not flash', () => {
    expect(renderText(<Loading>Loading project…</Loading>)).toBe('');
    expect(renderText(<Loading delayMs={0}>Loading project…</Loading>)).toBe('Loading project…');
  });
});

describe('numbers', () => {
  it('keeps every length and angle in core text on one line', () => {
    const html = render(<Measured text={`Each edge: 130-1/4", saw at 20.0°`} />);
    expect(html).toContain('<span class="k-length">130-1/4&quot;</span>');
    expect(html).toContain('<span class="k-length">20.0°</span>');
    expect(render(<Length>131-1/2"</Length>)).toContain('class="k-length"');
    expect(render(<Glance>131-1/2"</Glance>)).toContain('class="k-glance"');
  });

  it('labels the saw setting and the angle to the edge, so they cannot be mixed up', () => {
    expect(renderText(<SawSetting setting="20.0°" toEdge="70.0°" />)).toBe(
      'Saw at 20.0° To the edge 70.0°',
    );
  });

  it('writes a margin with its assumptions, and nothing that judges it', () => {
    expect(renderText(<MarginLine margin="margin 1.1x" />)).toBe(
      'margin 1.1x under these assumptions',
    );
  });
});

describe('PartLetter', () => {
  it('shows the letter as written, so a screen reader reads it with the part name', () => {
    expect(render(<PartLetter>A</PartLetter>)).toBe('<span class="k-part-letter">A</span>');
  });
});

describe('preview changes', () => {
  it('says the saved value in words beside the new one, so the mark is not the only sign', () => {
    const html = render(
      <Changed was={'120"'}>
        <Length>132"</Length>
      </Changed>,
    );
    expect(html).toContain('class="k-changed"');
    expect(renderText(<Changed was={'120"'}>132"</Changed>)).toBe('132" was 120"');
    expect(html).toContain('<span class="k-length">120&quot;</span>');
  });

  it('says "new" for a value the saved plan did not have', () => {
    expect(renderText(<Changed was={null}>Lag screw</Changed>)).toBe('Lag screw new');
  });

  it('gives a changed margin the saved margin', () => {
    const html = render(<MarginLine margin="margin 1.0x" was="margin 1.1x" />);
    expect(html).toContain('data-changed=""');
    expect(renderText(<MarginLine margin="margin 1.0x" was="margin 1.1x" />)).toBe(
      'margin 1.0x under these assumptions was margin 1.1x',
    );
    expect(render(<MarginLine margin="margin 1.0x" />)).not.toContain('data-changed');
  });

  it('labels the state of the numbers in words', () => {
    expect(renderText(<StateTag>Preview, not saved</StateTag>)).toBe('Preview, not saved');
  });

  it('marks changed rows in a measurement table', () => {
    const html = render(
      <MeasureTable
        caption="Cut list"
        rowKey={(r) => r.part}
        rowChanged={(_, i) => i === 1}
        rows={[{ part: 'Beam' }, { part: 'Leg' }]}
        columns={[{ key: 'part', label: 'Part', cell: (r) => r.part }]}
      />,
    );
    expect(html.match(/<tr data-changed="">/g)).toHaveLength(1);
    expect(html).toContain('<tr data-changed=""><td data-label="Part"><div>Leg</div>');
  });
});

describe('MeasureTable', () => {
  const html = render(
    <MeasureTable
      caption="Cut list"
      rowKey={(r) => r.part}
      rows={[{ part: 'Beam', length: '120"' }]}
      columns={[
        { key: 'part', label: 'Part', cell: (r) => r.part },
        { key: 'length', label: 'Length', numeric: true, cell: (r) => r.length },
      ]}
    />,
  );

  it('has a caption and column headers', () => {
    expect(html).toContain('<caption>Cut list</caption>');
    expect(html).toContain('<th scope="col">Part</th>');
  });

  it('labels each cell, so stacked rows on a phone still say what each value is', () => {
    expect(html).toContain('<td data-label="Length" data-numeric=""><div>120&quot;</div></td>');
  });
});

describe('Disclosure', () => {
  it('is a native details element, closed by default', () => {
    const html = render(<Disclosure summary="Show the working">Steps</Disclosure>);
    expect(html).toMatch(/^<details class="k-disclosure"><summary>/);
  });
});

describe('Header', () => {
  it('names its navigation and marks the current page', () => {
    const html = render(
      <Header
        brandHref="#/projects"
        nav={[
          { label: 'Projects', href: '#/projects', current: true },
          { label: 'Tools', href: '#/tools' },
        ]}
      />,
    );
    expect(html).toContain('<nav aria-label="Main">');
    expect(html).toContain('<a href="#/projects" aria-current="page">Projects</a>');
    expect(html).toContain('<a href="#/tools">Tools</a>');
  });
});

describe('ModeFrame', () => {
  it('names the mode and the project, offers Exit, and has no other navigation', () => {
    const html = render(
      <ModeFrame mode="Shopping" context="Backyard swing set" exitHref="#/projects/1">
        <p>Lines</p>
      </ModeFrame>,
    );
    expect(
      renderText(
        <ModeFrame mode="Shopping" context="Backyard swing set" exitHref="#/projects/1">
          x
        </ModeFrame>,
      ),
    ).toContain('Shopping · Backyard swing set Exit');
    expect(html).toContain('href="#/projects/1"');
    expect(html).not.toContain('<nav');
    expect(html).toContain('<main class="l-page" data-density="shop">');
  });
});

describe('Tick', () => {
  it('is a labeled checkbox whose state is the box, not a color', () => {
    const html = render(
      <Tick done onChange={none}>
        Crossbar cut
      </Tick>,
    );
    expect(html).toMatch(/<label class="k-tick"[^>]*><input type="checkbox" checked=""/);
    expect(
      renderText(
        <Tick done={false} onChange={none}>
          Crossbar cut
        </Tick>,
      ),
    ).toBe('Crossbar cut');
  });

  it('says when a tick is not saved yet, in its name', () => {
    expect(
      renderText(
        <Tick done waiting onChange={none}>
          Crossbar cut
        </Tick>,
      ),
    ).toBe('Crossbar cut On this phone, not yet sent');
  });
});

describe('icons', () => {
  it.each(ICON_NAMES)('%s is hidden from assistive technology', (name) => {
    const html = render(<Icon name={name} />);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('focusable="false"');
  });
});

describe('the catalog', () => {
  const text = renderText(<Catalog />);

  it('shows every component in light and dark, and in shop density', () => {
    const html = render(<Catalog />);
    expect(html.match(/data-theme="light"/g)).toHaveLength(2);
    expect(html.match(/data-theme="dark"/g)).toHaveLength(2);
    expect(html).toContain('data-density="shop"');
  });

  it("uses the worked example's values, formatted by core", () => {
    expect(text).toContain('131-1/2"');
    expect(text).toContain('margin 1.1x under these assumptions');
    expect(text).toContain(`Beam height must be from 5' 0" to 12' 0".`);
  });

  it('follows the word list (docs/design/content.md)', () => {
    expect(text).not.toMatch(/\b(safe|unsafe|pass|fail|invalid|oops|please|just|simply|sanity)\b/i);
  });
});

describe('Diagram (#91)', () => {
  const drawing = {
    title: 'Sample',
    description: 'A sample part.',
    bounds: { x: 0, y: -10, width: 40, height: 20 },
    notes: ['Clear area: handbook, p. 2.'],
    primitives: [
      {
        kind: 'polygon' as const,
        role: 'visible' as const,
        points: [
          { x: 0, y: 0 },
          { x: 30, y: 0 },
          { x: 30, y: -5 },
        ],
        fill: 2 as const,
        outline: false,
        part: { partId: 'leg', instance: 0, letter: 'B' },
      },
      {
        kind: 'line' as const,
        role: 'hidden' as const,
        points: [
          { x: 0, y: 2 },
          { x: 30, y: 2 },
        ],
      },
      {
        kind: 'line' as const,
        role: 'dimension' as const,
        points: [
          { x: 0, y: 6 },
          { x: 30, y: 6 },
        ],
        arrows: true,
      },
      {
        kind: 'text' as const,
        role: 'dimension' as const,
        at: { x: 15, y: 7 },
        text: '30"',
        anchor: 'middle' as const,
      },
      {
        kind: 'polygon' as const,
        role: 'zone' as const,
        points: [
          { x: 0, y: -10 },
          { x: 40, y: -10 },
          { x: 40, y: -8 },
        ],
        fill: 'zone' as const,
      },
      {
        kind: 'letter' as const,
        at: { x: 45, y: -2 },
        target: { x: 20, y: -2 },
        letter: 'B',
        part: { partId: 'leg', instance: 0, letter: 'B' },
      },
    ],
  };
  const html = render(
    <Diagram drawing={drawing} label="Sample drawing" describedBy="cut-list" assumedWidth={400} />,
  );

  it('is one image with a short label and a long description', () => {
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Sample drawing"');
    expect(html).toContain('aria-describedby="cut-list"');
  });

  it('gives each shape its role and tone, for the line and diagram tokens', () => {
    expect(html).toContain('data-role="hidden"');
    expect(html).toContain('data-fill="2"');
    expect(html).toContain('data-outline="none"');
    expect(html).toContain('data-part="leg"');
    // Zones are tinted on screen and hatched on paper.
    expect(html).toContain('class="k-hatch"');
  });

  it('draws arrowheads on dimension lines, and keeps text at least 13 px wide drawings or narrow', () => {
    expect(html.match(/class="k-arrow"/g)).toHaveLength(2);
    // 400 px for 40 units: 0.1 unit per px, so 14 px text is 1.4 units.
    expect(html).toMatch(/font-size="1.4(000000000000001)?"/);
  });

  it('highlights the selected part, and leaves others alone', () => {
    const selected = render(
      <Diagram drawing={drawing} label="Sample" selected="leg" assumedWidth={400} />,
    );
    expect(selected.match(/data-selected=""/g)?.length).toBeGreaterThanOrEqual(2);
    expect(html).not.toContain('data-selected');
  });

  it('puts part letters in one column on the left in a narrow container (the phone layout)', () => {
    const wide = render(<Diagram drawing={drawing} label="Sample" assumedWidth={600} />);
    const narrow = render(<Diagram drawing={drawing} label="Sample" assumedWidth={320} />);
    const letterX = (h: string) => Number(/<rect class="k-letter__box" x="([-\d.]+)"/.exec(h)?.[1]);
    expect(letterX(wide)).toBeGreaterThan(40);
    expect(letterX(narrow)).toBeLessThan(0);
  });

  it('keeps a long drawing at its minimum width on a phone, to scroll sideways', () => {
    const phone = render(
      <Diagram drawing={drawing} label="Sample" assumedWidth={343} minWidth={560} />,
    );
    expect(phone).toContain('--diagram-width:560px');
  });

  it('lists the notes, such as sources, under the drawing', () => {
    expect(renderText(<Diagram drawing={drawing} label="Sample" />)).toContain(
      'Clear area: handbook, p. 2.',
    );
  });
});
