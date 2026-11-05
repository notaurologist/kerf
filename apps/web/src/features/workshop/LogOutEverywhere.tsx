import { useState } from 'react';
import { type ApiResult, api, describeError, send } from '../../lib/api.ts';
import { Button, Card, Cluster, InlineConfirm, Text, useReturnFocus } from '../../ui/index.ts';

// Ends every session, this device's too, for a lost or shared device (decision 0007). It asks
// first, in place, because it also logs out the phone and the Home Screen app.

const logOutAll = () => send(api.api['logout-all'].$post());

export function LogOutEverywhere(props: {
  /** Called once every session has ended, to show the login screen. */
  onLoggedOut: () => void;
  request?: () => Promise<ApiResult<unknown>>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trigger = useReturnFocus(open);

  if (!open) {
    return (
      <Cluster>
        <Button ref={trigger} variant="secondary" onClick={() => setOpen(true)}>
          Log out everywhere
        </Button>
      </Cluster>
    );
  }

  const confirm = async () => {
    setBusy(true);
    setError(null);
    const result = await (props.request ?? logOutAll)();
    setBusy(false);
    if (result.ok) props.onLoggedOut();
    else setError(describeError(result.error));
  };

  return (
    <Card as="section">
      <InlineConfirm
        confirm="Log out everywhere"
        busyLabel="Logging out…"
        keep="Stay logged in"
        busy={busy}
        error={error}
        onConfirm={() => void confirm()}
        onKeep={() => {
          setOpen(false);
          setError(null);
        }}
      >
        <Text>
          <b>Log out on every device?</b> This device, your phone, and the Home Screen app all go
          back to the login screen. Your projects stay as they are. Log in again with the password
          on each device you use.
        </Text>
      </InlineConfirm>
    </Card>
  );
}
