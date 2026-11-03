import type { ReactNode } from 'react';
import { Cluster, Stack } from './layout.tsx';
import { useScreenHeading } from './screenFocus.ts';
import { Text } from './text.tsx';

// The top of a screen: its title with the screen's actions beside it, wrapping under it when
// there is no room, then a lede saying what the screen is for, a line of facts about what is
// shown, and what just happened.

/**
 * A screen's h1. It takes focus when the screen is changed to, and `title` names the document;
 * `children`, when given, are shown in its place, such as a title with an icon.
 */
export function ScreenHeading(props: { title: string; children?: ReactNode }) {
  const ref = useScreenHeading(props.title);
  return (
    <h1 ref={ref} tabIndex={-1}>
      {props.children ?? props.title}
    </h1>
  );
}

export function ScreenHeader(props: {
  /** The screen's name, for its heading and the document title. */
  title: string;
  /** Shown in place of `title` when the heading needs more, such as an icon. */
  heading?: ReactNode;
  /** The document title when it should say more than the heading, such as the plan's section. */
  pageTitle?: string;
  /** Actions for the whole screen, such as Edit and Print. They stay on the title's line. */
  actions?: ReactNode;
  /** Short labels beside the title when they fit, under it when not, such as a project's status. */
  tags?: ReactNode;
  /** What the screen is for, in a sentence or two. */
  lede?: ReactNode;
  /** Facts about what is shown, such as how much of a list is done. */
  meta?: ReactNode;
  /** What just happened, usually a `StatusLine`. */
  status?: ReactNode;
}) {
  const heading = (
    <ScreenHeading title={props.pageTitle ?? props.title}>
      {props.heading ?? props.title}
    </ScreenHeading>
  );
  const title = props.tags ? (
    <Cluster gap="xs">
      {heading}
      <Cluster gap="2xs">{props.tags}</Cluster>
    </Cluster>
  ) : (
    heading
  );
  return (
    <Stack as="header" gap="2xs">
      {props.actions ? (
        <div className="k-screen-header__top">
          {title}
          <Cluster>{props.actions}</Cluster>
        </div>
      ) : (
        title
      )}
      {props.lede && <Text tone="muted">{props.lede}</Text>}
      {props.meta && <Text tone="muted">{props.meta}</Text>}
      {props.status}
    </Stack>
  );
}
