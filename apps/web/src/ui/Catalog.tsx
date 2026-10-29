import {
  angleToEdge,
  entryEcho,
  type FormField,
  findTemplate,
  formatAngle,
  parseLength,
  schemaProblemMessage,
  structural,
  type TemplateDefinition,
} from '@kerf/core';
import { type ReactNode, useState } from 'react';
import snapshots from '../../../../packages/core/src/templates/swing-set-a-frame/snapshots/v5.json';
import { Button, ButtonLink } from './Button.tsx';
import { DiagramFrame } from './DiagramFrame.tsx';
import { ConfirmDialog } from './Dialog.tsx';
import { Disclosure } from './Disclosure.tsx';
import { Field, Select, TextInput, YesNo } from './Field.tsx';
import {
  ErrorSummary,
  ErrorText,
  ExpertCheck,
  InputNeeded,
  Loading,
  Notice,
  Pending,
  StateTag,
  StatusLine,
} from './feedback.tsx';
import { ICON_NAMES, Icon } from './Icon.tsx';
import { Card, Cluster, Stack, Switcher } from './layout.tsx';
import { MeasureTable } from './MeasureTable.tsx';
import {
  Changed,
  Glance,
  Length,
  MarginLine,
  Measured,
  PartLetter,
  SawSetting,
} from './numbers.tsx';
import { Header, ModeBar } from './Shell.tsx';

// Every component in every state, in light and dark and in shop density, so drift is visible
// (#45). Every sample value is from the swing set's worked example: core's committed snapshot
// (decision 0014) and core's formatters and messages. Nothing here is computed or made up.

interface Example {
  params: { beamHeight: number; burialDepth: number; splay: { degrees: number } };
  outputs: {
    cutList: {
      partId: string;
      letter: string;
      name: string;
      quantity: number;
      stock: string;
      length: string;
      ends: string[];
      marks: { value: string }[];
    }[];
    design: { flags: { ask: string; why: string }[] };
    structuralReview: { beam: { bending: { margin: number } } };
  };
}
const example = (snapshots as unknown as Example[])[0] as Example;
const cut = (id: string) => {
  const row = example.outputs.cutList.find((r) => r.partId === id);
  if (!row) throw new Error(`The worked example has no ${id}`);
  return row;
};
const leg = cut('leg-back');
const beam = cut('beam');
const splay = example.params.splay.degrees;
const setting = formatAngle(splay);
const toEdge = formatAngle(angleToEdge(splay));
const margin = structural.formatMargin(example.outputs.structuralReview.beam.bending.margin);
const burialFlag = example.outputs.design.flags.find((f) => f.ask.includes('burial depth'));
const template = findTemplate('swing-set-a-frame') as TemplateDefinition;
const field = (path: string): FormField => {
  const f = template.form.params.flatMap((s) => s.fields).find((x) => x.path === path);
  if (!f) throw new Error(path);
  return f;
};
/** Core's message for a value out of range, with the limits from the template's schema. */
const rangeMessage = (path: string, text: string) =>
  schemaProblemMessage(
    field(path),
    { code: 'too_big', path: [path], message: '' },
    text,
    template.params,
  );

const CUT_ROWS = [leg, beam];

// A preview against a saved plan: the two-ply beam on pads (the third example) as the preview,
// the worked example as what was saved. Both are core's output for their parameters.
const previewed = (snapshots as unknown as Example[])[2] as Example;
const previewLeg = previewed.outputs.cutList.find((r) => r.partId === 'leg-back');
const previewMargin = structural.formatMargin(
  previewed.outputs.structuralReview.beam.bending.margin,
);
const parsedEightZero = parseLength('8 0');
const unreadable = parsedEightZero.ok ? '' : parsedEightZero.message;

