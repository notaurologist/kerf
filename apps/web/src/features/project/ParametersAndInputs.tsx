import { enteredParts, type TemplateDefinition } from '@kerf/core';
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
// entered, labeled and grouped by part as in the editor and read back through core's formatters,
// so the paper copy says what the plan was made from.

export function ParametersAndInputs(props: {
  project: Project;
  template: TemplateDefinition;
  editHref?: string;
}) {
  const { snapshot } = props.project;
  if (!snapshot) return null;
  const parts = enteredParts(props.template.form, snapshot.params, snapshot.structuralInputs);
  return (
    <Stack>
      {parts
        .filter((part) => part.values.length > 0)
        .map((part) => (
          <Stack key={part.title} gap="xs">
            <h3>{part.title}</h3>
            <MeasureTable
              caption={part.title}
              captionHidden
              equalColumns
              rows={part.values}
              rowKey={(v) => `${v.from} ${v.path}`}
              columns={[
                { key: 'field', label: 'Field', cell: (v) => v.label },
                {
                  key: 'entered',
                  label: 'As entered',
                  cell: (v) =>
                    v.text !== null ? (
                      <Measured text={v.text} />
                    ) : v.from === 'structuralInputs' ? (
                      // One not entered is input needed (#43, rule 4), never filled in.
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
