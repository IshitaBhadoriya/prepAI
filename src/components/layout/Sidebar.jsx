import { NavLink, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";

// Navigation items — icon, label, and path
const navItems = [
  { icon: "🏠", label: "Dashboard", path: "/dashboard" },
  { icon: "🎯", label: "Practice", path: "/interview/setup" },
  { icon: "📚", label: "Question Bank", path: "/questions" },
  { icon: "👤", label: "Profile", path: "/profile" },
];

function Sidebar() {
  const navigate = useNavigate();

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/");
  }

  return (
    <aside className="w-64 min-h-screen bg-slate-900 border-r border-slate-800 flex flex-col">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-slate-800">
        <span className="text-white text-xl font-bold">
          Prep<span className="text-blue-400">Forge</span>
        </span>
      </div>

      {/* Nav Links */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-blue-600/20 text-blue-400 border border-blue-700/30"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`
            }
          >
            <span className="w-6 text-xs font-bold text-slate-500">
              {item.label === "Question Bank"
                ? "QB"
                : item.label.slice(0, 2).toUpperCase()}
            </span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-slate-800">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors w-full [&>span:first-child]:hidden"
        >
          <span>🚪</span>
          Logout
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
