// Values read at the store from what is bought (#355, Stage 13): only the boards and hardware
// themselves can say them, so the shopping list asks for them beside the lines they are read
// from. Generic: a template names the fields and the lines; nothing here knows what they are.

import type { IllustrationId } from '../knowledge/illustrations.ts';
import type { HardwareLine } from '../outputs/hardwareList.ts';
import type { Plan } from '../outputs/plan.ts';
import { lumberLineKey, type ShoppingLine } from '../outputs/shoppingList.ts';
import {
  enteredValues,
  type FormSource,
  formValues,
  type TemplateForm,
  visibleFields,
} from './form.ts';

export interface StoreReading {
  /** The field the value is entered in. */
  from: FormSource;
  path: string;
  /**
   * The shopping lines it is read from: the lumber lines whose boards hold a part's pieces, or
   * the hardware line with this description.
   */
  beside: { part: string } | { hardware: string };
  /** What to do, as the line says it while the value is still needed. */
  prompt: string;
  /** How to find it: where to look on the board or package, and what it looks like. */
  how: string;
  /**
   * What to do with the value once entered, for one that must be entered before a plan can be
   * made, such as a count to check against the maker's instructions.
   */
  check?: string;
  /** A drawing of what to read, from the glossary's illustrations. */
  illustration?: IllustrationId;
}

/** A reading beside its line, with the field's label and what was entered (null if nothing). */
export interface PlacedReading {
  reading: StoreReading;
  label: string;
  entered: string | null;
}

/** Readings by lumber line (`lumberLineKey`) and by hardware line description. */
export interface StoreReadingsByLine {
  lumber: ReadonlyMap<string, PlacedReading[]>;
  hardware: ReadonlyMap<string, PlacedReading[]>;
}

/**
 * Places each reading beside the plan's lines it is read from, with what was entered for it.
 * A reading whose field does not apply to the entered values, or whose line the plan does not
 * have, is left out.
 */
export function placeStoreReadings(
  readings: readonly StoreReading[],
  form: TemplateForm,
  plan: Pick<Plan, 'lumber' | 'hardware'>,
  params: unknown,
  inputs: unknown,
): StoreReadingsByLine {
  const objects = { params, structuralInputs: inputs } as const;
  const values = {
    ...formValues(form.params, params),
    ...formValues(form.structuralInputs, inputs),
  };
  const applies = (from: FormSource) =>
    new Set(visibleFields(form[from], values).map((f) => f.path));
  const visible = { params: applies('params'), structuralInputs: applies('structuralInputs') };

  const lumber = new Map<string, PlacedReading[]>();
  const hardware = new Map<string, PlacedReading[]>();
  const add = (map: Map<string, PlacedReading[]>, key: string, placed: PlacedReading) =>
    map.set(key, [...(map.get(key) ?? []), placed]);

  for (const reading of readings) {
    if (!visible[reading.from].has(reading.path)) continue;
    const value = enteredValues(form[reading.from], objects[reading.from])
      .flatMap((s) => s.values)
      .find((v) => v.path === reading.path);
    if (!value) continue;
    const placed = { reading, label: value.label, entered: value.text };
    if ('part' in reading.beside) {
      const { part } = reading.beside;
      const keys = new Set(
        plan.lumber.boards
          .filter((board) => board.pieces.some((piece) => piece.partId === part))
          .map(lumberLineKey),
      );
      for (const line of plan.lumber.lines) {
        const key = lumberLineKey(line);
        if (keys.has(key)) add(lumber, key, placed);
      }
    } else {
      const { hardware: description } = reading.beside;
      if (plan.hardware.some((line) => line.description === description)) {
        add(hardware, description, placed);
      }
    }
  }
  return { lumber, hardware };
}

/** The readings beside a lumber line. */
export function readingsBesideLumber(
  readings: StoreReadingsByLine,
  line: Pick<ShoppingLine, 'nominal' | 'feet'>,
): PlacedReading[] {
  return readings.lumber.get(lumberLineKey(line)) ?? [];
}

/** The readings beside a hardware line. */
export function readingsBesideHardware(
  readings: StoreReadingsByLine,
  line: Pick<HardwareLine, 'description'>,
): PlacedReading[] {
  return readings.hardware.get(line.description) ?? [];
}
