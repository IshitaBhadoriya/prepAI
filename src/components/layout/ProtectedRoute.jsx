import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  // Still checking if user is logged in — show nothing yet
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-400 text-sm">Loading...</div>
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
