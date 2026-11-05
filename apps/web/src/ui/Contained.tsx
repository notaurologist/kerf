import { Component, type ReactNode } from 'react';
import { Notice } from './feedback.tsx';

// A part of a screen that could not be shown says so in its place, and the rest of the screen
// stays: one drawing that throws leaves the others, the section's text, and the way out. The
// root boundary (lib/ErrorBoundary.tsx) is for the rest. Like that one, it tries again on the
// next hashchange, so moving to another section or step tries the new one.

export class Contained extends Component<
  {
    /** What could not be shown, as in "Kerf could not show this drawing.". */
    what: 'drawing' | 'section' | 'part of the page';
    children: ReactNode;
  },
  { failed: boolean }
> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  private readonly reset = () => {
    if (this.state.failed) this.setState({ failed: false });
  };

  override componentDidMount() {
    window.addEventListener('hashchange', this.reset);
  }

  override componentWillUnmount() {
    window.removeEventListener('hashchange', this.reset);
  }

  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <Notice alert={false}>
        Kerf could not show this {this.props.what}. Reload the page to try again.
      </Notice>
    );
  }
}
