import {
  createSnapshot,
  FLAG_CATEGORY_LABELS,
  type Flag,
  structural,
  TEMPLATES,
  TOOL_TYPES,
} from '@kerf/core';
import { VERDICT_WORDS } from '@kerf/core/testing';
import { isValidElement, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { render, renderText, textOf } from '../test/render.tsx';
import { Catalog } from './Catalog.tsx';
import { goToField, reported } from './feedback.tsx';
import { ICON_NAMES } from './Icon.tsx';
import {
  Button,
  Changed,
  CheckStatus,
  Definitions,
  Diagram,
  Disclosure,
  ErrorSummary,
  ErrorText,
  ExpertCheck,
  Field,
  Figures,
  FlagList,
  FormProgress,
  Glance,
  Header,
  Icon,
  InfoNotice,
  InlineConfirm,
  Length,
  List,
  Loading,
  MarginLine,
  Measured,
  MeasureTable,
  ModeFrame,
  Notice,
  OneLine,
  PartLetter,
  PlainList,
  PlanSection,
  SaveFailed,
  SawSetting,
  ScreenHeader,
  SectionList,
  SectionPager,
  Select,
  StateTag,
  StatusLine,
  StepLayout,
  Term,
  TermScope,
  TextInput,
  Tick,
  ToolIcon,
  ToolLabel,
  WithAside,
  WithContents,
  Wordmark,
} from './index.ts';
import { leavingFor } from './LeaveGuard.tsx';
import { TOOL_ICON_IDS } from './ToolIcon.tsx';
import { WORDMARK } from './wordmark-outline.ts';

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

  it('puts input needed on its own line under the label', () => {
    expect(field({ needed: true })).toMatch(
      /<label class="k-field__label" for="f"><span>Beam height<\/span><span class="k-needed">/,
    );
  });

  it('sizes the control by what is typed in it, and keeps a unit beside it', () => {
    expect(field({ width: 'short' })).toContain('<div class="k-field" data-width="short">');
    expect(field({ width: 'medium' })).toContain('data-width="medium"');
    expect(field()).not.toContain('data-width');
    expect(field({ unit: 'lb' })).toMatch(
      /<span class="k-field__unit"><input [^>]*><span id="[^"]+">lb<\/span>/,
    );
  });

  it('makes the unit part of what the control says, after any error', () => {
    const html = field({ unit: 'lb', error: 'Enter a weight.' });
    expect(html).toContain('<span id="f-unit">lb</span>');
    expect(html).toContain('aria-describedby="f-error f-unit f-hint"');
    expect(field()).not.toContain('f-unit');
  });

  it('gives a typed length the full keyboard with corrections off', () => {
    expect(field()).toMatch(
      /inputMode="text" autoCapitalize="off" autoCorrect="off" spellCheck="false"/,
    );
  });
});

describe('FormProgress', () => {
  const progress = (empty: { group: string; field: string }[]) =>
    render(<FormProgress entered={18} total={32} empty={empty} />);

  it('counts what is entered and links each group with an empty field to its first one', () => {
    const html = progress([
      { group: 'Beam', field: 's-grade' },
      { group: 'Legs', field: 'p-bolt' },
      { group: 'Loads', field: 's-riders' },
    ]);
    expect(textOf(html)).toBe('18 of 32 entered Still empty: Beam, Legs, and Loads.');
    expect(html).toContain('<a href="#s-grade">Beam</a>');
  });

  it('joins two groups with and, and leaves the line out when nothing is empty', () => {
    expect(
      textOf(
        progress([
          { group: 'A', field: 'a' },
          { group: 'B', field: 'b' },
        ]),
      ),
    ).toContain('Still empty: A and B.');
    expect(textOf(progress([]))).toBe('18 of 32 entered');
  });
});

