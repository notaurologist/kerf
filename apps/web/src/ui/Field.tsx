import { type ReactNode, useId } from 'react';
import { ErrorText, goToField, InputNeeded } from './feedback.tsx';
import { Stack } from './layout.tsx';
import { Text } from './text.tsx';

// A form field (#67): label, hint, error, the control, and the line under it saying what Kerf
// read. The error sits above the control so it is read before the value it is about. Errors
// appear only after a save (#67, timing); the echo appears while typing.

/** What a control needs from its field to be labeled and described. */
export interface ControlProps {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: true;
  className: string;
}

export function Field(props: {
  label: ReactNode;
  hint?: ReactNode;
  /** Shown after a save that could not use this value. */
  error?: string;
  /** Core's reading of what was typed, such as `11' 6-3/8" · 138-3/8"`. */
  echo?: string | null;
  /** An empty structural input: a question, not a mistake (#43, rule 4). */
  needed?: boolean;
  /**
   * A value copied from another project and not confirmed yet (#98): shown like an empty input,
   * with this text in place of "Input needed".
   */
  confirm?: string;
  /**
   * Where a suggested value came from (#163), such as "Rule of thumb: …". Shown under the
   * control while the value is the suggestion.
   */
  about?: string;
  /** Use a fixed id, so an error summary can link to the control. */
  id?: string;
  unit?: string;
  /**
   * The control's width for what is typed in it: `short` for a number or length, `medium` for a
   * name or a choice. Unset, it fills the field.
   */
  width?: 'short' | 'medium';
  children: (control: ControlProps) => ReactNode;
}) {
  const generated = useId();
  const id = props.id ?? generated;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const echoId = `${id}-echo`;
  const aboutId = `${id}-about`;
  const unitId = `${id}-unit`;
  const describedBy = [
    props.error ? errorId : undefined,
    props.unit ? unitId : undefined,
    props.hint ? hintId : undefined,
    props.echo ? echoId : undefined,
    props.about ? aboutId : undefined,
  ]
    .filter(Boolean)
    .join(' ');
  const state = props.error ? 'error' : props.needed || props.confirm ? 'needed' : undefined;
  const control = props.children({
    id,
    'aria-describedby': describedBy || undefined,
    'aria-invalid': props.error ? true : undefined,
    className: 'k-field__input',
  });
  return (
    <div className="k-field" data-state={state} data-width={props.width}>
      <label className="k-field__label" htmlFor={id}>
        <span>{props.label}</span>
        {props.needed && !props.error && <InputNeeded />}
        {props.confirm && !props.needed && !props.error && (
          <InputNeeded>{props.confirm}</InputNeeded>
        )}
      </label>
      {props.hint && (
        <span id={hintId} className="k-field__hint">
          {props.hint}
        </span>
      )}
      {props.error && <ErrorText id={errorId}>{props.error}</ErrorText>}
      {props.unit ? (
        <span className="k-field__unit">
          {control}
          <span id={unitId}>{props.unit}</span>
        </span>
      ) : (
        control
      )}
      {props.echo && (
        <span id={echoId} className="k-field__echo">
          {props.echo}
        </span>
      )}
      {props.about && (
        <span id={aboutId} className="k-field__about">
          {props.about}
        </span>
      )}
    </div>
  );
}

/** Text a length is typed into: the full keyboard, with the phone's corrections off (#67). */
export function TextInput(
  props: ControlProps & {
    value: string;
    onChange: (text: string) => void;
    keyboard?: 'text' | 'decimal' | 'numeric';
    readOnly?: boolean;
    type?: 'text' | 'password' | 'search';
    autoComplete?: string;
  },
) {
  const { value, onChange, keyboard = 'text', ...rest } = props;
  const typed = keyboard === 'text' && props.type !== 'password';
  return (
    <input
      {...rest}
      type={props.type ?? 'text'}
      inputMode={keyboard}
      autoCapitalize={typed ? 'off' : undefined}
      autoCorrect={typed ? 'off' : undefined}
      spellCheck={typed ? false : undefined}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export interface Option {
  value: string;
  label: string;
}

/**
 * A choice with nothing chosen at first, so no option is a stand-in value (hard rule 3), unless
 * the menu always has a value.
 */
export function Select(
  props: ControlProps & {
    value: string;
    onChange: (value: string) => void;
    options: readonly Option[];
    /** False for a menu that always has a value, such as a capability's kind. */
    placeholder?: boolean;
  },
) {
  const { value, onChange, options, placeholder = true, ...rest } = props;
  return (
    <select {...rest} value={value} onChange={(e) => onChange(e.target.value)}>
      {placeholder && <option value="">Choose…</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/**
 * A menu that always has a value, such as a project's status, with its label read by screen
 * readers only, for a row where the layout already says what it is.
 */
export function CompactSelect(props: {
  label: string;
  value: string;
  options: readonly Option[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="k-compact-select">
      <span className="k-visually-hidden">{props.label}</span>
      <select
        className="k-field__input"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      >
        {props.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Yes or no, chosen explicitly: there is no unchecked default (core's `yes-no` field). */
export function YesNo(props: ControlProps & { value: string; onChange: (value: string) => void }) {
  return (
    <Select
      {...props}
      options={[
        { value: 'true', label: 'Yes' },
        { value: 'false', label: 'No' },
      ]}
    />
  );
}

/** Related fields under one heading, such as "Dimensions" or "Loads", with optional help. */
export function FieldGroup(props: { legend: string; help?: ReactNode; children: ReactNode }) {
  return (
    <fieldset className="k-fieldset">
      <legend>{props.legend}</legend>
      {props.help && <p className="k-field__hint">{props.help}</p>}
      {props.children}
    </fieldset>
  );
}

/**
 * How much of a long form is entered, and the groups with fields still empty, each a link to its
 * first empty field.
 */
export function FormProgress(props: {
  entered: number;
  total: number;
  /** Each group with an empty field: its name and the id of its first empty field's control. */
  empty: readonly { group: string; field: string }[];
}) {
  const links = props.empty.map((e, i) => (
    <span key={e.group}>
      {i === 0 ? '' : i === props.empty.length - 1 ? (i > 1 ? ', and ' : ' and ') : ', '}
      <a href={`#${e.field}`} onClick={(event) => goToField(e.field, event, document)}>
        {e.group}
      </a>
    </span>
  ));
  return (
    <Stack gap="3xs">
      <Text>
        <b>
          {props.entered} of {props.total} entered
        </b>
      </Text>
      {links.length > 0 && <Text tone="muted">Still empty: {links}.</Text>}
    </Stack>
  );
}
