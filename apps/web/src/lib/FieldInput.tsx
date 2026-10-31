import { entryEcho, type FormField } from '@kerf/core';
import { Field, Select, TextInput, YesNo } from '../ui/index.ts';

// One field of a form described as data (core's FormField): a template's parameters and inputs,
// or a tool's capabilities. Core reads what is typed; this renders it.

// Lengths carry no unit after the field: they can be typed in feet and inches, and the line
// under the field says how Kerf read them.
const UNITS: Partial<Record<FormField['kind'], string>> = { angle: '°' };

/** The format a length is typed in (content guide: hints give the format, never a sample value). */
const LENGTH_HINT = 'Inches, or feet and inches.';

/** Which on-screen keyboard to show. Lengths and fractions need ', ", /, and -. */
function keyboard(field: FormField): 'numeric' | 'decimal' | 'text' {
  if (field.kind === 'integer') return 'numeric';
  if (field.kind === 'length' || (field.kind === 'number' && field.fractions)) return 'text';
  return 'decimal';
}

export function FieldInput(props: {
  id: string;
  field: FormField;
  text: string;
  issue: string | undefined;
  onChange: (text: string) => void;
  readOnly?: boolean;
  needed?: boolean;
  /** A copied structural input waiting to be confirmed (#98); see `Field`. */
  confirm?: string;
  /** Where a suggested value came from (#163); see `Field`. */
  about?: string;
}) {
  const { field, text } = props;
  const unit = field.unit || UNITS[field.kind];
  const help =
    field.kind === 'length' ? [field.help, LENGTH_HINT].filter(Boolean).join(' ') : field.help;
  return (
    <Field
      id={props.id}
      label={field.label}
      hint={help}
      error={props.issue}
      echo={entryEcho(field, text)}
      needed={props.needed && text.trim() === ''}
      confirm={props.confirm}
      about={props.about}
      unit={unit}
      width={field.kind === 'choice' || field.kind === 'yes-no' ? 'medium' : 'short'}
    >
      {(c) =>
        field.kind === 'yes-no' ? (
          <YesNo {...c} value={text} onChange={props.onChange} />
        ) : field.kind === 'choice' ? (
          <Select
            {...c}
            value={text}
            onChange={props.onChange}
            options={(field.options ?? []).map((o) => ({ value: String(o.value), label: o.label }))}
          />
        ) : (
          <TextInput
            {...c}
            keyboard={keyboard(field)}
            value={text}
            onChange={props.onChange}
            readOnly={props.readOnly}
          />
        )
      }
    </Field>
  );
}
