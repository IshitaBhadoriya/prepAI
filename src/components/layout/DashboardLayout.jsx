import { useState } from "react";
import Sidebar from "./Sidebar";

function DashboardLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-950">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Backdrop — only shows on mobile when sidebar is open */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar — only visible below md breakpoint */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900">
          <span className="text-white text-lg font-bold">
            Prep<span className="text-blue-400">Forge</span>
          </span>
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-slate-300 hover:text-white text-2xl leading-none"
            aria-label="Open menu"
          >
            ☰
          </button>
        </header>

        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}

export default DashboardLayout;
