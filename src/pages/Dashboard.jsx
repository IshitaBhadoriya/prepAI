import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
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
  if (count === 0) return "#1e293b";
  if (count === 1) return "#1e3a5f";
  if (count === 2) return "#1d4ed8";
  return "#3b82f6";
}

// Build real chart data from sessions array
function buildScoreOverTime(sessions) {
  return [...sessions]
    .reverse()
    .map((s) => {
      const vals = [s.tech_score, s.comm_score, s.completeness_score].filter(
        Boolean,
      );
      const avg =
        vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      const date = new Date(s.created_at).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
      });
      return avg !== null ? { date, score: parseFloat(avg.toFixed(1)) } : null;
    })
    .filter(Boolean);
}

function buildPerformanceBreakdown(sessions) {
  const scored = sessions.filter(
    (s) => s.tech_score || s.comm_score || s.completeness_score,
  );
  if (scored.length === 0) return null;
  const avg = (key) => {
    const vals = scored.map((s) => s[key]).filter(Boolean);
    return vals.length > 0
      ? parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1))
      : 0;
  };
  return [
    { area: "Technical", score: avg("tech_score") },
    { area: "Communication", score: avg("comm_score") },
    { area: "Completeness", score: avg("completeness_score") },
  ];
}

function buildSubjectRadar(sessions) {
  const subjectMap = {
    dsa: "DSA",
    dbms: "DBMS",
    os: "OS",
    cn: "CN",
    general: "General",
  };
  const scored = sessions.filter(
    (s) => s.subject && (s.tech_score || s.comm_score || s.completeness_score),
  );
  if (scored.length === 0) return null;
  const grouped = {};
  for (const s of scored) {
    const subjects = s.subject
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    const avg = [s.tech_score, s.comm_score, s.completeness_score].filter(
      Boolean,
    );
    const score =
      avg.length > 0 ? avg.reduce((a, b) => a + b, 0) / avg.length : 0;
    for (const subj of subjects) {
      if (!grouped[subj]) grouped[subj] = [];
      grouped[subj].push(score);
    }
  }
  return Object.entries(grouped).map(([key, vals]) => ({
    subject: subjectMap[key] || key.toUpperCase(),
    score: parseFloat(
      (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1),
    ),
  }));
}

function buildHeatmapFromSessions(sessions) {
  // Count sessions per day
  const dayCounts = {};
  for (const s of sessions) {
    const day = new Date(s.created_at).toISOString().split("T")[0];
    dayCounts[day] = (dayCounts[day] || 0) + 1;
  }

  const weeks = [];
  const today = new Date();
  for (let w = 15; w >= 0; w--) {
    const days = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(today);
      date.setDate(today.getDate() - w * 7 - (6 - d));
      const key = date.toISOString().split("T")[0];
      days.push({
        date: date.toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
        }),
        count: Math.min(dayCounts[key] || 0, 3),
      });
    }
    weeks.push(days);
  }
  return weeks;
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

