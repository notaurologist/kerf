import { type FormEvent, useState } from 'react';
import { type ApiError, api, describeError, send } from '../../lib/api.ts';
import { Button, Center, ErrorText, Field, Page, Stack, TextInput } from '../../ui/index.ts';

// One password, no username (decision 0007).

export function LoginForm(props: {
  busy: boolean;
  error: ApiError | null;
  onSubmit: (password: string) => void;
}) {
  const [password, setPassword] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (password && !props.busy) props.onSubmit(password);
  };
  return (
    <Page>
      <Center max="24rem">
        <form onSubmit={submit} noValidate>
          <Stack>
            <h1>Kerf</h1>
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
            {props.error && (
              <div role="alert">
                <ErrorText>{describeError(props.error)}</ErrorText>
              </div>
            )}
            <div>
              <Button type="submit" busy={props.busy}>
                {props.busy ? 'Logging in…' : 'Log in'}
              </Button>
            </div>
          </Stack>
        </form>
      </Center>
    </Page>
  );
}

export function LoginScreen(props: { onLoggedIn: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const login = async (password: string) => {
    setBusy(true);
    setError(null);
    const result = await send(api.api.login.$post({ json: { password } }));
    setBusy(false);
    if (result.ok) props.onLoggedIn();
    else setError(result.error);
  };
  return <LoginForm busy={busy} error={error} onSubmit={login} />;
}
