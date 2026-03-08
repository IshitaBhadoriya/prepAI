import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Check if user is logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        // Not logged in — send back to landing
        navigate("/");
      } else {
        setUser(session.user);
      }
    });
  }, [navigate]);

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/");
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <p className="text-slate-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-slate-800">
        <span className="text-white text-xl font-bold">
          Prep<span className="text-blue-400">AI</span>
        </span>
        <div className="flex items-center gap-4">
          <span className="text-slate-400 text-sm">{user.email}</span>
          <button
            onClick={handleLogout}
            className="text-slate-400 hover:text-white text-sm transition-colors"
          >
            Logout
          </button>
        </div>
      </nav>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-16 text-center">
        <h1 className="text-4xl font-bold text-white mb-4">Welcome back 👋</h1>
        <p className="text-slate-400 text-lg mb-2">
          Logged in as <span className="text-blue-400">{user.email}</span>
        </p>
        <p className="text-slate-600 text-sm">
          Dashboard is being built. More features coming in the next phases.
        </p>
      </div>
    </div>
  );
}

export default Dashboard;
