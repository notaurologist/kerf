import { Component, type ReactNode } from 'react';
import { Page, ProblemScreen } from '../ui/index.ts';
import { href } from './route.ts';

// Catches an error while rendering any screen, so a bug shows a way back instead of a blank page.
// Following a link or going Back clears it and tries the new screen.

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
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
      <Page>
        <ProblemScreen
          title="This page could not be shown"
          onRetry={() => window.location.reload()}
          retryLabel="Reload"
          back={{ href: href({ screen: 'projects' }), label: 'Projects' }}
        >
          Kerf could not show this page. Reload it, or go back to your projects.
        </ProblemScreen>
      </Page>
    );
  }
}
