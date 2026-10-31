import { type FormEvent, type ReactNode, useState } from 'react';
import { type ApiError, api, describeError, send } from '../../lib/api.ts';
import {
  BlockingDialog,
  Button,
  Center,
  Cluster,
  ErrorText,
  Field,
  Page,
  Stack,
  Text,
  TextInput,
  Wordmark,
} from '../../ui/index.ts';

// One password, no username (decision 0007).

export function LoginForm(props: {
  busy: boolean;
  error: ApiError | null;
  onSubmit: (password: string) => void;
  /** The heading and what to say under it; the wordmark alone on the login screen. */
  heading?: ReactNode;
}) {
  const [password, setPassword] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (password && !props.busy) props.onSubmit(password);
  };
  return (
    <form onSubmit={submit} noValidate>
      <Stack>
        {props.heading ?? (
          <h1>
            <Wordmark />
          </h1>
        )}
        <Field label="Password">
          {(c) => (
            <TextInput
              {...c}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={setPassword}
            />
          )}
        </Field>
        {props.error && <ErrorText alert>{describeError(props.error)}</ErrorText>}
        <Cluster>
          <Button type="submit" busy={props.busy} busyLabel="Logging in…">
            Log in
          </Button>
        </Cluster>
      </Stack>
    </form>
  );
}

/** Logs in with the password; `onLoggedIn` runs once the session is set. */
function useLogin(onLoggedIn: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const login = async (password: string) => {
    setBusy(true);
    setError(null);
    const result = await send(api.api.login.$post({ json: { password } }));
    setBusy(false);
    if (result.ok) onLoggedIn();
    else setError(result.error);
  };
  return { busy, error, login };
}

export function LoginScreen(props: { onLoggedIn: () => void }) {
  const { busy, error, login } = useLogin(props.onLoggedIn);
  return (
    <Page>
      <Center max="24rem">
        <LoginForm busy={busy} error={error} onSubmit={login} />
      </Center>
    </Page>
  );
}

/**
 * Logging in again after the session ended mid-use, over the screen, so a form being edited keeps
 * what was typed. It cannot be dismissed: nothing works until the session is back.
 */
export function LoginAgain(props: { onLoggedIn: () => void }) {
  const { busy, error, login } = useLogin(props.onLoggedIn);
  return (
    <BlockingDialog title="Log in again">
      <LoginForm
        busy={busy}
        error={error}
        onSubmit={login}
        heading={
          <Text>Your session has ended. Log in to carry on; your changes are still here.</Text>
        }
      />
    </BlockingDialog>
  );
}
