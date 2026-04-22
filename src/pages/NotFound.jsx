import { Link } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import DashboardLayout from "../components/layout/DashboardLayout";

function NotFoundContent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-md text-center">
        <p className="text-sm font-semibold uppercase tracking-wider text-blue-400">
          404
        </p>
        <h1 className="mt-3 text-3xl font-bold text-white">Page not found</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          This route does not exist in PrepForge. Head back to a working area
          and keep practicing.
        </p>
        <div className="mt-6 flex gap-3">
          <Link
            to="/dashboard"
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"
          >
            Dashboard
          </Link>
          <Link
            to="/interview/setup"
            className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
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
    <div className="min-h-screen bg-slate-950">
      <NotFoundContent />
    </div>
  );
}

export default NotFound;
