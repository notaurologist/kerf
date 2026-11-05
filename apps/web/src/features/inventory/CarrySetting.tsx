import {
  type FormField,
  lengthForEntry,
  OwnerSettings,
  parseLength,
  type RevisedOwnerSettings,
} from '@kerf/core';
import { useState } from 'react';
import { api, failureOf, type SaveState, send } from '../../lib/api.ts';
import { FieldInput } from '../../lib/FieldInput.tsx';
import { useLoad } from '../../lib/useLoad.ts';
import { Button, Cluster, Notice, SaveFailed, Stack, StatusLine, Text } from '../../ui/index.ts';

// The longest board the owner can carry (#690): entered once, like the tools, and used by every
// project's shopping list. Empty means no limit. Kerf suggests no value, since it depends on the
// owner's vehicle.

const CARRY_FIELD: FormField = {
  path: 'carryLength',
  label: 'Longest board you can carry',
  kind: 'length',
  help: 'Measure what fits in your vehicle with the doors or tailgate closed, or ask the store what it can load. Leave it empty for no limit.',
  optional: true,
};

export function CarrySetting() {
  const { loaded, set } = useLoad(() => send(api.api.settings.$get()), 'settings');
  if (loaded.state !== 'ready') return null;
  return <CarryEditor key={loaded.value.revision} saved={loaded.value} onSaved={set} />;
}

/** What the field's text reads as: a length, none, or a message saying what to type. */
export function readCarry(
  text: string,
): { ok: true; value: number | null } | { ok: false; message: string } {
  if (text.trim() === '') return { ok: true, value: null };
  const parsed = parseLength(text);
  if (!parsed.ok) return parsed;
  const checked = OwnerSettings.shape.carryLength.safeParse(parsed.value);
  return checked.success
    ? { ok: true, value: checked.data }
    : { ok: false, message: 'Enter a length longer than 0.' };
}

export function CarryEditor(props: {
  saved: RevisedOwnerSettings;
  onSaved: (settings: RevisedOwnerSettings) => void;
}) {
  const [text, setText] = useState(
    props.saved.carryLength === null ? '' : lengthForEntry(props.saved.carryLength),
  );
  const [save, setSave] = useState<SaveState>({ state: 'idle' });
  const [issue, setIssue] = useState<string | undefined>(undefined);
  const [stale, setStale] = useState(false);
  const read = readCarry(text);
  const changed = read.ok ? read.value !== props.saved.carryLength : true;

  const submit = async () => {
    if (!read.ok) {
      setIssue(read.message);
      return;
    }
    setIssue(undefined);
    setSave({ state: 'saving' });
    const result = await send(
      api.api.settings.$put({ json: { carryLength: read.value, revision: props.saved.revision } }),
    );
    if (result.ok) {
      setSave({ state: 'saved' });
      props.onSaved(result.value);
    } else if (result.error.kind === 'stale') {
      setStale(true);
      setSave({ state: 'idle' });
    } else {
      setSave({ state: 'failed', failure: failureOf(result.error) });
    }
  };

  return (
    <Stack as="section" gap="xs">
      <h2>Carrying lumber</h2>
      <Text>
        Shopping lists buy the fewest feet of lumber. Where two plans buy the same feet, they choose
        boards no longer than this, and a line with longer boards says what boards within it would
        cost. Plans already made keep their boards until you update them.
      </Text>
      <FieldInput
        id="carry-length"
        field={CARRY_FIELD}
        text={text}
        issue={issue}
        onChange={(next) => {
          setText(next);
          setIssue(undefined);
          setSave({ state: 'idle' });
        }}
      />
      {stale && (
        <Notice>
          <b>Changed on another device.</b> This setting was saved somewhere else after you opened
          it here. Reload the page to see it; nothing was saved.
        </Notice>
      )}
      {save.state === 'failed' && <SaveFailed failure={save.failure} />}
      <Cluster>
        <Button
          variant="secondary"
          busy={save.state === 'saving'}
          busyLabel="Saving…"
          onClick={() => void submit()}
        >
          Save
        </Button>
        {save.state === 'saved' && !changed && <StatusLine>Saved.</StatusLine>}
      </Cluster>
    </Stack>
  );
}