export function Catalog() {
  return (
    <div className="k-catalog">
      <Stack gap="l">
        <Stack gap="xs">
          <h1>Components</h1>
          <p>
            Every component in Kerf's design system, in each state, light and dark side by side.
            Sample values come from the swing set's worked example, formatted by core.
          </p>
        </Stack>
        <Themes>{() => <Specimens />}</Themes>
        <Stack gap="xs">
          <h2>Shop density</h2>
          <p>Shopping and Building: space times 1.5 and controls at least 56 px tall (#41).</p>
        </Stack>
        <Themes density="shop">{() => <ShopSpecimens />}</Themes>
      </Stack>
    </div>
  );
}

/** The same specimens in a light panel and a dark panel. */
function Themes(props: { density?: 'shop'; children: () => ReactNode }) {
  return (
    <Switcher threshold="60rem" gap="m">
      {(['light', 'dark'] as const).map((theme) => (
        <section
          key={theme}
          className="k-catalog__panel"
          data-theme={theme}
          data-density={props.density}
          aria-label={`${theme === 'light' ? 'Light' : 'Dark'}${props.density ? ', shop density' : ''}`}
        >
          {props.children()}
        </section>
      ))}
    </Switcher>
  );
}

function Group(props: { title: string; children: ReactNode }) {
  return (
    <Stack gap="s">
      <h3>{props.title}</h3>
      {props.children}
    </Stack>
  );
}

function Specimens() {
  const [text, setText] = useState("11' 6-3/8");
  const [choice, setChoice] = useState('');
  const [yes, setYes] = useState('');
  const [dialog, setDialog] = useState(false);
  return (
    <Stack gap="l">
      <Group title="Shell">
        <Header
          brandHref="#/catalog"
          nav={[
            { label: 'Projects', href: '#/catalog', current: true },
            { label: 'Tools', href: '#/catalog' },
          ]}
          end={<Button variant="link">Log out</Button>}
        />
      </Group>

      <Group title="Buttons">
        <Cluster>
          <Button>Save changes</Button>
          <Button variant="secondary">Cancel</Button>
          <Button variant="destructive">Delete project</Button>
          <Button variant="link">Show the working</Button>
          <Button busy>Saving…</Button>
          <ButtonLink href="#/catalog">Start building</ButtonLink>
        </Cluster>
      </Group>

      <Group title="Fields">
        <Field
          label="Beam height"
          hint="Inches, or feet and inches."
          echo={entryEcho(field('beamHeight'), text)}
        >
          {(c) => <TextInput {...c} value={text} onChange={setText} />}
        </Field>
        <Field
          id="catalog-burial"
          label="Burial depth"
          echo={entryEcho(field('burialDepth'), '8 0')}
        >
          {(c) => <TextInput {...c} value="8 0" onChange={() => {}} />}
        </Field>
        <Field
          id="catalog-beam-height"
          label="Beam height"
          error={rangeMessage('beamHeight', "15'")}
          echo={entryEcho(field('beamHeight'), "15'")}
        >
          {(c) => <TextInput {...c} value="15'" onChange={() => {}} />}
        </Field>
        <Field
          label="Deflection limit (span divided by)"
          hint="Allowed sag is the span divided by this number."
          needed
        >
          {(c) => <TextInput {...c} keyboard="decimal" value="" onChange={() => {}} />}
        </Field>
        <Field label="Leg angle from vertical" unit="°">
          {(c) => <TextInput {...c} keyboard="decimal" value="20" onChange={() => {}} />}
        </Field>
        <Field label="Beam stock">
          {(c) => (
            <Select
              {...c}
              value={choice}
              onChange={setChoice}
              options={[
                { value: '4x6', label: '4x6' },
                { value: '4x8', label: '4x8' },
              ]}
            />
          )}
        </Field>
        <Field label="Incised lumber">
          {(c) => <YesNo {...c} value={yes} onChange={setYes} />}
        </Field>
        <Field label="Beam length">
          {(c) => <TextInput {...c} value="120" onChange={() => {}} readOnly />}
        </Field>
      </Group>

      <Group title="Errors">
        <ErrorSummary
          takeFocus={false}
          items={[
            { field: 'catalog-burial', message: unreadable },
            { field: 'catalog-beam-height', message: rangeMessage('beamHeight', "15'") },
          ]}
        />
        <ErrorText>Enter a length.</ErrorText>
      </Group>

      <Group title="Notices">
        {burialFlag && (
          <ExpertCheck why={<Measured text={burialFlag.why} />}>
            <Measured text={burialFlag.ask} />
          </ExpertCheck>
        )}
        <p>
          Deflection limit <InputNeeded />
        </p>
        <Notice icon="connection">
          <b>Not saved.</b> Kerf could not reach the server. Your changes are still here. Save again
          when you have a connection.
        </Notice>
        <StatusLine>Saved. The plan was regenerated.</StatusLine>
        <p>
          {leg.name}, 1 of {leg.quantity} cut <Pending />
        </p>
        <Loading delayMs={0}>Loading project…</Loading>
      </Group>

      <Group title="Numbers">
        <p>
          Each edge, top cut to foot cut: <Length>{leg.marks[0]?.value ?? ''}</Length>
        </p>
        <MarginLine margin={margin} />
        <Card>
          <Stack gap="xs">
            <span>
              {leg.name}, {leg.quantity}
            </span>
            <Glance>{leg.length}</Glance>
            <SawSetting setting={setting} toEdge={toEdge} />
          </Stack>
        </Card>
      </Group>

      <Group title="Preview changes">
        <StateTag>Preview, not saved</StateTag>
        <MarginLine margin={previewMargin} was={margin} />
        <MeasureTable
          caption="Cut list, previewed"
          rowKey={(r) => r.partId}
          rows={[beam, { ...leg, length: previewLeg?.length ?? '' }]}
          rowChanged={(r) => r.partId === 'leg-back'}
          columns={[
            { key: 'part', label: 'Part', cell: (r) => r.name },
            {
              key: 'length',
              label: 'Length',
              numeric: true,
              cell: (r) =>
                r.partId === 'leg-back' ? (
                  <Changed was={leg.length}>
                    <Length>{r.length}</Length>
                  </Changed>
                ) : (
                  <Length>{r.length}</Length>
                ),
            },
          ]}
        />
      </Group>

      <Group title="Measurement table">
        <MeasureTable
          caption="Cut list"
          rowKey={(r) => r.partId}
          rows={CUT_ROWS}
          columns={[
            {
              key: 'part',
              label: 'Part',
              cell: (r) => (
                <>
                  <PartLetter>{r.letter}</PartLetter>
                  {r.name}
                </>
              ),
            },
            { key: 'qty', label: 'Qty', numeric: true, cell: (r) => r.quantity },
            { key: 'stock', label: 'Stock', cell: (r) => r.stock },
            {
              key: 'length',
              label: 'Length',
              numeric: true,
              cell: (r) => <Length>{r.length}</Length>,
            },
            { key: 'ends', label: 'End cuts', cell: (r) => <Measured text={r.ends.join('; ')} /> },
          ]}
        />
      </Group>

      <Group title="Disclosure">
        <Card>
          <Stack gap="xs">
            <b>Bending, top beam 4x6</b>
            <MarginLine margin={margin} />
            <Disclosure summary="Show the working">
              <p>
                The working, assumptions, and sources go here. Opens by itself when the page is
                printed.
              </p>
            </Disclosure>
          </Stack>
        </Card>
      </Group>

      <Group title="Dialog">
        <Cluster>
          <Button variant="secondary" onClick={() => setDialog(true)}>
            Open the leave-with-changes prompt
          </Button>
        </Cluster>
        <ConfirmDialog
          open={dialog}
          title="Leave without saving?"
          stay="Keep editing"
          leave="Leave without saving"
          onStay={() => setDialog(false)}
          onLeave={() => setDialog(false)}
        >
          Your changes will be lost.
        </ConfirmDialog>
      </Group>

      <Group title="Icons">
        <Cluster gap="m">
          {ICON_NAMES.map((name) => (
            <span key={name}>
              <Icon name={name} /> {name}
            </span>
          ))}
        </Cluster>
      </Group>

      <Group title="Diagram frame">
        <DiagramFrame
          label="Sample: a leg drawn with a visible edge, a hidden line below grade, and a dimension"
          caption="Lines take their width and dash pattern from the line tokens (#44)."
          viewBox="0 0 320 120"
        >
          <rect
            x="20"
            y="40"
            width="200"
            height="24"
            fill="var(--tone-2)"
            stroke="var(--ink)"
            strokeWidth="var(--line-visible)"
          />
          <line
            x1="220"
            y1="40"
            x2="290"
            y2="40"
            stroke="var(--hidden)"
            strokeWidth="var(--line-hidden)"
            strokeDasharray="var(--dash-hidden)"
          />
          <line
            x1="220"
            y1="64"
            x2="290"
            y2="64"
            stroke="var(--hidden)"
            strokeWidth="var(--line-hidden)"
            strokeDasharray="var(--dash-hidden)"
          />
          <line
            x1="220"
            y1="20"
            x2="220"
            y2="100"
            stroke="var(--ink)"
            strokeWidth="var(--line-grade)"
          />
          <line
            x1="20"
            y1="90"
            x2="220"
            y2="90"
            stroke="var(--dim)"
            strokeWidth="var(--line-dimension)"
          />
          <text
            x="120"
            y="110"
            textAnchor="middle"
            fill="var(--dim)"
            fontSize="14"
            fontWeight="600"
          >
            {leg.length}
          </text>
        </DiagramFrame>
      </Group>
    </Stack>
  );
}

function ShopSpecimens() {
  return (
    <Stack gap="m">
      <ModeBar mode="Building" exitHref="#/catalog" />
      <Stack gap="s">
        <p>
          {leg.name}, {leg.quantity}
        </p>
        <Glance>{leg.length}</Glance>
        <SawSetting setting={setting} toEdge={toEdge} />
        {burialFlag && (
          <ExpertCheck>
            <Measured text={burialFlag.ask} />
          </ExpertCheck>
        )}
        <StatusLine>{leg.name} cut</StatusLine>
        <Cluster>
          <Button>Done, next</Button>
          <Button variant="secondary">Back</Button>
        </Cluster>
      </Stack>
    </Stack>
  );
}
