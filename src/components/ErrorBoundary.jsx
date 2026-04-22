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
        <div className="min-h-screen bg-slate-950 flex items-center justify-center px-6">
          <div className="max-w-md rounded-lg border border-slate-800 bg-slate-900 p-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-red-400">
              Something went wrong
            </p>
            <h1 className="mt-2 text-2xl font-bold text-white">
              PrepForge hit a recoverable error.
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Refresh the page or return to the dashboard. The app is still
              running, and no destructive action was taken.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"
              >
                Refresh
              </button>
              <Link
                to="/dashboard"
                className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
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
