import {
  type CutListRow,
  createSnapshot,
  entryEcho,
  type FormField,
  formValues,
  parseLength,
  schemaProblemMessage,
  structural,
  TEMPLATES,
  type TemplateDefinition,
} from '@kerf/core';

/** "saw at 20.0°, 70.0° to the edge" in a cut list's end text. */
const SAW = /saw at ([\d.]+°), ([\d.]+°) to the edge/;

import { type ReactNode, useState } from 'react';
import { Button, ButtonLink } from './Button.tsx';
import { Diagram } from './Diagram.tsx';
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
// (#45). Sample values are core's output for the first template's worked examples, formatted by
// core, chosen by what the data holds rather than by name, so the design system knows no
// template (ARCHITECTURE.md, principle 6). Nothing here is made up.

const template = TEMPLATES[0] as TemplateDefinition;
function made(index: number) {
  const example = template.examples[index];
  const result = createSnapshot(template, example?.params, example?.structuralInputs);
  if (!result.ok) throw new Error(`The worked example ${index} does not generate.`);
  const outputs = template.outputs.parse(result.output.outputs);
  return { outputs, plan: template.plan(outputs) };
}
const first = made(0);
const last = made(template.examples.length - 1);
const rows = first.plan.cutList;
/** A part with an angled end and a marked length, for the cut-card samples. */
function samplePart(): CutListRow {
  const row = rows.find((r) => r.marks.length > 0 && r.ends.some((e) => SAW.test(e))) ?? rows[0];
  if (!row) throw new Error('The worked example has no parts.');
  return row;
}
const part = samplePart();
/** Another part, for the tables. */
const other = rows.find((r) => r !== part) ?? part;
/** The saw setting and angle to the edge, as core wrote them in the cut list. */
const [, setting = '', toEdge = ''] = part.ends.map((e) => SAW.exec(e)).find(Boolean) ?? [];
const computed = (plan: typeof first.plan) =>
  plan.checks.find((c): c is Extract<typeof c, { status: 'computed' }> => c.status === 'computed');
const check = computed(first.plan);
const margin = check ? structural.formatMargin(check.margin) : '';
const sampleFlag = first.plan.flags[0];
// The worked example's drawings, drawn by core from its outputs (#90), as the API does.
const drawings = template.drawings(first.outputs);
const partDetail = drawings.cutDetails.find((d) => d.title.endsWith(part.name));
/** Length fields from the template's form, for the field samples. */
const lengths = template.form.params.flatMap((s) => s.fields).filter((f) => f.kind === 'length');
const heightField = (lengths[1] ?? lengths[0]) as FormField;
const otherField = (lengths[lengths.length - 1] ?? heightField) as FormField;
/** Core's message for a value out of range, with the limits from the template's schema. */
const rangeMessage = (f: FormField, text: string) =>
  schemaProblemMessage(f, { code: 'too_big', path: [f.path], message: '' }, text, template.params);

const CUT_ROWS = [part, other];

/** Sample fields of each kind from the template's form, with the worked example's values. */
const allFields = [...template.form.params, ...template.form.structuralInputs].flatMap(
  (x) => x.fields,
);
const ofKind = (kind: FormField['kind']) => allFields.find((f) => f.kind === kind);
const exampleValues = {
  ...formValues(template.form.params, template.examples[0]?.params),
  ...formValues(template.form.structuralInputs, template.examples[0]?.structuralInputs),
};
const angleField = ofKind('angle');
const choiceField = ofKind('choice');
const yesNoField = ofKind('yes-no');
const numberField = template.form.structuralInputs
  .flatMap((x) => x.fields)
  .find((f) => f.kind === 'number');
const readOnlyField = lengths[0];

