import { Component, type ReactNode } from 'react';
import { reportError } from './errors';

/** Keeps a UI rendering bug from blanking the page; reports it with a Reload button instead. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    reportError(
      `The interface hit a problem. ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
