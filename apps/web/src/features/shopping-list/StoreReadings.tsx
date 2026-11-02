import {
  findTemplate,
  ILLUSTRATIONS,
  type PlacedReading,
  type Plan,
  placeStoreReadings,
  type StoreReading,
  type StoreReadingsByLine,
} from '@kerf/core';
import { fieldId } from '../../lib/fieldIds.ts';
import { type EditFrom, href } from '../../lib/route.ts';
import type { Project } from '../../lib/types.ts';
import {
  Cluster,
  DefinitionFigure,
  Diagram,
  Disclosure,
  InputNeeded,
  Measured,
  PlainList,
  Stack,
  Text,
} from '../../ui/index.ts';

// Values read at the store (#390; Stage 13): the template names each field and the shopping line
// it is read from. While a value is still needed its line says what to read and how to find it,
// and opens Edit on the field; once entered it says what was entered.

/** The project's store readings by shopping line, or none for a template that asks for none. */
export function projectStoreReadings(
  project: Project,
  plan: Pick<Plan, 'lumber' | 'hardware'>,
): StoreReadingsByLine | undefined {
  const template = findTemplate(project.templateId);
  if (!template?.storeReadings || !project.snapshot) return undefined;
  return placeStoreReadings(
    template.storeReadings,
    template.form,
    plan,
    project.snapshot.params,
    project.snapshot.structuralInputs,
  );
}

/** Where a reading's field opens in Edit, returning to `from` on Save or Cancel. */
export function readingHref(project: Pick<Project, 'id'>, from: EditFrom) {
  return (reading: StoreReading) =>
    href({
      screen: 'edit-project',
      id: project.id,
      from,
      field: fieldId(reading.from, reading.path),
    });
}

/** Each reading once, in order, from the lines of a group. */
export function uniqueReadings(lists: readonly PlacedReading[][]): PlacedReading[] {
  const seen = new Set<StoreReading>();
  return lists.flat().filter((p) => !seen.has(p.reading) && seen.add(p.reading));
}

/** Each reading still needed, once, for the printed plan's terms. */
export function neededReadings(readings: StoreReadingsByLine | undefined): PlacedReading[] {
  if (!readings) return [];
  return uniqueReadings([...readings.lumber.values(), ...readings.hardware.values()]).filter(
    (p) => p.entered === null,
  );
}

export function StoreReadings(props: {
  readings: readonly PlacedReading[];
  readingHref: (reading: StoreReading) => string;
}) {
  if (props.readings.length === 0) return null;
  return (
    <PlainList gap="xs">
      {props.readings.map((placed) => (
        <li key={`${placed.reading.from} ${placed.reading.path}`}>
          <Reading placed={placed} href={props.readingHref(placed.reading)} />
        </li>
      ))}
    </PlainList>
  );
}

function Reading(props: { placed: PlacedReading; href: string }) {
  const { reading, label, entered } = props.placed;
  if (entered !== null) {
    return (
      <Text>
        {label}: <b>{entered}</b>. {reading.check && `${reading.check} `}
        <a href={props.href}>Change</a>
      </Text>
    );
  }
  const drawing = reading.illustration ? ILLUSTRATIONS[reading.illustration] : undefined;
  return (
    <Stack gap="2xs">
      <Cluster>
        <a href={props.href}>{reading.prompt}</a>
        <InputNeeded />
      </Cluster>
      <Text tone="muted">
        <Measured text={reading.how} terms />
      </Text>
      {drawing && (
        <Disclosure summary={`${drawing.title}: what each part says`}>
          <DefinitionFigure>
            <Diagram drawing={drawing} label={drawing.description} />
          </DefinitionFigure>
        </Disclosure>
      )}
    </Stack>
  );
}