// A preview against a saved plan: the last worked example as the preview, the first as what was
// saved. Both are core's output for their parameters.
const previewPart = last.plan.cutList.find((r) => r.partId === part.partId);
const lastCheck = computed(last.plan);
const previewMargin = lastCheck ? structural.formatMargin(lastCheck.margin) : '';
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
            Sample values come from the first template's worked example, formatted by core.
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
          label={heightField.label}
          hint="Inches, or feet and inches."
          echo={entryEcho(heightField, text)}
        >
          {(c) => <TextInput {...c} value={text} onChange={setText} />}
        </Field>
        <Field id="catalog-unread" label={otherField.label} echo={entryEcho(otherField, '8 0')}>
          {(c) => <TextInput {...c} value="8 0" onChange={() => {}} />}
        </Field>
        <Field
          id="catalog-range"
          label={heightField.label}
          error={rangeMessage(heightField, "15'")}
          echo={entryEcho(heightField, "15'")}
        >
          {(c) => <TextInput {...c} value="15'" onChange={() => {}} />}
        </Field>
        {numberField && (
          <Field label={numberField.label} hint={numberField.help} needed>
            {(c) => <TextInput {...c} keyboard="decimal" value="" onChange={() => {}} />}
          </Field>
        )}
        {angleField && (
          <Field label={angleField.label} unit="°">
            {(c) => (
              <TextInput
                {...c}
                keyboard="decimal"
                value={exampleValues[angleField.path] ?? ''}
                onChange={() => {}}
              />
            )}
          </Field>
        )}
        {choiceField && (
          <Field label={choiceField.label}>
            {(c) => (
              <Select
                {...c}
                value={choice}
                onChange={setChoice}
                options={(choiceField.options ?? []).map((o) => ({
                  value: String(o.value),
                  label: o.label,
                }))}
              />
            )}
          </Field>
        )}
        {yesNoField && (
          <Field label={yesNoField.label}>
            {(c) => <YesNo {...c} value={yes} onChange={setYes} />}
          </Field>
        )}
        {readOnlyField && (
          <Field label={readOnlyField.label}>
            {(c) => (
              <TextInput
                {...c}
                value={exampleValues[readOnlyField.path] ?? ''}
                onChange={() => {}}
                readOnly
              />
            )}
          </Field>
        )}
      </Group>

      <Group title="Errors">
        <ErrorSummary
          takeFocus={false}
          items={[
            { field: 'catalog-unread', message: unreadable },
            { field: 'catalog-range', message: rangeMessage(heightField, "15'") },
          ]}
        />
        <ErrorText>Enter a length.</ErrorText>
      </Group>

      <Group title="Notices">
        {sampleFlag && (
          <ExpertCheck why={<Measured text={sampleFlag.why} />}>
            <Measured text={sampleFlag.ask} />
          </ExpertCheck>
        )}
        <p>
          {numberField?.label ?? 'An input'} <InputNeeded />
        </p>
        <Notice icon="connection">
          <b>Not saved.</b> Kerf could not reach the server. Your changes are still here. Save again
          when you have a connection.
        </Notice>
        <StatusLine>Saved. The plan was regenerated.</StatusLine>
        <p>
          {part.name}, 1 of {part.quantity} cut <Pending />
        </p>
        <Loading delayMs={0}>Loading project…</Loading>
      </Group>

      <Group title="Numbers">
        <p>
          {part.marks[0]?.label}: <Length>{part.marks[0]?.value ?? ''}</Length>
        </p>
        <MarginLine margin={margin} />
        <Card>
          <Stack gap="xs">
            <span>
              {part.name}, {part.quantity}
            </span>
            <Glance>{part.length}</Glance>
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
          rows={[other, { ...part, length: previewPart?.length ?? '' }]}
          rowChanged={(r) => r.partId === part.partId}
          columns={[
            { key: 'part', label: 'Part', cell: (r) => r.name },
            {
              key: 'length',
              label: 'Length',
              numeric: true,
              cell: (r) =>
                r.partId === part.partId ? (
                  <Changed was={part.length}>
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
            <b>{check ? `${check.title}: ${check.subject}` : 'A check'}</b>
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

      <Group title="Drawings">
        {drawings.isometric && (
          <Diagram
            drawing={drawings.isometric}
            label={`Isometric view. ${drawings.isometric.description}`}
            selected={other.partId}
          />
        )}
        {partDetail && <Diagram drawing={partDetail} label={partDetail.description} />}
      </Group>

      <Group title="Diagram frame">
        <DiagramFrame
          label="Sample: a part drawn with a visible edge, a hidden line below grade, and a dimension"
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
            {part.length}
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
          {part.name}, {part.quantity}
        </p>
        <Glance>{part.length}</Glance>
        <SawSetting setting={setting} toEdge={toEdge} />
        {sampleFlag && (
          <ExpertCheck>
            <Measured text={sampleFlag.ask} />
          </ExpertCheck>
        )}
        <StatusLine>{part.name} cut</StatusLine>
        <Cluster>
          <Button>Done, next</Button>
          <Button variant="secondary">Back</Button>
        </Cluster>
      </Stack>
    </Stack>
  );
}
