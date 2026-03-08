import { useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../components/layout/DashboardLayout";

const modes = [
  {
    id: "hr",
    icon: "🤝",
    label: "HR Round",
    desc: "Behavioural and situational questions",
  },
  {
    id: "communication",
    icon: "🗣️",
    label: "Communication",
    desc: "Articulation and clarity practice",
  },
  {
    id: "technical",
    icon: "💻",
    label: "Technical",
    desc: "DSA, DBMS, OS, CN and more",
  },
];

const subjects = {
  technical: [
    { id: "dsa", label: "DSA" },
    { id: "dbms", label: "DBMS" },
    { id: "os", label: "Operating Systems" },
    { id: "cn", label: "Computer Networks" },
    { id: "general", label: "General Mix" },
  ],
};

const difficulties = [
  {
    id: "easy",
    label: "Easy",
    desc: "Fresher level",
    color: "border-green-700/50 bg-green-900/20 text-green-400",
  },
  {
    id: "medium",
    label: "Medium",
    desc: "Internship level",
    color: "border-yellow-700/50 bg-yellow-900/20 text-yellow-400",
  },
  {
    id: "hard",
    label: "Hard",
    desc: "Placement level",
    color: "border-red-700/50 bg-red-900/20 text-red-400",
  },
];

function InterviewSetup() {
  const navigate = useNavigate();
  const [selectedMode, setSelectedMode] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState(null);

  const needsSubject = selectedMode === "technical";
  const canStart =
    selectedMode && selectedDifficulty && (!needsSubject || selectedSubject);

  function handleStart() {
    if (!canStart) return;
    // We'll wire this up in Phase 4 when Gemini is ready
    alert(
      `Starting: ${selectedMode} | ${selectedSubject || "n/a"} | ${selectedDifficulty}`,
    );
  }

  return (
    <DashboardLayout>
      <div className="px-8 py-8 max-w-3xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Start a Session</h1>
          <p className="text-slate-400 text-sm mt-1">
            Choose your interview type, subject, and difficulty.
          </p>
        </div>

        {/* Mode Selection */}
        <div className="mb-8">
          <h2 className="text-slate-300 font-medium mb-3 text-sm uppercase tracking-wider">
            Interview Type
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {modes.map((mode) => (
              <button
                key={mode.id}
                onClick={() => {
                  setSelectedMode(mode.id);
                  setSelectedSubject(null);
                }}
                className={`text-left p-4 rounded-xl border transition-all ${
                  selectedMode === mode.id
                    ? "border-blue-500 bg-blue-900/30"
                    : "border-slate-700 bg-slate-900 hover:border-slate-600"
                }`}
              >
                <div className="text-2xl mb-2">{mode.icon}</div>
                <div className="text-white font-medium text-sm">
                  {mode.label}
                </div>
                <div className="text-slate-400 text-xs mt-1">{mode.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Subject Selection (only for technical) */}
        {needsSubject && (
          <div className="mb-8">
            <h2 className="text-slate-300 font-medium mb-3 text-sm uppercase tracking-wider">
              Subject
            </h2>
            <div className="flex flex-wrap gap-2">
              {subjects.technical.map((sub) => (
                <button
                  key={sub.id}
                  onClick={() => setSelectedSubject(sub.id)}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                    selectedSubject === sub.id
                      ? "border-blue-500 bg-blue-900/30 text-blue-400"
                      : "border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600 hover:text-white"
                  }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Difficulty */}
        <div className="mb-8">
          <h2 className="text-slate-300 font-medium mb-3 text-sm uppercase tracking-wider">
            Difficulty
          </h2>
          <div className="flex gap-3">
            {difficulties.map((diff) => (
              <button
                key={diff.id}
                onClick={() => setSelectedDifficulty(diff.id)}
                className={`flex-1 p-4 rounded-xl border transition-all ${
                  selectedDifficulty === diff.id
                    ? diff.color + " border-opacity-100"
                    : "border-slate-700 bg-slate-900 hover:border-slate-600"
                }`}
              >
                <div className="text-white font-medium text-sm">
                  {diff.label}
                </div>
                <div className="text-slate-400 text-xs mt-1">{diff.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Start Button */}
        <button
          onClick={handleStart}
          disabled={!canStart}
          className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all ${
            canStart
              ? "bg-blue-600 hover:bg-blue-500 text-white"
              : "bg-slate-800 text-slate-600 cursor-not-allowed"
          }`}
        >
          {canStart ? "Start Interview →" : "Select all options to continue"}
        </button>
      </div>
    </DashboardLayout>
  );
}

export default InterviewSetup;
