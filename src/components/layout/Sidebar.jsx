import { NavLink, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";

// Navigation items — icon, label, and path
const navItems = [
  { icon: "🏠", label: "Dashboard", path: "/dashboard" },
  { icon: "🎯", label: "Practice", path: "/interview/setup" },
  { icon: "📚", label: "Question Bank", path: "/questions" },
  { icon: "👤", label: "Profile", path: "/profile" },
];

function Sidebar({ open, onClose }) {
  const navigate = useNavigate();

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/");
  }

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex h-screen w-64 flex-col border-r border-[var(--pf-border)] bg-white/95 shadow-lg backdrop-blur-xl transition-transform duration-200 ease-in-out md:translate-x-0 ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      {/* Logo */}
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--pf-border)] px-6 py-6">
        <span className="text-[var(--pf-text)] text-xl font-extrabold tracking-tight">
          Prep<span className="text-[var(--pf-primary)]">Forge</span>
        </span>
        <button
          onClick={onClose}
          className="md:hidden text-[var(--pf-muted)] hover:text-[var(--pf-text)] text-xl leading-none"
          aria-label="Close menu"
        >
          ✕
        </button>
      </div>

      {/* Nav Links */}
      <nav className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-5">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-semibold transition-all ${
                isActive
                  ? "bg-[var(--pf-panel-soft)] text-[var(--pf-text)] border border-[var(--pf-border)] shadow-lg"
                  : "text-[var(--pf-text-secondary)] hover:text-[var(--pf-text)] hover:bg-[var(--pf-panel-soft)] hover:shadow-lg"
              }`
            }
          >
            <span className="w-6 text-xs font-bold text-[var(--pf-muted)]">
              {item.label === "Question Bank"
                ? "QB"
                : item.label.slice(0, 2).toUpperCase()}
            </span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="mt-auto shrink-0 border-t border-[var(--pf-border)] px-3 py-5">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold text-[var(--pf-text-secondary)] transition-colors hover:bg-[var(--pf-panel-soft)] hover:text-[var(--pf-text)] hover:shadow-lg [&>span:first-child]:hidden"
        >
          <span>🚪</span>
          Logout
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
