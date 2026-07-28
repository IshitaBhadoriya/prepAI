import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/useAuth";

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  // Still checking if user is logged in — show nothing yet
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-slate-500 text-sm shadow-lg">Loading...</div>
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
