import { lazy, Suspense, useEffect, useState } from 'react';
import { ToolsScreen } from './features/inventory/ToolsScreen.tsx';
import { LoginScreen } from './features/login/LoginScreen.tsx';
import { ProjectScreen } from './features/project/ProjectScreen.tsx';
import { EditProjectScreen, NewProjectScreen } from './features/project-editor/ProjectEditor.tsx';
import { ProjectsScreen } from './features/projects/ProjectsScreen.tsx';
import { api, describeError, send, setLoginRequiredHandler } from './lib/api.ts';
import { href, type Route, useRoute } from './lib/route.ts';
import { Button, Header, Loading, Notice, Page, Stack, Text } from './ui/index.ts';

// The design system's catalog (#45), loaded only when opened: it carries the worked example's
// snapshot for its sample values.
const Catalog = lazy(() => import('./ui/Catalog.tsx').then((m) => ({ default: m.Catalog })));

type Session = 'checking' | 'logged-out' | 'logged-in' | { unreachable: string };

export function Screen(props: { route: Route }) {
  switch (props.route.screen) {
    case 'projects':
      return <ProjectsScreen />;
    case 'tools':
      return <ToolsScreen />;
    case 'new-project':
      return <NewProjectScreen templateId={props.route.templateId} />;
    case 'edit-project':
      return <EditProjectScreen id={props.route.id} />;
    case 'project':
      return <ProjectScreen id={props.route.id} />;
    case 'catalog':
      return (
        <Suspense fallback={<Loading>Loading components…</Loading>}>
          <Catalog />
        </Suspense>
      );
    case 'not-found':
      return <Text>There is no page here.</Text>;
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

  if (session === 'checking') {
    return (
      <Page>
        <Loading>Loading…</Loading>
      </Page>
    );
  }
  if (session === 'logged-out') return <LoginScreen onLoggedIn={() => setSession('logged-in')} />;
  if (typeof session === 'object') {
    return (
      <Page>
        <Stack>
          <h1>Kerf</h1>
          <Notice icon="connection">{session.unreachable}</Notice>
          <div>
            <Button onClick={check}>Try again</Button>
          </div>
        </Stack>
      </Page>
    );
  }
  const section =
    route.screen === 'tools' ? 'tools' : route.screen === 'catalog' ? null : 'projects';
  return (
    <>
      <Header
        brandHref={href({ screen: 'projects' })}
        nav={[
          {
            label: 'Projects',
            href: href({ screen: 'projects' }),
            current: section === 'projects',
          },
          { label: 'Tools', href: href({ screen: 'tools' }), current: section === 'tools' },
        ]}
        end={
          <Button variant="link" onClick={() => void logout()}>
            Log out
          </Button>
        }
      />
      <Page>
        <Screen route={route} />
      </Page>
    </>
  );
}