describe('WithAside', () => {
  it('puts the main column first and the aside after it, with its head at the top', () => {
    const html = render(
      <WithAside head={<p>Create</p>}>
        <p>Form</p>
        <p>Preview</p>
      </WithAside>,
    );
    expect(html).toBe(
      '<div class="l-with-aside"><div><div><p>Form</p></div><div><div class="l-with-aside__head"><p>Create</p></div><p>Preview</p></div></div></div>',
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

  it('says what it is doing while busy, and what it does otherwise', () => {
    expect(renderText(<Button busyLabel="Saving…">Save tools</Button>)).toBe('Save tools');
    expect(
      renderText(
        <Button busy busyLabel="Saving…">
          Save tools
        </Button>,
      ),
    ).toBe('Saving…');
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
    const html = render(<ErrorSummary items={items} attempt={1} />);
    expect(html).toContain('role="alert"');
    expect(html).toContain('tabindex="-1"');
    expect(html).toContain('<a href="#a">Enter a length.</a>');
    expect(renderText(<ErrorSummary items={items} attempt={1} />)).toContain(
      '2 fields need fixing before this can be saved',
    );
  });

  it('goes to the field in place, leaving the address and the form alone (#161)', () => {
    const calls: string[] = [];
    const field = {
      focus: (options?: FocusOptions) => calls.push(`focus ${JSON.stringify(options)}`),
      scrollIntoView: (options?: boolean | ScrollIntoViewOptions) =>
        calls.push(`scroll ${JSON.stringify(options)}`),
    };
    const doc = { getElementById: (id: string) => (id === 'p-beamLength' ? field : null) };
    let prevented = 0;
    const event = { preventDefault: () => prevented++ };
    goToField('p-beamLength', event, doc);
    expect(prevented).toBe(1);
    expect(calls).toEqual(['focus {"preventScroll":true}', 'scroll {"block":"center"}']);
    // A field that is not on the screen still never changes the address.
    goToField('gone', event, doc);
    expect(prevented).toBe(2);
    expect(calls).toHaveLength(2);
  });

  it('counts problems that are not fields as problems', () => {
    expect(
      renderText(<ErrorSummary items={[]} general={['The plan cannot be made.']} attempt={1} />),
    ).toContain('1 problem needs fixing');
  });

  it('takes focus again only when a save attempt finds problems, not when the form re-renders', () => {
    const none: string[] = [];
    const failed = reported({ issues: none, attempt: 0 }, ['Enter a length.'], true);
    expect(failed.attempt).toBe(1);
    expect(reported(failed, ['Enter a length.'], true).attempt).toBe(2);
    expect(reported(failed, none, false)).toEqual({ issues: none, attempt: 1 });
  });

  it('shows nothing when there is nothing to fix', () => {
    expect(render(<ErrorSummary items={[]} attempt={1} />)).toBe('');
  });
});

describe('leavingFor', () => {
  const inLink = (href: string) =>
    ({
      closest: (selector: string) => {
        const prefix = selector.match(/^a\[href\^="(.*)"\]$/)?.[1];
        if (prefix === undefined) throw new Error(`unexpected selector ${selector}`);
        return href.startsWith(prefix)
          ? ({ getAttribute: () => href } as unknown as Element)
          : null;
      },
    }) as Pick<Element, 'closest'>;

  it('leaves for another route', () => {
    expect(leavingFor(inLink('#/projects'), '#/projects/1/edit')).toBe('#/projects');
  });

  it("stays for a link to a field on the page, so an error summary's links keep the form", () => {
    expect(leavingFor(inLink('#project-name'), '#/projects/1/edit')).toBeUndefined();
  });

  it('stays for a link to the current route, or a click outside any link', () => {
    expect(leavingFor(inLink('#/projects/1/edit'), '#/projects/1/edit')).toBeUndefined();
    expect(leavingFor(null, '#/projects/1/edit')).toBeUndefined();
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

  it('marks column widths on the header and every cell, and leaves the rest to the browser', () => {
    const sized = render(
      <MeasureTable
        caption="Cut list"
        rowKey={(r) => r.part}
        rows={[{ part: 'Beam', length: '120"', ends: 'Square' }]}
        columns={[
          { key: 'part', label: 'Part', cell: (r) => r.part },
          { key: 'length', label: 'Length', numeric: true, width: 'fit', cell: (r) => r.length },
          { key: 'ends', label: 'End cuts', width: 'fill', cell: (r) => r.ends },
        ]}
      />,
    );
    expect(sized).toContain('<th scope="col">Part</th>');
    expect(sized).toContain('<th scope="col" data-numeric="" data-width="fit">Length</th>');
    expect(sized).toContain('<td data-label="Length" data-numeric="" data-width="fit">');
    expect(sized).toContain('<th scope="col" data-width="fill">End cuts</th>');
    expect(sized).toContain('<td data-label="End cuts" data-width="fill">');
    expect(html).not.toContain('data-width');
  });

  it('gives every column the same width when asked, so separate tables line up', () => {
    const equal = render(
      <MeasureTable
        caption="Frame"
        equalColumns
        rowKey={(r) => r.field}
        rows={[{ field: 'Beam length' }]}
        columns={[{ key: 'field', label: 'Field', cell: (r) => r.field }]}
      />,
    );
    expect(equal).toContain('<table class="k-table" data-equal="">');
    expect(html).toContain('<table class="k-table">');
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
    expect(html).toMatch(
      /^<header class="k-header"><a class="k-header__brand" href="#\/projects"><svg class="k-wordmark" role="img" aria-label="Kerf"/,
    );
    expect(html).toContain('<a href="#/projects" aria-current="page">Projects</a>');
    expect(html).toContain('<a href="#/tools">Tools</a>');
  });
});

describe('Wordmark', () => {
  it('is an image named Kerf, sized in em from its outline, in the text color', () => {
    const html = render(<Wordmark />);
    expect(html).toContain('role="img" aria-label="Kerf"');
    expect(html).toContain(`viewBox="0 -720 ${WORDMARK.width} 732"`);
    expect(html).toContain(`width="${WORDMARK.width / 1000}em" height="0.732em"`);
    expect(html).toContain('fill="currentColor"');
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

  it('puts what it is given in the bar before Exit', () => {
    expect(
      renderText(
        <ModeFrame mode="Building" exitHref="#/projects/1" end={<span>Theme menu</span>}>
          x
        </ModeFrame>,
      ),
    ).toContain('Building Theme menu Exit');
  });
});

describe('StepLayout', () => {
  it('puts the drawing after the lead and before the rest, in one place', () => {
    const html = render(
      <StepLayout lead={<p>Pieces</p>} drawing={<p>Drawing</p>}>
        <p>Methods</p>
      </StepLayout>,
    );
    expect(
      renderText(
        <StepLayout lead="Pieces" drawing="Drawing">
          Methods
        </StepLayout>,
      ),
    ).toBe('Pieces Drawing Methods');
    expect(html.match(/Drawing/g)).toHaveLength(1);
    expect(html).toContain('data-drawing=""');
  });

  it('is a plain column with no drawing', () => {
    const html = render(<StepLayout>Methods</StepLayout>);
    expect(html).not.toContain('data-drawing');
    expect(html).not.toContain('k-steplayout__drawing');
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

  it.each(ICON_NAMES)(
    "%s has the tool icons' 1-unit line and eased ends and joins (#148)",
    (name) => {
      const html = render(<Icon name={name} />);
      expect(html).toContain('stroke-width="1"');
      expect(html).toContain('stroke-linecap="round"');
      expect(html).toContain('stroke-linejoin="round"');
    },
  );
});

describe('ErrorText', () => {
  it('announces itself as an alert only when asked, as under a failed action', () => {
    expect(render(<ErrorText>Enter a length.</ErrorText>)).not.toContain('role=');
    const html = render(<ErrorText alert>That password is not right.</ErrorText>);
    expect(html).toMatch(/^<div role="alert"><span class="k-error-text">/);
    expect(html).toContain('aria-hidden="true"');
  });
});

describe('SaveFailed', () => {
  it('says what happened and what is kept, with the connection icon when offline', () => {
    const offline = { message: 'Kerf could not reach the server.', connection: true };
    expect(renderText(<SaveFailed failure={offline} />)).toBe(
      'Not saved. Kerf could not reach the server. Your changes are still here.',
    );
    const html = render(<SaveFailed failure={offline} />);
    expect(html).toContain('role="alert"');
    expect(html).toContain('M2 2l12 12');
  });

  it('uses the error icon when the server answered, and takes its own words', () => {
    const answered = { message: 'The server answered 500.', connection: false };
    expect(render(<SaveFailed failure={answered} />)).not.toContain('M2 2l12 12');
    expect(
      renderText(
        <SaveFailed
          failure={answered}
          title="No preview."
          kept="The form still shows your values."
        />,
      ),
    ).toBe('No preview. The server answered 500. The form still shows your values.');
  });
});

describe('InfoNotice', () => {
  it('is a status, not an alert, with its icon hidden and the words carrying it', () => {
    const html = render(<InfoNotice>Shown as stored.</InfoNotice>);
    expect(html).toContain('role="status"');
    expect(html).not.toContain('role="alert"');
    expect(html).toContain('aria-hidden="true"');
    expect(renderText(<InfoNotice>Shown as stored.</InfoNotice>)).toBe('Shown as stored.');
  });
});

describe('InlineConfirm', () => {
  const confirm = (props: Partial<Parameters<typeof InlineConfirm>[0]> = {}) => (
    <InlineConfirm
      confirm="Delete project"
      busyLabel="Deleting…"
      variant="destructive"
      keep="Keep project"
      busy={false}
      onConfirm={none}
      onKeep={none}
      {...props}
    >
      <p>Delete “Backyard”?</p>
    </InlineConfirm>
  );

  it('asks, then offers the action as the form’s submit and a way to keep things as they are', () => {
    const html = render(confirm());
    expect(renderText(confirm())).toBe('Delete “Backyard”? Delete project Keep project');
    expect(html).toMatch(/<form noValidate="">/);
    expect(html).toMatch(/type="submit" class="k-button" data-variant="destructive"/);
    expect(html).not.toContain('role="alert"');
  });

  it('says it is working, and announces what went wrong', () => {
    const html = render(confirm({ busy: true, error: 'Not found.' }));
    expect(html).toContain('aria-disabled="true"');
    expect(renderText(confirm({ busy: true }))).toContain('Deleting…');
    expect(html).toMatch(/role="alert".*Not found\./);
  });
});

describe('ScreenHeader', () => {
  it('puts the title first, the actions beside it, then the lede, facts, and status', () => {
    const header = (
      <ScreenHeader
        title="Backyard"
        actions={<Button variant="secondary">Edit</Button>}
        lede="What this is for."
        meta="Planned."
        status={<StatusLine>Saved.</StatusLine>}
      />
    );
    expect(renderText(header)).toBe('Backyard Edit What this is for. Planned. Saved.');
    const html = render(header);
    expect(html).toMatch(/^<header class="l-stack"/);
    expect(html).toContain('<h1>Backyard</h1>');
    expect(html.match(/data-tone="muted"/g)).toHaveLength(2);
  });

  it('is only a heading when given only a title', () => {
    expect(render(<ScreenHeader title="Tools" />)).toMatch(
      /^<header[^>]*><h1>Tools<\/h1><\/header>$/,
    );
  });
});

describe('lists of core sentences', () => {
  it('make an item of each sentence, keeping its lengths on one line', () => {
    const html = render(<List ordered items={['Mark 130-1/4" from the top cut.', 'Cut.']} />);
    expect(html).toMatch(/^<ol class="k-list"><li>/);
    expect(html).toContain('<span class="k-length">130-1/4&quot;</span>');
    expect(render(<PlainList items={['a', 'b']} />).match(/<li>/g)).toHaveLength(2);
  });
});

describe('PlanSection', () => {
  it('puts its intro under the heading, in the muted tone', () => {
    const html = render(
      <PlanSection id="cut-list" title="Cut list" project="Backyard" intro="How to read it.">
        <p>Rows</p>
      </PlanSection>,
    );
    expect(html.indexOf('How to read it.')).toBeGreaterThan(html.indexOf('</h2>'));
    expect(html).toContain('<p class="k-text" data-tone="muted">How to read it.</p>');
  });

  it('stays in the page when it is not on screen, hidden, so it still prints', () => {
    const html = render(
      <PlanSection id="boards" title="Boards" project="Backyard" hidden>
        <p>Boards</p>
      </PlanSection>,
    );
    expect(html).toMatch(
      /^<section id="boards" class="k-section" aria-labelledby="boards-heading" hidden="">/,
    );
  });
});

// A plan made by core from the first template's worked example, with the given structural inputs.
function examplePlan(inputs: unknown) {
  const template = TEMPLATES[0];
  if (!template) throw new Error('No template.');
  const made = createSnapshot(template, template.examples[0]?.params, inputs);
  if (!made.ok) throw new Error('The worked example does not generate.');
  return template.plan(template.outputs.parse(made.output.outputs));
}
const examplePlanAsEntered = examplePlan(TEMPLATES[0]?.examples[0]?.structuralInputs);

describe('Figures', () => {
  it('pairs each label with its value and detail as a description list', () => {
    const html = render(
      <Figures
        items={[
          { label: 'Beam', value: '120", 4x6' },
          { label: 'Lowest margin', value: 'margin 1.1x', detail: 'Bending: Top beam' },
        ]}
      />,
    );
    expect(html).toMatch(/^<dl class="k-figures"><div class="k-figure"><dt>Beam<\/dt><dd>/);
    expect(html).toContain('<dd class="k-figure__detail">Bending: Top beam</dd>');
  });
});

describe('Term', () => {
  const href = (id: string) => `#/glossary/${id}`;
  const buttons = (html: string) =>
    [...html.matchAll(/<button type="button" class="k-term__button"[^>]*>([^<]+)<\/button>/g)].map(
      (m) => m[1],
    );

  it('is a button named by the words, opening a popover with the definition and the entry', () => {
    const html = render(
      <Term id="long-point" href="#/glossary/long-point">
        long points
      </Term>,
    );
    const [, target] = html.match(/popovertarget="([^"]+)"/i) ?? [];
    expect(target).toBeTruthy();
    expect(html).toMatch(
      /<button type="button" class="k-term__button" popovertarget="[^"]+" aria-expanded="false">long points<\/button>/i,
    );
    expect(html).toContain(
      `<span id="${target}" popover="auto" class="k-term__popover"><b>Long point</b> The end of an angled cut`,
    );
    expect(html).toContain(
      '<a class="k-term__entry" href="#/glossary/long-point">Open the glossary entry</a>',
    );
  });

  it('marks the first use of each term in a scope and no later one', () => {
    const html = render(
      <TermScope entryHref={href}>
        <Measured text="Mark the long point, then the short point from the long point." terms />
        <List items={['Join the long point and the short point.', 'Mind the kerf.']} terms />
      </TermScope>,
    );
    expect(buttons(html)).toEqual(['long point', 'short point', 'kerf']);
  });

  it('starts each scope fresh, inheriting where entries are', () => {
    const html = render(
      <TermScope entryHref={href}>
        <Measured text="Mind the kerf." terms />
        <TermScope>
          <Measured text="Mind the kerf." terms />
        </TermScope>
        <Measured text="Mind the kerf." terms />
      </TermScope>,
    );
    expect(buttons(html)).toEqual(['kerf', 'kerf']);
    expect(html.match(/href="#\/glossary\/kerf"/g)).toHaveLength(2);
  });

  it('never marks a tool name, text not asked to, or text outside a scope', () => {
    const scoped = render(
      <TermScope entryHref={href}>
        <Measured text="Set the miter saw and the sliding bevel." terms />
        <Measured text="Cut the miter." />
      </TermScope>,
    );
    expect(buttons(scoped)).toEqual([]);
    expect(buttons(render(<Measured text="Cut the miter." terms />))).toEqual([]);
  });

  it('keeps lengths whole beside a term', () => {
    const html = render(
      <TermScope entryHref={href}>
        <Measured text={'Measure 3-1/2" from the long point.'} terms />
      </TermScope>,
    );
    expect(html).toContain('<span class="k-length">3-1/2&quot;</span>');
    expect(buttons(html)).toEqual(['long point']);
  });

  it('marks terms in flags', () => {
    const html = render(
      <TermScope entryHref={href}>
        <FlagList
          flags={[
            {
              category: 'load-bearing',
              ask: 'Confirm the gusset bolts.',
              why: 'The gusset carries the beam.',
              partIds: [],
              hardwareIds: [],
            } as Flag,
          ]}
        />
      </TermScope>,
    );
    expect(buttons(html)).toEqual(['gusset']);
  });
});

describe('Definitions', () => {
  it('marks each term as a dfn in a description list, each entry focusable by its id', () => {
    const html = render(
      <Definitions
        items={[
          { id: 'term-kerf', term: 'Kerf', definition: 'The width a blade removes.' },
          { id: 'term-margin', term: 'Margin', definition: 'A ratio.', detail: 'Source' },
        ]}
      />,
    );
    expect(html).toContain(
      '<div id="term-kerf" class="k-definition" tabindex="-1"><dt><dfn>Kerf</dfn></dt><dd>The width a blade removes.</dd></div>',
    );
    expect(html).toContain('<dd>A ratio.</dd><dd>Source</dd>');
  });
});

describe('WithContents', () => {
  const contents = () => (
    <WithContents
      items={[
        { id: 'summary', title: 'Summary', href: '#/projects/p' },
        {
          id: 'structural-review',
          title: 'Structural review',
          href: '#/projects/p/structural-review',
        },
        { id: 'boards', title: 'Boards', href: '#/projects/p/boards' },
      ]}
      current="structural-review"
    >
      <p>Sections</p>
    </WithContents>
  );

  it('is a labeled navigation list of links, in the order given, before the sections', () => {
    const html = render(contents());
    const id = html.match(/<nav class="k-contents" aria-labelledby="([^"]+)">/)?.[1];
    expect(html).toContain(`<h2 id="${id}" class="k-contents__heading">Contents</h2>`);
    expect(html).toContain('<a href="#/projects/p/boards">Boards</a>');
    expect(html.indexOf('<ol')).toBeLessThan(html.indexOf('Sections'));
  });

  it('marks the current section as the page, in words for screen readers', () => {
    const html = render(contents());
    expect(html).toContain(
      '<a href="#/projects/p/structural-review" aria-current="page">Structural review</a>',
    );
    expect(html.match(/aria-current/g)).toHaveLength(1);
  });

  it('has a bar for narrow screens that says where you are and opens the list', () => {
    const html = render(contents());
    const listId = html.match(/<ol id="([^"]+)">/)?.[1];
    expect(html).toContain(
      `<button type="button" class="k-contents__bar" aria-expanded="false" aria-controls="${listId}">`,
    );
    const bar = textOf(html.slice(html.indexOf('<button'), html.indexOf('</button>')));
    expect(bar).toBe('2 of 3 · Structural review Contents');
  });
});

describe('SectionPager', () => {
  it('names the sections either side, in a navigation labeled for the plan', () => {
    const html = render(
      <SectionPager
        previous={{ title: 'Diagrams', href: '#/p/diagrams' }}
        next={{ title: 'Cut list', href: '#/p/cut-list' }}
      />,
    );
    expect(html).toMatch(/^<nav class="k-pager" aria-label="Plan sections">/);
    expect(textOf(html)).toBe('Previous Diagrams Next Cut list');
    expect(html).toContain('<a class="k-pager__link" href="#/p/diagrams" rel="prev">');
    expect(html).toContain('<a class="k-pager__link" href="#/p/cut-list" rel="next">');
  });

  it('gives only the side there is at either end, and nothing with neither', () => {
    expect(textOf(render(<SectionPager next={{ title: 'Diagrams', href: '#' }} />))).toBe(
      'Next Diagrams',
    );
    expect(render(<SectionPager />)).toBe('');
  });
});

describe('SectionList', () => {
  it('links each section with its digest under it', () => {
    const html = render(
      <SectionList
        items={[
          { id: 'cut-list', title: 'Cut list', href: '#/p/cut-list', digest: '5 parts, 9 pieces' },
        ]}
      />,
    );
    expect(html).toBe(
      '<ul class="k-section-list"><li><a href="#/p/cut-list">Cut list</a><span class="k-section-list__digest">5 parts, 9 pieces</span></li></ul>',
    );
  });
});

describe('OneLine', () => {
  it('keeps the whole text in the page, for screen readers and copying', () => {
    expect(render(<OneLine>A long sentence.</OneLine>)).toBe(
      '<span class="k-one-line">A long sentence.</span>',
    );
  });
});

describe('PlanSection headings', () => {
  it('can take focus after a move, and the first section can share a printed page', () => {
    const html = render(
      <PlanSection id="summary" title="Summary" project="Backyard" newPage={false}>
        <p>Figures</p>
      </PlanSection>,
    );
    expect(html).toContain('<h2 id="summary-heading" tabindex="-1">Summary</h2>');
    expect(html).toContain('data-page="same"');
  });
});

describe('FlagList', () => {
  const flag = examplePlanAsEntered.flags[0] as Flag;

  it('labels each flag with its category in words', () => {
    expect(flag).toBeDefined();
    expect(renderText(<FlagList flags={[flag]} />)).toBe(
      renderText(
        <ExpertCheck label={`Expert check · ${FLAG_CATEGORY_LABELS[flag.category]}`} why={flag.why}>
          {flag.ask}
        </ExpertCheck>,
      ),
    );
  });

  it('shows nothing when there are no flags', () => {
    expect(render(<FlagList flags={[]} />)).toBe('');
  });
});

describe('CheckStatus', () => {
  const computed = examplePlanAsEntered.checks.find((c) => c.status === 'computed');
  const needed = examplePlan({}).checks.find((c) => c.status === 'input-needed');

  it("gives a computed check's margin through core's formatter, in words", () => {
    if (computed?.status !== 'computed') throw new Error('No computed check.');
    expect(renderText(<CheckStatus check={computed} />)).toBe(
      `${structural.formatMargin(computed.margin)} under these assumptions`,
    );
  });

  it('says input needed, and in a preview what it was', () => {
    if (!needed) throw new Error('No check needing input.');
    expect(renderText(<CheckStatus check={needed} />)).toBe('Input needed');
    expect(renderText(<CheckStatus check={needed} was="margin 1.1x" />)).toBe(
      'Input needed was margin 1.1x',
    );
  });

  it('says why a check was not computed', () => {
    if (!computed) throw new Error('No computed check.');
    const check = {
      ...computed,
      status: 'not-computed',
      reason: 'No design value for this species.',
      sources: [],
    } as structural.CheckResult;
    expect(renderText(<CheckStatus check={check} />)).toBe(
      'Not computed. No design value for this species.',
    );
  });
});

describe('tool icons (#86)', () => {
  it('draw every tool type in the library, and nothing else', () => {
    expect([...TOOL_ICON_IDS].sort()).toEqual(TOOL_TYPES.map((t) => t.id).sort());
  });

  it('are hidden from screen readers, so the name beside them says what the tool is', () => {
    const html = render(<ToolLabel toolTypeId="miter-saw">Miter saw</ToolLabel>);
    expect(html).toContain('aria-hidden="true"');
    expect(renderText(<ToolLabel toolTypeId="miter-saw">Miter saw</ToolLabel>)).toBe('Miter saw');
  });

  it('are drawn with one 1-unit line and eased corners, as the app boxes are (#148)', () => {
    for (const id of TOOL_ICON_IDS) {
      const html = render(<ToolIcon toolTypeId={id} />);
      expect(html).toContain('stroke-width="1"');
      expect(html).toContain('stroke-linecap="round"');
      expect(html).toContain('stroke-linejoin="round"');
      // Every box is eased by the same small radius.
      for (const rect of html.match(/<rect [^>]*>/g) ?? []) expect(rect).toContain('rx="0.6"');
    }
  });

  it('draw nothing for a tool type without one, leaving the name', () => {
    expect(render(<ToolIcon toolTypeId="no-such-tool" />)).toBe('');
    expect(renderText(<ToolLabel toolTypeId="no-such-tool">Router</ToolLabel>)).toBe('Router');
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
    expect(text).not.toMatch(VERDICT_WORDS);
    expect(text).not.toMatch(/\b(invalid|oops|please|just|simply|sanity)\b/i);
  });
});

describe('Diagram, action drawings (#118)', () => {
  const drawing = {
    title: 'Step',
    description: 'Adds the beam.',
    bounds: { x: 0, y: 0, width: 10, height: 10 },
    notes: [],
    emphasis: ['beam'],
    primitives: [
      {
        kind: 'polygon' as const,
        role: 'visible' as const,
        fill: 1 as const,
        points: [
          { x: 0, y: 0 },
          { x: 4, y: 0 },
          { x: 4, y: 2 },
        ],
        part: { partId: 'beam', instance: 0, letter: 'A' },
      },
      {
        kind: 'polygon' as const,
        role: 'visible' as const,
        fill: 2 as const,
        points: [
          { x: 0, y: 5 },
          { x: 4, y: 5 },
          { x: 4, y: 7 },
        ],
        part: { partId: 'leg', instance: 0, letter: 'B' },
      },
      {
        kind: 'line' as const,
        role: 'guideline' as const,
        arrows: 'end' as const,
        points: [
          { x: 2, y: -3 },
          { x: 2, y: 1 },
        ],
      },
    ],
  };
  const html = render(<Diagram drawing={drawing} label="Adds the beam." assumedWidth={600} />);

  it('tints and outlines what the step adds, as a selected part, and nothing else', () => {
    expect(html).toMatch(/data-selected="" data-part="beam"/);
    expect(html).not.toMatch(/data-selected="" data-part="leg"/);
  });

  it('draws a motion arrow with one head, at the end', () => {
    expect(html.match(/class="k-arrow"/g)).toHaveLength(1);
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

  it('keys each placed letter uniquely when a part is lettered twice', () => {
    // Server rendering does not report duplicate keys, so the keys are read from the element tree.
    const twice = {
      ...drawing,
      primitives: [
        ...drawing.primitives,
        {
          kind: 'letter' as const,
          at: { x: 45, y: 4 },
          target: { x: 20, y: 4 },
          letter: 'B',
          part: { partId: 'leg', instance: 1, letter: 'B' },
        },
        {
          kind: 'letter' as const,
          at: { x: 45, y: 8 },
          target: { x: 25, y: 4 },
          letter: 'B',
          part: { partId: 'leg', instance: 1, letter: 'B' },
        },
      ],
    };
    let tree: ReactNode = null;
    const html = render(
      <DiagramProbe
        diagram={{ drawing: twice, label: 'Sample', assumedWidth: 400 }}
        onTree={(t) => {
          tree = t;
        }}
      />,
    );
    expect(html.match(/class="k-letter"/g)).toHaveLength(3);
    const duplicates: string[] = [];
    const walk = (node: ReactNode) => {
      if (Array.isArray(node)) {
        const keys = node.flatMap((n) => (isValidElement(n) && n.key !== null ? [n.key] : []));
        duplicates.push(...keys.filter((k, i) => keys.indexOf(k) !== i));
        node.forEach(walk);
      } else if (isValidElement<{ children?: ReactNode }>(node)) {
        walk(node.props.children);
      }
    };
    walk(tree);
    expect(duplicates).toEqual([]);
  });
});

/** Diagram's element tree, from a component that calls it as a function and so owns its hooks. */
function DiagramProbe(props: {
  diagram: Parameters<typeof Diagram>[0];
  onTree: (tree: ReactNode) => void;
}) {
  const tree = Diagram(props.diagram);
  props.onTree(tree);
  return tree;
}
