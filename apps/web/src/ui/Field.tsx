import { type ReactNode, useId } from 'react';
import { ErrorText, InputNeeded } from './feedback.tsx';

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
  /** Use a fixed id, so an error summary can link to the control. */
  id?: string;
  unit?: string;
  children: (control: ControlProps) => ReactNode;
}) {
  const generated = useId();
  const id = props.id ?? generated;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const echoId = `${id}-echo`;
  const describedBy = [
    props.error ? errorId : undefined,
    props.hint ? hintId : undefined,
    props.echo ? echoId : undefined,
  ]
    .filter(Boolean)
    .join(' ');
  const state = props.error ? 'error' : props.needed ? 'needed' : undefined;
  const control = props.children({
    id,
    'aria-describedby': describedBy || undefined,
    'aria-invalid': props.error ? true : undefined,
    className: 'k-field__input',
  });
  return (
    <div className="k-field" data-state={state}>
      <label className="k-field__label" htmlFor={id}>
        <span>{props.label}</span>
        {props.needed && !props.error && <InputNeeded />}
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
          <span>{props.unit}</span>
        </span>
      ) : (
        control
      )}
      {props.echo && (
        <span id={echoId} className="k-field__echo">
          {props.echo}
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
    type?: 'text' | 'password';
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
