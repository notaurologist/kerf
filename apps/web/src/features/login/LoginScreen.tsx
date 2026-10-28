import { type FormEvent, useState } from 'react';
import { type ApiError, api, describeError, send } from '../../lib/api.ts';

// One password, no username (decision 0007).

export function LoginForm(props: {
  busy: boolean;
  error: ApiError | null;
  onSubmit: (password: string) => void;
}) {
  const [password, setPassword] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (password) props.onSubmit(password);
  };
  return (
    <main className="login">
      <h1>Kerf</h1>
      <form onSubmit={submit} className="stack">
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={props.busy}
            required
          />
        </label>
        {props.error && (
          <p className="error" role="alert">
            {describeError(props.error)}
          </p>
        )}
        <button type="submit" className="primary" disabled={props.busy || !password}>
          {props.busy ? 'Logging in…' : 'Log in'}
        </button>
      </form>
    </main>
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
