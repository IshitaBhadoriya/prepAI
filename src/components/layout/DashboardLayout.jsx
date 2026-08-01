import { useState } from "react";
import Sidebar from "./Sidebar";

function DashboardLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--pf-page)]">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Backdrop — only shows on mobile when sidebar is open */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex min-h-0 flex-1 flex-col md:pl-64">
        {/* Mobile top bar — only visible below md breakpoint */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-[var(--pf-border)] bg-white/95 backdrop-blur-xl">
          <span className="text-[var(--pf-text)] text-lg font-bold">
            Prep<span className="text-[var(--pf-primary)]">Forge</span>
          </span>
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-[var(--pf-text-secondary)] hover:text-[var(--pf-text)] text-2xl leading-none"
            aria-label="Open menu"
          >
            ☰
          </button>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}

export default DashboardLayout;
