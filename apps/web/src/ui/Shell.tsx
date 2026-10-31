import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { Icon, type IconName } from './Icon.tsx';
import { Wordmark } from './Wordmark.tsx';

// The frame around every screen. Planning screens sit in Stage 9's frame (#265): on a phone, a
// title bar and a tab bar with the three places; from 52.5rem of the frame's width, one sidebar
// with the places and, while a project is open, its sections. Shopping and Building cover it
// with their own bar and Exit (M7, #61), as a modal covers a tab bar.

export interface Place {
  label: string;
  href: string;
  icon: IconName;
  /** `page` on the place itself; `true` on a screen inside it, such as a tool's page. */
  current?: 'page' | 'true';
}

/** The open project, as its screens tell the frame: its name and, on the plan, its sections. */
export interface FrameProject {
  name: string;
  href: string;
  sections?: {
    items: readonly { id: string; title: string; href: string }[];
    current: string;
  };
}

/** Where the title bar's back link goes; `project` is the open project, named by its screen. */
export type Back = { label: string; href: string } | 'project';

const FrameContext = createContext<(project: FrameProject | undefined) => void>(() => {});

/** For a project's screens: shows the project in the frame while the screen is open. */
export function useFrameProject(project: FrameProject) {
  const set = useContext(FrameContext);
  const key = JSON.stringify(project);
  useEffect(() => {
    set(JSON.parse(key) as FrameProject);
    return () => set(undefined);
  }, [key, set]);
}

/**
 * Stage 9's frame. The title bar has the wordmark and a menu with `actions` on a place, or a back
 * link and the open project's name below one. The sidebar marks the current place, and the
 * plan's sections replace its own contents column. `preview` sizes it to its content, for the
 * catalog.
 */
export function Frame(props: {
  brandHref: string;
  places: readonly Place[];
  back?: Back;
  actions: ReactNode;
  preview?: boolean;
  children: ReactNode;
}) {
  const [project, setProject] = useState<FrameProject>();
  const actionsId = useId();
  const actions = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    const element = actions.current;
    if (!element) return;
    const toggle = (e: Event) => setMenuOpen((e as ToggleEvent).newState === 'open');
    element.addEventListener('toggle', toggle);
    return () => element.removeEventListener('toggle', toggle);
  }, []);
  const back =
    props.back === 'project' ? project && { label: project.name, href: project.href } : props.back;
  const title = props.back && props.back !== 'project' ? project?.name : undefined;
  return (
    <FrameContext.Provider value={setProject}>
      <div
        className="k-frame"
        data-preview={props.preview || undefined}
        data-sections={project?.sections ? '' : undefined}
      >
        <div className="k-frame__layout">
          <header className="k-titlebar">
            {back ? (
              <a className="k-titlebar__back" href={back.href}>
                <span className="k-titlebar__chevron">
                  <Icon name="chevron" />
                </span>
                {back.label}
              </a>
            ) : (
              <a className="k-titlebar__brand" href={props.brandHref}>
                <Wordmark />
              </a>
            )}
            {title && <span className="k-titlebar__title">{title}</span>}
            {!props.back && (
              <button
                type="button"
                className="k-titlebar__menu"
                popoverTarget={actionsId}
                aria-expanded={menuOpen}
              >
                <Icon name="menu" />
                <span className="k-visually-hidden">Menu</span>
              </button>
            )}
          </header>
          <div className="k-frame__side">
            <nav className="k-sidebar" aria-label="Main">
              <a className="k-sidebar__brand" href={props.brandHref}>
                <Wordmark />
              </a>
              <ul>
                {props.places.map((place) => (
                  <li key={place.href}>
                    <a href={place.href} aria-current={place.current}>
                      {place.label}
                    </a>
                    {place.current && project && (
                      <ul>
                        <li>
                          <a href={project.href} aria-current={project.sections ? 'true' : 'page'}>
                            {project.name}
                          </a>
                          {project.sections && (
                            <ol aria-label="Sections">
                              {project.sections.items.map((item) => (
                                <li key={item.id}>
                                  <a
                                    href={item.href}
                                    aria-current={
                                      item.id === project.sections?.current ? 'page' : undefined
                                    }
                                  >
                                    {item.title}
                                  </a>
                                </li>
                              ))}
                            </ol>
                          )}
                        </li>
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
            <div ref={actions} id={actionsId} popover="auto" className="k-frame__actions">
              {props.actions}
            </div>
          </div>
          <div className="k-frame__main">{props.children}</div>
          <nav className="k-tabbar" aria-label="Main">
            {props.places.map((place) => (
              <a key={place.href} href={place.href} aria-current={place.current}>
                <Icon name={place.icon} />
                <span>{place.label}</span>
              </a>
            ))}
          </nav>
        </div>
      </div>
    </FrameContext.Provider>
  );
}

/**
 * Shop modes fill the screen under this bar (#40): the mode's name, what it is working on (the
 * project's name), and a way out. `end` sits before Exit, as the theme menu does (#155).
 */
export function ModeBar(props: {
  mode: string;
  context?: string;
  exitHref: string;
  end?: ReactNode;
}) {
  return (
    <header className="k-modebar" data-density="shop">
      <span>
        <b>{props.mode}</b>
        {props.context && ` · ${props.context}`}
      </span>
      <span className="k-modebar__end">
        {props.end}
        <a className="k-button" data-variant="secondary" href={props.exitHref}>
          Exit
        </a>
      </span>
    </header>
  );
}

/**
 * A shop mode's whole screen (#61): the mode bar and, below it, the mode's content in shop
 * density. It has no other navigation, so the mode is signalled twice (NN/g, modes).
 */
export function ModeFrame(props: {
  mode: string;
  context?: string;
  exitHref: string;
  end?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <ModeBar
        mode={props.mode}
        context={props.context}
        exitHref={props.exitHref}
        end={props.end}
      />
      <main className="l-page" data-density="shop">
        {props.children}
      </main>
    </>
  );
}
