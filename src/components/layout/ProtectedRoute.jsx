import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/useAuth";

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  // Still checking if user is logged in — show nothing yet
  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--pf-page)] flex items-center justify-center">
        <div className="rounded-full border border-[var(--pf-border)] bg-[var(--pf-panel)] px-4 py-2 text-[var(--pf-muted)] text-sm shadow-lg">Loading...</div>
      </div>
    );
  }

  // Not logged in — redirect to landing page
  if (!user) {
    return <Navigate to="/" replace />;
  }

  // Logged in — show the page
  return children;
}

export default ProtectedRoute;
