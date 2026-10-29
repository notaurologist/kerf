import { useEffect, useState } from 'react';
import { Notice, Shell } from './components/Shell.tsx';
import { LoginScreen } from './features/login/LoginScreen.tsx';
import { api, describeError, send, setLoginRequiredHandler } from './lib/api.ts';
import { type Route, useRoute } from './lib/route.ts';

type Session = 'checking' | 'logged-out' | 'logged-in' | { unreachable: string };

export function Screen(props: { route: Route }) {
  switch (props.route.screen) {
    case 'projects':
      return <h1>Projects</h1>;
    case 'tools':
      return <h1>Tools</h1>;
    case 'new-project':
    case 'project':
    case 'edit-project':
      return <h1>Project</h1>;
    case 'not-found':
      return <Notice>There is no page here.</Notice>;
  }
}

async function checkSession(): Promise<Session> {
  const result = await send(api.api.session.$get());
  if (result.ok) return 'logged-in';
  if (result.error.kind === 'login-required') return 'logged-out';
  return { unreachable: describeError(result.error) };
}

export function App() {
  const route = useRoute();
  const [session, setSession] = useState<Session>('checking');

  const check = () => {
    setSession('checking');
    void checkSession().then(setSession);
  };

  useEffect(() => {
    setLoginRequiredHandler(() => setSession('logged-out'));
    void checkSession().then(setSession);
  }, []);

  const logout = async () => {
    await send(api.api.logout.$post());
    setSession('logged-out');
  };

  if (session === 'checking') return <AppMessage>Loading…</AppMessage>;
  if (session === 'logged-out') return <LoginScreen onLoggedIn={() => setSession('logged-in')} />;
  if (typeof session === 'object') {
    return (
      <AppMessage>
        {session.unreachable}{' '}
        <button type="button" className="link" onClick={check}>
          Try again
        </button>
      </AppMessage>
    );
  }
  return (
    <Shell route={route} onLogout={() => void logout()}>
      <Screen route={route} />
    </Shell>
  );
}

function AppMessage(props: { children: React.ReactNode }) {
  return (
    <main className="page">
      <h1>Kerf</h1>
      <p>{props.children}</p>
    </main>
  );
}
