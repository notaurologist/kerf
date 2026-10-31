// How a template's parameters and structural inputs are entered, as data the web app renders
// (ARCHITECTURE.md, principle 6). Generic: a template lists its fields; nothing here knows what
// they describe. The template's Zod schemas stay the source of truth for what is valid.

import type { z } from 'zod';
import { formatAngle } from '../units/angle.ts';
import { formatLength } from '../units/length.ts';
import {
  describeLength,
  lengthForEntry,
  type Parsed,
  parseAngle,
  parseFractionalNumber,
  parseLength,
} from '../units/parse.ts';

/**
 * - `length`: inches, typed as a plan writes them (`138-3/8`, `11' 6-3/8"`) and read by
 *   `parseLength`; stored as decimal inches.
 * - `angle`: decimal degrees, read by `parseAngle`.
 * - `number`, `integer`: any other quantity, with `unit`. A `number` with `fractions` also
 *   takes tape fractions such as `1/4`.
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
  /** For `number`: also read fractions such as `1/4`, for quantities people write that way. */
  fractions?: boolean;
  help?: string;
  options?: readonly FieldOption[];
  /**
   * Shown and sent only when this returns true, given the form's current text for any path.
   * A field with no `when` always applies.
   */
  when?: (value: (path: string) => string) => boolean;
  /**
   * A parameter the owner enters or confirms (hard rule 3), such as a hardware size. A new
   * project started from a worked example leaves it empty, and one copied from an earlier project
   * asks the owner to confirm it (#98). Structural inputs are always treated this way.
   */
  confirmed?: true;
}

export interface FormSection {
  /**
   * The part of the project the fields describe. A section in the parameters and one in the
   * structural inputs with the same title are one part of the form (`formParts`).
   */
  title: string;
  help?: string;
  fields: readonly FormField[];
}

export interface TemplateForm {
  params: readonly FormSection[];
  /** Every structural input is optional to enter; a missing one makes its checks "input needed". */
  structuralInputs: readonly FormSection[];
  /** Shown once above the form, for what applies to fields in several parts. */
  help?: string;
}

/** Which object a field's value belongs to. */
export type FormSource = 'params' | 'structuralInputs';

/** A part of the project and its fields from both objects: parameters first, then inputs. */
export interface FormPart {
  title: string;
  help?: string;
  fields: readonly { from: FormSource; field: FormField }[];
}

/**
 * The form as it is shown, by part of the project: the parameters' sections in order, each with
 * the structural inputs' section of the same title, then the inputs' sections no parameter
 * section shares a title with.
 */
export function formParts(form: TemplateForm): FormPart[] {
  const parts = new Map<
    string,
    { title: string; help: string[]; fields: FormPart['fields'][number][] }
  >();
  const add = (from: FormSource, sections: readonly FormSection[]) => {
    for (const section of sections) {
      const part = parts.get(section.title) ?? { title: section.title, help: [], fields: [] };
      if (section.help) part.help.push(section.help);
      part.fields.push(...section.fields.map((field) => ({ from, field })));
      parts.set(section.title, part);
    }
  };
  add('params', form.params);
  add('structuralInputs', form.structuralInputs);
  return [...parts.values()].map(({ title, help, fields }) => ({
    title,
    ...(help.length > 0 ? { help: help.join(' ') } : {}),
    fields,
  }));
}

/** The form's text for each field path. Empty text means not entered. */
export type FormValues = Readonly<Record<string, string>>;

const getter = (values: FormValues) => (path: string) => values[path] ?? '';

/** The paths of the parameters the owner enters or confirms (#98). */
export function confirmedPaths(sections: readonly FormSection[]): Set<string> {
  return new Set(sections.flatMap((s) => s.fields.filter((f) => f.confirmed).map((f) => f.path)));
}

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

/**
 * Form text for a stored parameters or inputs object; fields it does not hold stay empty.
 * Lengths are written so that saving them again changes nothing (`lengthForEntry`).
 */
