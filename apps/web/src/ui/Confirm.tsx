import type { FormEvent, ReactNode } from 'react';
import { Button } from './Button.tsx';
import { ErrorText } from './feedback.tsx';
import { Cluster, Stack } from './layout.tsx';

// A question asked in place, beside what it is about, such as deleting a project or regenerating
// its plan: the question, the action named for what it does, a "Keep …" choice that changes
// nothing, and what went wrong if the action did not go through. A question that has to be
// answered before going anywhere, such as leaving with unsaved changes, is `ConfirmDialog`.

export function InlineConfirm(props: {
  /** The question, and anything to fill in before answering it. */
  children: ReactNode;
  /** The action, named for what it does, such as "Delete project". */
  confirm: string;
  /** What the action says while it runs, such as "Deleting…". */
  busyLabel: string;
  /** `destructive` for an action that destroys. */
  variant?: 'primary' | 'destructive';
  /** The choice that changes nothing, such as "Keep project". */
  keep: string;
  busy: boolean;
  error?: string | null;
  onConfirm: () => void;
  onKeep: () => void;
}) {
  // A form, so Enter in a field answers the question.
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!props.busy) props.onConfirm();
  };
  return (
    <form onSubmit={submit} noValidate>
      <Stack gap="s">
        {props.children}
        <Cluster>
          <Button
            type="submit"
            variant={props.variant ?? 'primary'}
            busy={props.busy}
            busyLabel={props.busyLabel}
          >
            {props.confirm}
          </Button>
          <Button variant="secondary" onClick={props.onKeep}>
            {props.keep}
          </Button>
        </Cluster>
        {props.error && <ErrorText alert>{props.error}</ErrorText>}
      </Stack>
    </form>
  );
}
