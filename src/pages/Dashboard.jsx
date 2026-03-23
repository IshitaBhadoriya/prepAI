import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { getUserSessions, getUserStats, getStreak } from "../lib/database";
import DashboardLayout from "../components/layout/DashboardLayout";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  CartesianGrid,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";

// ─── Dummy Data ───────────────────────────────────────────────────────────────

const dummyScoreOverTime = [
  { date: "Mar 1", score: 4.2 },
  { date: "Mar 3", score: 5.0 },
  { date: "Mar 5", score: 4.7 },
  { date: "Mar 7", score: 6.1 },
  { date: "Mar 9", score: 5.8 },
  { date: "Mar 11", score: 7.0 },
  { date: "Mar 13", score: 6.5 },
  { date: "Mar 15", score: 7.8 },
];

const dummySubjectScores = [
  { subject: "DSA", score: 6.2 },
  { subject: "DBMS", score: 4.5 },
  { subject: "OS", score: 7.1 },
  { subject: "CN", score: 3.8 },
  { subject: "General", score: 6.8 },
];

const dummyWeakAreas = [
  { area: "Technical", score: 5.1 },
  { area: "Communication", score: 7.2 },
  { area: "Completeness", score: 4.3 },
];

// Generate dummy heatmap data — last 16 weeks
function generateHeatmapData() {
  const weeks = [];
  const today = new Date();
  for (let w = 15; w >= 0; w--) {
    const days = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(today);
      date.setDate(today.getDate() - w * 7 - (6 - d));
      // Randomly assign 0–3 sessions, with more recent = more active
      const recencyBoost = w < 4 ? 1 : 0;
      const count =
        Math.random() < 0.35 + recencyBoost * 0.2
          ? Math.floor(Math.random() * 3) + 1
          : 0;
      days.push({
        date: date.toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
        }),
        count,
      });
    }
    weeks.push(days);
  }
  return weeks;
}

const heatmapData = generateHeatmapData();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeReadiness(avgScore, streak, total) {
  if (!avgScore) return null;
  return Math.min(
    100,
    Math.round(
      (avgScore / 10) * 50 +
        (Math.min(streak, 7) / 7) * 30 +
        (Math.min(total, 10) / 10) * 20,
    ),
  );
}

function heatmapColor(count) {
  if (count === 0) return "#1e293b"; // slate-800
  if (count === 1) return "#1e3a5f"; // blue-900
  if (count === 2) return "#1d4ed8"; // blue-700
  return "#3b82f6"; // blue-500
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ icon, label, value, sub, color, highlight }) {
  return (
    <div
      className={`bg-slate-900 border rounded-xl p-5 ${highlight ? "border-blue-700/60" : "border-slate-800"}`}
    >
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

function SessionRow({ session }) {
  const modeLabel = {
    hr: "HR Round",
    communication: "Communication",
    technical: "Technical",
  };
  const subjectLabel = {
    dsa: "DSA",
    dbms: "DBMS",
    os: "OS",
    cn: "CN",
    general: "General Mix",
  };
  const avgScore = [
    session.tech_score,
    session.comm_score,
    session.completeness_score,
  ].filter(Boolean);
  const avg =
    avgScore.length > 0
      ? (avgScore.reduce((a, b) => a + b, 0) / avgScore.length).toFixed(1)
      : "—";
  const date = new Date(session.created_at).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 last:border-0 hover:bg-slate-800/30 transition-colors">
      <div>
        <div className="text-white text-sm font-medium">
          {modeLabel[session.mode] || session.mode}
          {session.subject && (
            <span className="text-slate-400 font-normal">
              {" "}
              — {subjectLabel[session.subject] || session.subject}
            </span>
          )}
        </div>
        <div className="text-slate-500 text-xs mt-0.5">
          {date} · {session.difficulty}
        </div>
      </div>
      <div className="text-right">
        <div className="text-white font-bold text-sm">
          {avg}
          <span className="text-slate-500 font-normal">/10</span>
        </div>
        <div className="text-slate-500 text-xs">avg score</div>
      </div>
    </div>
  );
}

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

function CustomTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2">
        <p className="text-slate-400 text-xs">{label}</p>
        <p className="text-white text-sm font-semibold">
          {payload[0].value}/10
        </p>
      </div>
    );
  }
  return null;
}

