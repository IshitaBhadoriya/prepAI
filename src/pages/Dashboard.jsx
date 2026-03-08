import { useAuth } from "../context/AuthContext";
import DashboardLayout from "../components/layout/DashboardLayout";

// Stat card component — reusable
function StatCard({ icon, label, value, sub, color }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-2xl">{icon}</span>
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full ${color}`}
        >
          {sub}
        </span>
      </div>
      <div className="text-3xl font-bold text-white mb-1">{value}</div>
      <div className="text-slate-400 text-sm">{label}</div>
    </div>
  );
}

// Empty state for session history
function EmptyHistory() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-5xl mb-4">🎯</div>
      <h3 className="text-white font-semibold text-lg mb-2">No sessions yet</h3>
      <p className="text-slate-500 text-sm max-w-xs">
        Start your first mock interview to see your performance history here.
      </p>
    </div>
  );
}

function Dashboard() {
  const { user } = useAuth();

  // Get first name from email or display name
  const firstName =
    user?.user_metadata?.full_name?.split(" ")[0] ||
    user?.email?.split("@")[0] ||
    "there";

  return (
    <DashboardLayout>
      <div className="px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Hey, {firstName} 👋</h1>
          <p className="text-slate-400 text-sm mt-1">
            Ready to practice today?
          </p>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon="🎯"
            label="Total Sessions"
            value="0"
            sub="All time"
            color="bg-blue-900/30 text-blue-400"
          />
          <StatCard
            icon="⭐"
            label="Average Score"
            value="—"
            sub="Out of 10"
            color="bg-yellow-900/30 text-yellow-400"
          />
          <StatCard
            icon="🔥"
            label="Current Streak"
            value="0"
            sub="Days"
            color="bg-orange-900/30 text-orange-400"
          />
          <StatCard
            icon="🏆"
            label="Best Score"
            value="—"
            sub="Personal best"
            color="bg-green-900/30 text-green-400"
          />
        </div>

        {/* Quick Start */}
        <div className="bg-linear-to-r from-blue-900/40 to-blue-800/20 border border-blue-800/40 rounded-xl p-6 mb-8">
          <h2 className="text-white font-semibold text-lg mb-1">
            Start a session
          </h2>
          <p className="text-slate-400 text-sm mb-4">
            Choose your interview type and difficulty to begin.
          </p>
          <a
            href="/interview/setup"
            className="inline-block bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
          >
            Start Practicing →
          </a>
        </div>

        {/* Session History */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl">
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-white font-semibold">Recent Sessions</h2>
            <span className="text-slate-500 text-sm">0 sessions</span>
          </div>
          <EmptyHistory />
        </div>
      </div>
    </DashboardLayout>
  );
}

export default Dashboard;
