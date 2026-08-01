import { Component } from "react";
import { Link } from "react-router-dom";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("App render error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[var(--pf-page)] flex items-center justify-center px-6">
          <div className="max-w-md rounded-2xl border border-[var(--pf-border)] bg-[var(--pf-panel)] p-7 text-center shadow-lg">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--pf-danger)]">
              Something went wrong
            </p>
            <h1 className="mt-2 text-2xl font-bold text-[var(--pf-text)]">
              PrepForge hit a recoverable error.
            </h1>
            <p className="mt-3 text-sm leading-6 text-[var(--pf-muted)]">
              Refresh the page or return to the dashboard. The app is still
              running, and no destructive action was taken.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 rounded-lg bg-[var(--pf-primary)] px-4 py-3 text-sm font-bold text-white hover:bg-[var(--pf-primary-dark)]"
              >
                Refresh
              </button>
              <Link
                to="/dashboard"
                className="flex-1 rounded-lg border border-[var(--pf-border)] bg-[var(--pf-panel)] px-4 py-3 text-sm font-semibold text-[var(--pf-text)] hover:bg-[var(--pf-primary-light)]"
              >
                Dashboard
              </Link>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