// GitHub-style heatmap
function ActivityHeatmap({ data }) {
  const [tooltip, setTooltip] = useState(null);
  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div>
      <div className="flex gap-1">
        {/* Day labels */}
        <div className="flex flex-col gap-1 mr-1 mt-5">
          {dayLabels.map((d, i) => (
            <div
              key={i}
              className="text-slate-600 text-[9px] h-3 flex items-center"
            >
              {i % 2 === 1 ? d : ""}
            </div>
          ))}
        </div>
        {/* Week columns */}
        <div className="flex gap-1 flex-1">
          {data.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-1 flex-1">
              {week.map((day, di) => (
                <div
                  key={di}
                  className="rounded-sm cursor-pointer transition-opacity hover:opacity-80 relative"
                  style={{
                    backgroundColor: heatmapColor(day.count),
                    aspectRatio: "1",
                    minWidth: "10px",
                  }}
                  onMouseEnter={(e) =>
                    setTooltip({ day, x: e.clientX, y: e.clientY })
                  }
                  onMouseLeave={() => setTooltip(null)}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-1.5 mt-3 justify-end">
        <span className="text-slate-600 text-xs">Less</span>
        {[0, 1, 2, 3].map((c) => (
          <div
            key={c}
            className="w-3 h-3 rounded-sm"
            style={{ backgroundColor: heatmapColor(c) }}
          />
        ))}
        <span className="text-slate-600 text-xs">More</span>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 pointer-events-none"
          style={{ left: tooltip.x + 12, top: tooltip.y - 40 }}
        >
          <p className="text-slate-400 text-xs">{tooltip.day.date}</p>
          <p className="text-white text-sm font-semibold">
            {tooltip.day.count} session{tooltip.day.count !== 1 ? "s" : ""}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

function Dashboard() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    avgScore: null,
    bestScore: null,
  });
  const [streak, setStreak] = useState({ current_streak: 0 });
  const [loadingData, setLoadingData] = useState(true);

  const firstName =
    user?.user_metadata?.full_name?.split(" ")[0] ||
    user?.email?.split("@")[0] ||
    "there";

  useEffect(() => {
    if (!user) return;
    async function loadData() {
      const [sessionsData, statsData, streakData] = await Promise.all([
        getUserSessions(user.id),
        getUserStats(user.id),
        getStreak(user.id),
      ]);
      setSessions(sessionsData);
      setStats(statsData);
      setStreak(streakData);
      setLoadingData(false);
    }
    loadData();
  }, [user]);

  const weakArea = dummyWeakAreas.reduce((min, curr) =>
    curr.score < min.score ? curr : min,
  );

  const readiness = loadingData
    ? null
    : computeReadiness(stats.avgScore, streak.current_streak, stats.total);

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
            value={loadingData ? "..." : stats.total}
            sub="All time"
            color="bg-blue-900/30 text-blue-400"
          />
          <StatCard
            icon="⭐"
            label="Average Score"
            value={loadingData ? "..." : (stats.avgScore ?? "—")}
            sub="Out of 10"
            color="bg-yellow-900/30 text-yellow-400"
          />
          <StatCard
            icon="🔥"
            label="Current Streak"
            value={loadingData ? "..." : streak.current_streak}
            sub="Days"
            color="bg-orange-900/30 text-orange-400"
          />
          <StatCard
            icon="🚀"
            label="Readiness Score"
            value={
              loadingData ? "..." : readiness !== null ? `${readiness}%` : "—"
            }
            sub="Combined metric"
            color="bg-purple-900/30 text-purple-400"
            highlight={readiness >= 70}
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
            Start Practicing
          </a>
        </div>

        {/* Row 1 — Score Over Time + Performance Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-white font-semibold">Score Over Time</h2>
              <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
                Demo data
              </span>
            </div>
            <p className="text-slate-500 text-xs mb-4">
              Your average score per session
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={dummyScoreOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#64748b", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 10]}
                  tick={{ fill: "#64748b", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: "#3b82f6", r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-white font-semibold">
                Performance Breakdown
              </h2>
              <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
                Demo data
              </span>
            </div>
            <p className="text-slate-500 text-xs mb-4">
              Scores across all 3 evaluation areas
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dummyWeakAreas} barSize={40}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="area"
                  tick={{ fill: "#64748b", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 10]}
                  tick={{ fill: "#64748b", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                  {dummyWeakAreas.map((entry, index) => (
                    <Cell
                      key={index}
                      fill={
                        entry.score >= 7
                          ? "#22c55e"
                          : entry.score >= 4
                            ? "#eab308"
                            : "#ef4444"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-4 px-3 py-2 bg-red-900/20 border border-red-800/30 rounded-lg flex items-center gap-2">
              <span className="text-red-400 text-sm">⚠️</span>
              <p className="text-red-400 text-xs">
                Focus area:{" "}
                <span className="font-semibold">{weakArea.area}</span> is your
                lowest at {weakArea.score}/10
              </p>
            </div>
          </div>
        </div>

        {/* Row 2 — Subject Radar + Activity Heatmap */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-white font-semibold">Subject Radar</h2>
              <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
                Demo data
              </span>
            </div>
            <p className="text-slate-500 text-xs mb-4">
              How you perform across each technical subject
            </p>
            <ResponsiveContainer width="100%" height={260}>
              <RadarChart data={dummySubjectScores} outerRadius={90}>
                <PolarGrid stroke="#1e293b" />
                <PolarAngleAxis
                  dataKey="subject"
                  tick={{ fill: "#94a3b8", fontSize: 12 }}
                />
                <PolarRadiusAxis
                  angle={90}
                  domain={[0, 10]}
                  tick={{ fill: "#475569", fontSize: 10 }}
                  tickCount={6}
                />
                <Radar
                  name="Score"
                  dataKey="score"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.2}
                  dot={{ fill: "#3b82f6", r: 4 }}
                />
                <Tooltip
                  content={({ active, payload }) =>
                    active && payload?.length ? (
                      <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2">
                        <p className="text-slate-400 text-xs">
                          {payload[0].payload.subject}
                        </p>
                        <p className="text-white text-sm font-semibold">
                          {payload[0].value}/10
                        </p>
                      </div>
                    ) : null
                  }
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-white font-semibold">Practice Activity</h2>
              <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
                Demo data
              </span>
            </div>
            <p className="text-slate-500 text-xs mb-6">
              Your session consistency over the last 16 weeks
            </p>
            <ActivityHeatmap data={heatmapData} />
          </div>
        </div>

        {/* Session History */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl">
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-white font-semibold">Recent Sessions</h2>
            <span className="text-slate-500 text-sm">
              {stats.total} session{stats.total !== 1 ? "s" : ""}
            </span>
          </div>
          {sessions.length === 0 ? (
            <EmptyHistory />
          ) : (
            sessions.map((s) => <SessionRow key={s.id} session={s} />)
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

export default Dashboard;
