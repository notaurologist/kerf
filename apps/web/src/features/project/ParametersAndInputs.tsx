import { type EnteredValue, enteredValues, type TemplateDefinition } from '@kerf/core';
import type { Project } from '../../lib/types.ts';
import {
  ButtonLink,
  Cluster,
  InputNeeded,
  Measured,
  MeasureTable,
  Stack,
  Text,
} from '../../ui/index.ts';

// The plan's last section (#40, section order A; #119): every parameter and structural input as
// entered, labeled as in the editor and read back through core's formatters, so the paper copy
// says what the plan was made from.

export function ParametersAndInputs(props: {
  project: Project;
  template: TemplateDefinition;
  editHref?: string;
}) {
  const { snapshot } = props.project;
  if (!snapshot) return null;
  const { form } = props.template;
  return (
    <Stack>
      <h3>Dimensions and hardware</h3>
      <Sections sections={enteredValues(form.params, snapshot.params)} />
      <h3>Structural inputs</h3>
      <Sections sections={enteredValues(form.structuralInputs, snapshot.structuralInputs)} needed />
      {props.editHref && (
        <Cluster>
          <ButtonLink variant="secondary" href={props.editHref}>
            Edit
          </ButtonLink>
        </Cluster>
      )}
    </Stack>
  );
}

function Sections(props: {
  sections: { title: string; values: EnteredValue[] }[];
  /** Structural inputs: one not entered is input needed (#43, rule 4), never filled in. */
  needed?: boolean;
}) {
  return (
    <>
      {props.sections
        .filter((s) => s.values.length > 0)
        .map((section) => (
          <Stack key={section.title} gap="xs">
            <h4>{section.title}</h4>
            <MeasureTable
              caption={section.title}
              captionHidden
              rows={section.values}
              rowKey={(v) => v.path}
              columns={[
                { key: 'field', label: 'Field', cell: (v) => v.label },
                {
                  key: 'entered',
                  label: 'As entered',
                  cell: (v) =>
                    v.text !== null ? (
                      <Measured text={v.text} />
                    ) : props.needed ? (
                      <InputNeeded />
                    ) : (
                      <Text tone="muted" as="span">
                        Not entered
                      </Text>
                    ),
                },
              ]}
            />
          </Stack>
        ))}
    </>
  );
}