function SessionRow({ session, onClick }) {
  const modeLabel = {
    hr: "HR Round",
    communication: "Communication",
    technical: "Technical",
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
  const hasFeedback = !!session.feedback_json;

  return (
    <div
      onClick={() => hasFeedback && onClick(session)}
      className={`flex items-center justify-between px-6 py-4 border-b border-slate-800 last:border-0 transition-colors ${hasFeedback ? "hover:bg-slate-800/30 cursor-pointer" : "opacity-60"}`}
    >
      <div>
        <div className="text-white text-sm font-medium flex items-center gap-2">
          {modeLabel[session.mode] || session.mode}
          {session.subject && (
            <span className="text-slate-400 font-normal text-xs">
              · {session.subject}
            </span>
          )}
          {hasFeedback && (
            <span className="text-blue-400 text-xs font-normal">
              → View feedback
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

function ScoreBar({ label, score }) {
  const pct = (score / 10) * 100;
  const color =
    score >= 7 ? "bg-green-500" : score >= 4 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="mb-3">
      <div className="flex justify-between mb-1">
        <span className="text-slate-300 text-sm">{label}</span>
        <span className="text-white text-sm font-semibold">{score}/10</span>
      </div>
      <div className="w-full h-2 bg-slate-800 rounded-full">
        <div
          className={`h-2 rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function ActivityHeatmap({ data }) {
  const [tooltip, setTooltip] = useState(null);
  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return (
    <div>
      <div className="flex gap-1">
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
        <div className="flex gap-1 flex-1">
          {data.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-1 flex-1">
              {week.map((day, di) => (
                <div
                  key={di}
                  className="rounded-sm cursor-pointer transition-opacity hover:opacity-80"
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

// ─── Session Feedback Modal ───────────────────────────────────────────────────

function SessionFeedbackModal({ session, onClose }) {
  const f = session.feedback_json;
  if (!f) return null;

  const date = new Date(session.created_at).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 overflow-y-auto py-8 px-4">
      <div className="bg-slate-950 border border-slate-700 rounded-2xl w-full max-w-2xl">
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <h2 className="text-white font-semibold">Session Feedback</h2>
            <p className="text-slate-400 text-xs mt-0.5 capitalize">
              {session.mode} · {session.difficulty} · {date}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xl leading-none"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-6 space-y-6">
          {/* Scores */}
          <div className="bg-slate-900 rounded-xl p-5">
            <h3 className="text-white font-medium mb-4">Overall Scores</h3>
            <ScoreBar label="Technical / Content" score={f.overallTechScore} />
            <ScoreBar label="Communication" score={f.overallCommScore} />
            <ScoreBar label="Completeness" score={f.overallCompletenessScore} />
          </div>

          {/* Summary */}
          <div className="bg-slate-900 rounded-xl p-5">
            <h3 className="text-white font-medium mb-2">Summary</h3>
            <p className="text-slate-300 text-sm leading-relaxed">
              {f.summary}
            </p>
          </div>

          {/* What went well + Areas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-900 rounded-xl p-5">
              <h3 className="text-green-400 font-medium mb-3">
                ✅ What Went Well
              </h3>
              <ul className="space-y-1.5">
                {f.whatWentWell?.map((item, i) => (
                  <li key={i} className="text-slate-300 text-sm">
                    • {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-slate-900 rounded-xl p-5">
              <h3 className="text-yellow-400 font-medium mb-3">
                ⚠️ Areas to Improve
              </h3>
              <ul className="space-y-1.5">
                {f.areasToImprove?.map((item, i) => (
                  <li key={i} className="text-slate-300 text-sm">
                    • {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Study suggestions */}
          <div className="bg-slate-900 rounded-xl p-5">
            <h3 className="text-blue-400 font-medium mb-3">
              📚 Study Suggestions
            </h3>
            <ul className="space-y-1.5">
              {f.studySuggestions?.map((item, i) => (
                <li key={i} className="text-slate-300 text-sm">
                  • {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Per question */}
          {f.perQuestion?.length > 0 && (
            <div>
              <h3 className="text-white font-medium mb-3">
                Per-Question Breakdown
              </h3>
              <div className="space-y-3">
                {f.perQuestion.map((q, i) => (
                  <div key={i} className="bg-slate-900 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-slate-400 text-xs font-medium">
                        Question {i + 1}
                      </span>
                      <div className="flex gap-2 text-xs text-slate-400">
                        <span>
                          T:{" "}
                          <span className="text-white">{q.techScore}/10</span>
                        </span>
                        <span>
                          C:{" "}
                          <span className="text-white">{q.commScore}/10</span>
                        </span>
                        <span>
                          ✓:{" "}
                          <span className="text-white">
                            {q.completenessScore}/10
                          </span>
                        </span>
                      </div>
                    </div>
                    {q.whatWentWell && (
                      <p className="text-green-400 text-xs mb-1">
                        ✅ {q.whatWentWell}
                      </p>
                    )}
                    {q.whatWasMissed && (
                      <p className="text-yellow-400 text-xs mb-1">
                        ⚠️ {q.whatWasMissed}
                      </p>
                    )}
                    {q.idealAnswer && (
                      <p className="text-blue-400 text-xs">
                        💡 {q.idealAnswer}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    avgScore: null,
    bestScore: null,
  });
  const [streak, setStreak] = useState({ current_streak: 0 });
  const [loadingData, setLoadingData] = useState(true);
  const [selectedSession, setSelectedSession] = useState(null);

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

  // Real chart data computed from sessions
  const scoreOverTime = useMemo(() => buildScoreOverTime(sessions), [sessions]);
  const performanceBreakdown = useMemo(
    () => buildPerformanceBreakdown(sessions),
    [sessions],
  );
  const subjectRadar = useMemo(() => buildSubjectRadar(sessions), [sessions]);
  const heatmapData = useMemo(
    () => buildHeatmapFromSessions(sessions),
    [sessions],
  );

  const weakArea = performanceBreakdown
    ? performanceBreakdown.reduce((min, curr) =>
        curr.score < min.score ? curr : min,
      )
    : null;

  const readiness = loadingData
    ? null
    : computeReadiness(stats.avgScore, streak.current_streak, stats.total);
  const hasEnoughData =
    sessions.filter((s) => s.tech_score || s.comm_score).length >= 2;

  return (
    <DashboardLayout>
      {selectedSession && (
        <SessionFeedbackModal
          session={selectedSession}
          onClose={() => setSelectedSession(null)}
        />
      )}

      <div className="px-8 py-8">
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
          <button
            onClick={() => navigate("/interview/setup")}
            className="inline-block bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
          >
            Start Practicing
          </button>
        </div>

        {/* Charts — show real data or empty state */}
        {!hasEnoughData ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 mb-8 text-center">
            <div className="text-4xl mb-3">📊</div>
            <h3 className="text-white font-semibold mb-1">
              Complete 2+ sessions to see your charts
            </h3>
            <p className="text-slate-500 text-sm">
              Your performance trends will appear here once you have enough
              data.
            </p>
          </div>
        ) : (
          <>
            {/* Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h2 className="text-white font-semibold mb-1">
                  Score Over Time
                </h2>
                <p className="text-slate-500 text-xs mb-4">
                  Your average score per session
                </p>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={scoreOverTime}>
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

              {performanceBreakdown && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                  <h2 className="text-white font-semibold mb-1">
                    Performance Breakdown
                  </h2>
                  <p className="text-slate-500 text-xs mb-4">
                    Average across all 3 evaluation areas
                  </p>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={performanceBreakdown} barSize={40}>
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
                        {performanceBreakdown.map((entry, i) => (
                          <Cell
                            key={i}
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
                  {weakArea && (
                    <div className="mt-4 px-3 py-2 bg-red-900/20 border border-red-800/30 rounded-lg flex items-center gap-2">
                      <span className="text-red-400 text-sm">⚠️</span>
                      <p className="text-red-400 text-xs">
                        Focus area:{" "}
                        <span className="font-semibold">{weakArea.area}</span>{" "}
                        is your lowest at {weakArea.score}/10
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Row 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {subjectRadar && subjectRadar.length >= 3 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                  <h2 className="text-white font-semibold mb-1">
                    Subject Radar
                  </h2>
                  <p className="text-slate-500 text-xs mb-4">
                    Your average score per technical subject
                  </p>
                  <ResponsiveContainer width="100%" height={260}>
                    <RadarChart data={subjectRadar} outerRadius={90}>
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
              ) : (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col items-center justify-center text-center">
                  <div className="text-3xl mb-2">🕸️</div>
                  <p className="text-slate-400 text-sm font-medium">
                    Subject Radar
                  </p>
                  <p className="text-slate-600 text-xs mt-1">
                    Complete technical sessions in 3+ subjects to see this chart
                  </p>
                </div>
              )}

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h2 className="text-white font-semibold mb-1">
                  Practice Activity
                </h2>
                <p className="text-slate-500 text-xs mb-6">
                  Your session consistency over the last 16 weeks
                </p>
                <ActivityHeatmap data={heatmapData} />
              </div>
            </div>
          </>
        )}

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
            sessions.map((s) => (
              <SessionRow key={s.id} session={s} onClick={setSelectedSession} />
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

export default Dashboard;
