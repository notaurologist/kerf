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
import { TrashScreen } from './features/projects/TrashScreen.tsx';
import { WorkshopScreen } from './features/workshop/WorkshopScreen.tsx';
import {
  api,
  CONNECTION_MESSAGE,
  describeError,
  send,
  setLoginRequiredHandler,
} from './lib/api.ts';
import { leaveGate } from './lib/leave.ts';
import { changeScreen } from './lib/moves.ts';
import { href, isMode, type PlaceId, placeOf, type Route, useRoute } from './lib/route.ts';
import { useScreenChange } from './lib/screenChange.ts';
import {
  type Back,
  Button,
  Cluster,
  Frame,
  Notice,
  Page,
  ProblemScreen,
  Skeleton,
  Stack,
  TermScope,
  Wordmark,
} from './ui/index.ts';

// The design system's catalog (#45), loaded only when opened: it carries the worked examples'
// snapshots and drawings for its sample values.
const Catalog = lazy(() => import('./ui/Catalog.tsx').then((m) => ({ default: m.Catalog })));

// `expired` keeps the screen mounted under the login, so a form keeps what was typed.
type Session = 'checking' | 'logged-out' | 'logged-in' | 'expired' | { unreachable: string };

/** `onLogOut` is for Workshop's Log out; without it, Log out does nothing, as in tests. */
export function Screen(props: { route: Route; onLogOut?: () => void }) {
  switch (props.route.screen) {
    case 'projects':
      return <ProjectsScreen />;
    case 'tools':
      return props.route.tool ? <ToolPage id={props.route.tool} /> : <ToolsScreen />;
    case 'new-project':
      return <NewProjectScreen templateId={props.route.templateId} start={props.route.start} />;
    case 'edit-project':
      return (
        <EditProjectScreen id={props.route.id} from={props.route.from} field={props.route.field} />
      );
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
    case 'trash':
      return <TrashScreen />;
    case 'workshop':
      return <WorkshopScreen onLogOut={props.onLogOut ?? (() => {})} />;
    case 'catalog':
      return (
        <Suspense
          fallback={
            <Skeleton
              label="Loading components…"
              stuck={
                <ProblemScreen
                  title="Components"
                  icon="connection"
                  back={{ href: href({ screen: 'projects' }), label: 'Projects' }}
                >
                  {CONNECTION_MESSAGE}
                </ProblemScreen>
              }
            />
          }
        >
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

const PLACE_LABELS: Record<PlaceId, string> = { projects: 'Projects', workshop: 'Workshop' };

/** The place a planning screen is in, whether it is the place itself, and its back link (#265). */
export function frameFor(route: Route): { place: PlaceId; top: boolean; back?: Back } {
  const place = placeOf(route);
  const up = (label: string, to: 'projects' | 'workshop' | 'tools' | 'glossary') => ({
    place,
    top: false,
    back: { label, href: href({ screen: to }) },
  });
  switch (route.screen) {
    case 'projects':
    case 'workshop':
      return { place, top: true };
    case 'tools':
      return route.tool ? up('Tools', 'tools') : up('Workshop', 'workshop');
    case 'glossary':
      return route.term ? up('Glossary', 'glossary') : up('Workshop', 'workshop');
    case 'trash':
      return up('Workshop', 'workshop');
    case 'edit-project':
      return { place, top: false, back: 'project' };
    default:
      return up('Projects', 'projects');
  }
}

/** A screen with its scope for marking the first use of each glossary term. */
function ScreenWithTerms(props: { route: Route; onLogOut?: () => void }) {
  return (
    <TermScope entryHref={entryHref}>
      <Screen route={props.route} onLogOut={props.onLogOut} />
    </TermScope>
  );
}

async function checkSession(): Promise<Session> {
  const result = await send(api.api.session.$get());
  if (result.ok) return 'logged-in';
  if (result.error.kind === 'login-required') return 'logged-out';
  return { unreachable: describeError(result.error) };
}

function Unreachable(props: { message: string; onRetry: () => void }) {
  return (
    <Stack>
      <h1>
        <Wordmark />
      </h1>
      <Notice icon="connection">{props.message}</Notice>
      <Cluster>
        <Button onClick={props.onRetry}>Try again</Button>
      </Cluster>
    </Stack>
  );
}

export function App() {
  const route = useRoute(changeScreen);
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
        <Skeleton
          label="Loading…"
          shape="list"
          stuck={<Unreachable message={CONNECTION_MESSAGE} onRetry={check} />}
        />
      </Page>
    );
  }
  if (session === 'logged-out') return <LoginScreen onLoggedIn={() => setSession('logged-in')} />;
  if (typeof session === 'object') {
    return (
      <Page>
        <Unreachable message={session.unreachable} onRetry={check} />
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
  const frame = frameFor(route);
  const place = (id: PlaceId) => ({
    label: PLACE_LABELS[id],
    href: href({ screen: id }),
    current: frame.place === id ? (frame.top ? ('page' as const) : ('true' as const)) : undefined,
  });
  const workshop = place('workshop');
  // A back link to Workshop already goes there, so the title bar says it once.
  const backToWorkshop = typeof frame.back === 'object' && frame.back.href === workshop.href;
  return (
    <>
      <Frame
        brandHref={href({ screen: 'projects' })}
        places={[place('projects'), workshop]}
        back={frame.back}
        end={
          !backToWorkshop && (
            <a href={workshop.href} aria-current={workshop.current}>
              {workshop.label}
            </a>
          )
        }
      >
        <Page>
          <ScreenWithTerms route={route} onLogOut={() => leaveGate.confirm(() => void logout())} />
        </Page>
      </Frame>
      {loginAgain}
    </>
  );
}
