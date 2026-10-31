import { type ReactNode, useState } from 'react';
import { Button } from './Button.tsx';
import { Icon } from './Icon.tsx';

// Two or more views of one thing in one place, such as a drawing assembled and exploded (#200).
// The control changes only what the screen shows: no address, no history entry. Every view
// stays in the page, so print shows each one under its heading.

export interface View {
  id: string;
  /** The control's label on screen, and the view's heading on paper. */
  label: string;
  content: ReactNode;
}

export function ViewSwitch(props: {
  /** Names the control for assistive technology, such as "Assembly view". */
  label: string;
  views: readonly View[];
  /** The heading level each view's label takes on paper, under the section's own. */
  headingLevel?: 3 | 4;
}) {
  const [shown, setShown] = useState(props.views[0]?.id);
  const Heading = `h${props.headingLevel ?? 3}` as const;
  if (props.views.length === 1) {
    const [view] = props.views;
    return (
      view && (
        <div className="k-views">
          <Heading>{view.label}</Heading>
          {view.content}
        </div>
      )
    );
  }
  return (
    <div className="k-views">
      {/* biome-ignore lint/a11y/useSemanticElements: a group of toggle buttons, not a form fieldset. */}
      <div className="k-views__control" role="group" aria-label={props.label}>
        {props.views.map((view) => (
          <Button
            key={view.id}
            variant="secondary"
            pressed={view.id === shown}
            onClick={() => setShown(view.id)}
          >
            <Icon name="done" />
            {view.label}
          </Button>
        ))}
      </div>
      <div className="k-views__stage">
        {props.views.map((view) => (
          <div key={view.id} className="k-views__view" hidden={view.id !== shown}>
            <Heading className="k-views__heading">{view.label}</Heading>
            {view.content}
          </div>
        ))}
      </div>
    </div>
  );
}
