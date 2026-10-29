// How a template's parameters and structural inputs are entered, as data the web app renders
// (ARCHITECTURE.md, principle 6). Generic: a template lists its fields; nothing here knows what
// they describe. The template's Zod schemas stay the source of truth for what is valid.

/**
 * - `length`: decimal inches, shown back through `formatLength`.
 * - `angle`: degrees.
 * - `number`, `integer`: any other quantity, with `unit`.
 * - `choice`: one of `options`, stored as the option's value.
 * - `yes-no`: a boolean, chosen explicitly (there is no unchecked default).
 */
export type FieldKind = 'length' | 'angle' | 'number' | 'integer' | 'choice' | 'yes-no';

export interface FieldOption {
  value: string | number;
  label: string;
}

export interface FormField {
  /** Dotted path into the parameters or inputs object; numeric segments index tuples. */
  path: string;
  label: string;
  kind: FieldKind;
  /** For `number` and `integer`, such as 'lb' or '%'. Lengths are inches, angles degrees. */
  unit?: string;
  help?: string;
  options?: readonly FieldOption[];
  /**
   * Shown and sent only when this returns true, given the form's current text for any path.
   * A field with no `when` always applies.
   */
  when?: (value: (path: string) => string) => boolean;
}

export interface FormSection {
  title: string;
  help?: string;
  fields: readonly FormField[];
}

export interface TemplateForm {
  params: readonly FormSection[];
  /** Every structural input is optional to enter; a missing one makes its checks "input needed". */
  structuralInputs: readonly FormSection[];
}

/** The form's text for each field path. Empty text means not entered. */
export type FormValues = Readonly<Record<string, string>>;

const getter = (values: FormValues) => (path: string) => values[path] ?? '';

/** The fields that apply to the current values, in order. */
export function visibleFields(sections: readonly FormSection[], values: FormValues): FormField[] {
  const value = getter(values);
  return sections.flatMap((s) => s.fields.filter((f) => !f.when || f.when(value)));
}

function readPath(object: unknown, path: string): unknown {
  let at: unknown = object;
  for (const key of path.split('.')) {
    if (typeof at !== 'object' || at === null) return undefined;
    at = (at as Record<string, unknown>)[key];
  }
  return at;
}

/** Form text for a stored parameters or inputs object; fields it does not hold stay empty. */
export function formValues(sections: readonly FormSection[], object: unknown): FormValues {
  const values: Record<string, string> = {};
  for (const field of sections.flatMap((s) => s.fields)) {
    const value = readPath(object, field.path);
    values[field.path] =
      typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean'
        ? String(value)
        : '';
  }
  return values;
}

function fieldValue(field: FormField, text: string): unknown {
  switch (field.kind) {
    case 'yes-no':
      return text === 'true';
    case 'choice': {
      const option = field.options?.find((o) => String(o.value) === text);
      return option ? option.value : text;
    }
    default:
      // Text that is not a number goes through as NaN, which the schema reports.
      return Number(text.trim());
  }
}

/**
 * The object to validate and send: each visible, entered field at its path, as its kind's type.
 * Numeric path segments make arrays (tuples). Fields left empty or hidden are left out, so the
 * schema reports what is required and nothing gets a stand-in value.
 */
export function buildFromForm(
  sections: readonly FormSection[],
  values: FormValues,
): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  for (const field of visibleFields(sections, values)) {
    const text = values[field.path] ?? '';
    if (text.trim() === '') continue;
    const keys = field.path.split('.');
    let at: Record<string, unknown> | unknown[] = root;
    keys.forEach((key, i) => {
      const last = i === keys.length - 1;
      const slot = at as Record<string, unknown>;
      if (last) {
        slot[key] = fieldValue(field, text);
        return;
      }
      if (slot[key] === undefined) slot[key] = /^\d+$/.test(keys[i + 1] ?? '') ? [] : {};
      at = slot[key] as Record<string, unknown>;
    });
  }
  return root;
}
