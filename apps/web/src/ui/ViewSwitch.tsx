import { type ReactNode, useState } from 'react';
import { Button } from './Button.tsx';

// Two views of one thing in one place, such as a drawing assembled and exploded (#200), with one
// button whose label says what pressing it does, such as "Explode" (#257). It has no pressed
// state, so the label never contradicts one. The button changes only what the screen shows: no
// address, no history entry. Every view stays in the page, so print shows each under its heading.

export interface View {
  id: string;
  /** The view's heading on paper, such as "Exploded". */
  label: string;
  /** The button's label when pressing it shows this view, such as "Explode". */
  action: string;
  content: ReactNode;
}

export function ViewSwitch(props: {
  views: readonly [View] | readonly [View, View];
  /** The heading level each view's label takes on paper, under the section's own. */
  headingLevel?: 3 | 4;
  /**
   * For a switch that moves between views (`useAssemblyMotion`): the view asked for, the view on
   * screen while a move plays, and what a press asks. Without them the switch keeps its own.
   */
  control?: { asked: string; shown: string; press: (id: string) => void };
}) {
  const [first, second] = props.views;
  const [own, setOwn] = useState(first.id);
  const asked = props.control?.asked ?? own;
  const shown = props.control?.shown ?? own;
  const press = props.control?.press ?? setOwn;
  const Heading = `h${props.headingLevel ?? 3}` as const;
  if (!second) {
    return (
      <div className="k-views">
        <Heading>{first.label}</Heading>
        {first.content}
      </div>
    );
  }
  const next = asked === first.id ? second : first;
  return (
    <div className="k-views">
      <div className="k-views__control">
        <Button variant="secondary" onClick={() => press(next.id)}>
          {next.action}
        </Button>
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