export function formValues(sections: readonly FormSection[], object: unknown): FormValues {
  const values: Record<string, string> = {};
  for (const field of sections.flatMap((s) => s.fields)) {
    const value = readPath(object, field.path);
    values[field.path] =
      field.kind === 'length' && typeof value === 'number'
        ? lengthForEntry(value)
        : typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean'
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
    default: {
      // Text that cannot be read goes through as NaN, which the schema also reports;
      // `entryProblems` says what to type instead.
      const parsed = read(field, text);
      return parsed?.ok ? parsed.value : Number(text.trim());
    }
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

/** The field's parser, for kinds typed as more than a plain number. */
function read(field: FormField, text: string): Parsed | undefined {
  if (field.kind === 'length') return parseLength(text);
  if (field.kind === 'angle') return parseAngle(text);
  if (field.kind === 'number' && field.fractions) return parseFractionalNumber(text);
  return undefined;
}

export interface EntryProblem {
  /** The field's path. */
  field: string;
  message: string;
}

/**
 * Entered text Kerf cannot read, with a message saying what to type, for each visible field.
 * Empty fields are left to the schema, which knows which are required.
 */
export function entryProblems(
  sections: readonly FormSection[],
  values: FormValues,
): EntryProblem[] {
  const problems: EntryProblem[] = [];
  for (const field of visibleFields(sections, values)) {
    const text = values[field.path] ?? '';
    if (text.trim() === '') continue;
    const parsed = read(field, text);
    if (parsed && !parsed.ok) problems.push({ field: field.path, message: parsed.message });
    else if (
      !parsed &&
      (field.kind === 'number' || field.kind === 'integer') &&
      !Number.isFinite(Number(text.trim()))
    ) {
      problems.push({ field: field.path, message: 'Enter a number.' });
    }
  }
  return problems;
}

/** A field as it was entered, for reading back on the plan (#119). */
export interface EnteredValue {
  path: string;
  /** The field's label, as the editor shows it. */
  label: string;
  /** The value through core's formatters; null when it was not entered. */
  text: string | null;
}

/**
 * Every field that applies to a stored parameters or inputs object, by section, as it reads back:
 * lengths in feet and inches and inches, angles in degrees, numbers with their unit, choices by
 * their label, yes or no. Hidden fields (such as a footprint depth when the splay is an angle) are
 * left out; fields that apply but were not entered have no text.
 */
export function enteredValues(
  sections: readonly FormSection[],
  object: unknown,
): { title: string; values: EnteredValue[] }[] {
  const visible = new Set(visibleFields(sections, formValues(sections, object)).map((f) => f.path));
  return sections.map((section) => ({
    title: section.title,
    values: section.fields
      .filter((f) => visible.has(f.path))
      .map((field) => ({
        path: field.path,
        label: field.label,
        text: enteredText(field, readPath(object, field.path)),
      })),
  }));
}

/**
 * Every field that applies to stored parameters and inputs, by part of the project
 * (`formParts`), as `enteredValues` reads them back, each saying which object it is from.
 */
export function enteredParts(
  form: TemplateForm,
  params: unknown,
  inputs: unknown,
): { title: string; values: (EnteredValue & { from: FormSource })[] }[] {
  const read = new Map(
    (
      [
        ['params', enteredValues(form.params, params)],
        ['structuralInputs', enteredValues(form.structuralInputs, inputs)],
      ] as const
    ).flatMap(([from, sections]) =>
      sections.flatMap((s) => s.values.map((v) => [`${from} ${v.path}`, { ...v, from }] as const)),
    ),
  );
  return formParts(form).map((part) => ({
    title: part.title,
    values: part.fields.flatMap(({ from, field }) => read.get(`${from} ${field.path}`) ?? []),
  }));
}

function enteredText(field: FormField, value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  switch (field.kind) {
    case 'yes-no':
      return value === true ? 'Yes' : value === false ? 'No' : null;
    case 'choice':
      return field.options?.find((o) => o.value === value)?.label ?? String(value);
    case 'length':
      return typeof value === 'number' ? describeLength(value) : null;
    default:
      return typeof value === 'number' ? inFieldUnits(field, value) : String(value);
  }
}

/**
 * What a length field's text reads as, for the line under it while typing: core's reading, or
 * "Not a length yet". Null for an empty field or a field that is not a length.
 */
export function entryEcho(field: FormField, text: string): string | null {
  if (field.kind !== 'length' || text.trim() === '') return null;
  const parsed = parseLength(text);
  return parsed.ok ? describeLength(parsed.value) : 'Not a length yet';
}

/** A number written the way the field is entered: lengths in feet and inches, angles in degrees. */
function inFieldUnits(field: FormField, n: number): string {
  if (field.kind === 'length' && n >= 0) return formatLength(n, 'feet-inches');
  if (field.kind === 'angle') return formatAngle(n);
  const unit = field.unit ?? '';
  return unit === '' ? String(n) : unit === '%' ? `${n}%` : `${n} ${unit}`;
}

/** A schema problem, in the shape Zod reports it. */
export interface SchemaProblem {
  code: string;
  path: readonly PropertyKey[];
  message: string;
  minimum?: number | bigint;
  maximum?: number | bigint;
  inclusive?: boolean;
  expected?: string;
}

/**
 * Plain words for a schema problem with a field, following the content guide
 * (docs/design/content.md): say what to enter, with limits in the field's own units. When the
 * schema sets both limits on the number, both are given ("must be from 5' 0" to 12' 0"").
 */
export function schemaProblemMessage(
  field: FormField,
  problem: SchemaProblem,
  text: string,
  schema?: z.ZodType,
): string {
  if (text.trim() === '') {
    if (field.kind === 'choice' || field.kind === 'yes-no') return 'Choose one of the options.';
    return field.kind === 'length'
      ? 'Enter a length.'
      : field.kind === 'angle'
        ? 'Enter an angle.'
        : 'Enter a number.';
  }
  const bounds = schema ? numberBounds(schema, problem.path) : undefined;
  if ((problem.code === 'too_small' || problem.code === 'too_big') && bounds) {
    return `${field.label} must be from ${inFieldUnits(field, bounds.min)} to ${inFieldUnits(field, bounds.max)}.`;
  }
  switch (problem.code) {
    case 'invalid_type':
      if (problem.expected === 'int') return 'Enter a whole number.';
      return field.kind === 'length'
        ? 'Enter a length.'
        : field.kind === 'angle'
          ? 'Enter an angle.'
          : 'Enter a number.';
    case 'too_small':
      return `${field.label} must be ${problem.inclusive === false ? 'more than' : 'at least'} ${inFieldUnits(field, Number(problem.minimum))}.`;
    case 'too_big':
      return `${field.label} must be ${problem.inclusive === false ? 'less than' : 'at most'} ${inFieldUnits(field, Number(problem.maximum))}.`;
    case 'invalid_value':
    case 'invalid_union':
      return 'Choose one of the options.';
    default:
      return problem.message;
  }
}

interface ZodDef {
  type: string;
  shape?: Record<string, z.ZodType>;
  items?: z.ZodType[];
  innerType?: z.ZodType;
  options?: z.ZodType[];
  checks?: { _zod: { def: { check: string; value?: unknown; inclusive?: boolean } } }[];
}
// Zod 4 keeps a schema's structure on `_zod.def`; reading it is how core finds a number's limits
// without repeating them beside the schema.
const defOf = (schema: z.ZodType) => (schema as unknown as { _zod: { def: ZodDef } })._zod.def;

/**
 * The minimum and maximum a schema sets on the number at `path`, when both are set and
 * inclusive. Follows objects, tuples, optional values, and unions.
 */
function numberBounds(
  schema: z.ZodType,
  path: readonly PropertyKey[],
): { min: number; max: number } | undefined {
  const def = defOf(schema);
  if (def.type === 'optional' || def.type === 'nullable') {
    return def.innerType && numberBounds(def.innerType, path);
  }
  if (def.type === 'union') {
    for (const option of def.options ?? []) {
      const found = numberBounds(option, path);
      if (found) return found;
    }
    return undefined;
  }
  if (path.length === 0) {
    if (def.type !== 'number') return undefined;
    let min: number | undefined;
    let max: number | undefined;
    for (const check of def.checks ?? []) {
      const { check: kind, value, inclusive } = check._zod.def;
      if (typeof value !== 'number' || inclusive !== true) continue;
      if (kind === 'greater_than') min = value;
      if (kind === 'less_than') max = value;
    }
    return min !== undefined && max !== undefined ? { min, max } : undefined;
  }
  const [key, ...rest] = path;
  if (def.type === 'object' && typeof key === 'string') {
    const child = def.shape?.[key];
    return child && numberBounds(child, rest);
  }
  if (def.type === 'tuple' && typeof key === 'number') {
    const child = def.items?.[key];
    return child && numberBounds(child, rest);
  }
  return undefined;
}
