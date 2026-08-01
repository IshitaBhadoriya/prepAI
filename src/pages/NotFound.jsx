import { Link } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import DashboardLayout from "../components/layout/DashboardLayout";

function NotFoundContent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-md rounded-2xl border border-[var(--pf-border)] bg-[var(--pf-panel)] p-8 text-center shadow-lg">
        <p className="text-sm font-semibold uppercase tracking-wider text-[var(--pf-primary)]">
          404
        </p>
        <h1 className="mt-3 text-3xl font-bold text-[var(--pf-text)]">Page not found</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--pf-muted)]">
          This route does not exist in PrepForge. Head back to a working area
          and keep practicing.
        </p>
        <div className="mt-6 flex gap-3">
          <Link
            to="/dashboard"
            className="flex-1 rounded-lg bg-[var(--pf-primary)] px-4 py-3 text-sm font-bold text-white hover:bg-[var(--pf-primary-dark)]"
          >
            Dashboard
          </Link>
          <Link
            to="/interview/setup"
            className="flex-1 rounded-lg border border-[var(--pf-border)] bg-[var(--pf-panel)] px-4 py-3 text-sm font-semibold text-[var(--pf-text)] hover:bg-[var(--pf-primary-light)]"
          >
            Practice
          </Link>
        </div>
      </div>
    </div>
  );
}

function NotFound() {
  const { user } = useAuth();

  if (user) {
    return (
      <DashboardLayout>
        <NotFoundContent />
      </DashboardLayout>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--pf-page)]">
      <NotFoundContent />
    </div>
  );
}

export default NotFound;
