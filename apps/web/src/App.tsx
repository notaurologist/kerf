import type { GlossaryId } from '@kerf/core';
import { lazy, Suspense, useEffect, useState } from 'react';
import { GlossaryScreen } from './features/glossary/GlossaryScreen.tsx';
import { ToolPage } from './features/inventory/ToolPage.tsx';
import { ToolsScreen } from './features/inventory/ToolsScreen.tsx';
import { LoginAgain, LoginScreen } from './features/login/LoginScreen.tsx';
import { ModeScreen } from './features/modes/modes.tsx';
import { ProjectScreen } from './features/project/ProjectScreen.tsx';
import { EditProjectScreen, NewProjectScreen } from './features/project-editor/ProjectEditor.tsx';
import { ProjectsScreen } from './features/projects/ProjectsScreen.tsx';
import { api, describeError, send, setLoginRequiredHandler } from './lib/api.ts';
import { leaveGate } from './lib/leave.ts';
import { href, isMode, type Route, useRoute } from './lib/route.ts';
import { useScreenChange } from './lib/screenChange.ts';
import { ThemeSwitch } from './lib/theme.tsx';
import {
  Button,
  Cluster,
  Header,
  Loading,
  Notice,
  Page,
  ProblemScreen,
  Stack,
  TermScope,
  Wordmark,
} from './ui/index.ts';

// The design system's catalog (#45), loaded only when opened: it carries the worked example's
// snapshot for its sample values.
const Catalog = lazy(() => import('./ui/Catalog.tsx').then((m) => ({ default: m.Catalog })));

// `expired` keeps the screen mounted under the login, so a form keeps what was typed.
type Session = 'checking' | 'logged-out' | 'logged-in' | 'expired' | { unreachable: string };

export function Screen(props: { route: Route }) {
  switch (props.route.screen) {
    case 'projects':
      return <ProjectsScreen />;
    case 'tools':
      return props.route.tool ? <ToolPage id={props.route.tool} /> : <ToolsScreen />;
    case 'new-project':
      return <NewProjectScreen templateId={props.route.templateId} start={props.route.start} />;
    case 'edit-project':
      return <EditProjectScreen id={props.route.id} from={props.route.from} />;
    case 'project':
      return (
        <ProjectScreen id={props.route.id} section={props.route.section} part={props.route.part} />
      );
    case 'shop':
    case 'build':
    case 'build-steps':
    case 'build-step':
    case 'build-part':
      // Modes bring their own frame (App, below).
      return <ModeScreen route={props.route} />;
    case 'glossary':
      return <GlossaryScreen term={props.route.term} />;
    case 'catalog':
      return (
        <Suspense fallback={<Loading>Loading components…</Loading>}>
          <Catalog />
        </Suspense>
      );
    case 'not-found':
      return (
        <ProblemScreen
          title="Page not found"
          back={{ href: href({ screen: 'projects' }), label: 'Projects' }}
        >
          There is no page at this address. Check it, or go back to your projects.
        </ProblemScreen>
      );
  }
}

const entryHref = (term: GlossaryId) => href({ screen: 'glossary', term });

/** A screen with its scope for marking the first use of each glossary term. */
function ScreenWithTerms(props: { route: Route }) {
  return (
    <TermScope entryHref={entryHref}>
      <Screen route={props.route} />
    </TermScope>
  );
}

async function checkSession(): Promise<Session> {
  const result = await send(api.api.session.$get());
  if (result.ok) return 'logged-in';
  if (result.error.kind === 'login-required') return 'logged-out';
  return { unreachable: describeError(result.error) };
}

export function App() {
  const route = useRoute();
  useScreenChange(route);
  const [session, setSession] = useState<Session>('checking');

  const check = () => {
    setSession('checking');
    void checkSession().then(setSession);
  };

  useEffect(() => {
    setLoginRequiredHandler(() =>
      setSession((s) => (s === 'logged-in' || s === 'expired' ? 'expired' : 'logged-out')),
    );
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
          <h1>
            <Wordmark />
          </h1>
          <Notice icon="connection">{session.unreachable}</Notice>
          <Cluster>
            <Button onClick={check}>Try again</Button>
          </Cluster>
        </Stack>
      </Page>
    );
  }
  const loginAgain = session === 'expired' && (
    <LoginAgain onLoggedIn={() => setSession('logged-in')} />
  );
  // Shopping and Building fill the screen under their own bar, with no other navigation (#61).
  if (isMode(route)) {
    return (
      <>
        <ScreenWithTerms route={route} />
        {loginAgain}
      </>
    );
  }
  const section =
    route.screen === 'tools' || route.screen === 'glossary'
      ? route.screen
      : route.screen === 'catalog'
        ? null
        : 'projects';
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
          {
            label: 'Glossary',
            href: href({ screen: 'glossary' }),
            current: section === 'glossary',
          },
        ]}
        end={
          <>
            <ThemeSwitch />
            <Button variant="link" onClick={() => leaveGate.confirm(() => void logout())}>
              Log out
            </Button>
          </>
        }
      />
      <Page>
        <ScreenWithTerms route={route} />
      </Page>
      {loginAgain}
    </>
  );
}
