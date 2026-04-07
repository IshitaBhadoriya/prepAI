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

const roles = [
  { id: "sde-intern", label: "SDE Intern" },
  { id: "software-engineer", label: "Software Engineer" },
  { id: "backend-engineer", label: "Backend Engineer" },
  { id: "frontend-engineer", label: "Frontend Engineer" },
  { id: "full-stack-developer", label: "Full Stack Developer" },
  { id: "data-analyst", label: "Data Analyst" },
  { id: "product-manager", label: "Product Manager" },
];

const questionRanges = [
  { id: "short", label: "Short", desc: "3–5 questions" },
  { id: "standard", label: "Standard", desc: "6–8 questions" },
  { id: "extended", label: "Extended", desc: "9–12 questions" },
];

const communicationModes = [
  {
    id: "impromptu",
    label: "Impromptu",
    desc: "Thinking clarity, flow, and coherence",
  },
  {
    id: "structured",
    label: "Structured",
    desc: "STAR-style structured answering",
  },
  {
    id: "explain",
    label: "Explain",
    desc: "Simple, clear explanation for beginners",
  },
];

function InterviewSetup() {
  const navigate = useNavigate();
  const [selectedMode, setSelectedMode] = useState(null);
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [selectedDifficulty, setSelectedDifficulty] = useState(null);
  const [selectedRole, setSelectedRole] = useState(roles[0].id);
  const [selectedQuestionRange, setSelectedQuestionRange] = useState(
    questionRanges[1].id,
  );
  const [selectedCommunicationMode, setSelectedCommunicationMode] = useState(
    communicationModes[0].id,
  );

  const needsSubject = selectedMode === "technical";
  const needsCommunicationMode = selectedMode === "communication";
  const needsRole = selectedMode !== "communication";
  const canStart =
    selectedMode &&
    selectedDifficulty &&
    selectedQuestionRange &&
    (!needsRole || selectedRole) &&
    (!needsSubject || selectedSubjects.length > 0) &&
    (!needsCommunicationMode || selectedCommunicationMode);

  function toggleSubject(subjectId) {
    setSelectedSubjects((current) =>
      current.includes(subjectId)
        ? current.filter((item) => item !== subjectId)
        : [...current, subjectId],
    );
  }

  function handleStart() {
    if (!canStart) return;

    const technicalSubjects =
      selectedMode === "technical" ? selectedSubjects : [];
    const subjectSummary =
      technicalSubjects.length > 0 ? technicalSubjects.join(", ") : null;

    navigate("/interview/session", {
      state: {
        mode: selectedMode,
        subject: subjectSummary,
        selectedSubjects: technicalSubjects,
        communicationMode:
          selectedMode === "communication" ? selectedCommunicationMode : null,
        difficulty: selectedDifficulty,
        role: selectedMode === "communication" ? null : selectedRole,
        questionRange: selectedQuestionRange,
      },
    });
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
                  setSelectedSubjects([]);
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
              Subjects
            </h2>
            <p className="text-slate-500 text-xs mb-3">
              Choose one or more areas. The interview will balance coverage
              across them.
            </p>
            <div className="flex flex-wrap gap-2">
              {subjects.technical.map((sub) => (
                <button
                  key={sub.id}
                  onClick={() => toggleSubject(sub.id)}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                    selectedSubjects.includes(sub.id)
                      ? "border-blue-500 bg-blue-900/30 text-blue-400"
                      : "border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600 hover:text-white"
                  }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>
            {selectedSubjects.length > 0 && (
              <p className="text-slate-500 text-xs mt-3">
                {selectedSubjects.length} subject
                {selectedSubjects.length > 1 ? "s" : ""} selected
              </p>
            )}
          </div>
        )}

        {needsCommunicationMode && (
          <div className="mb-8">
            <h2 className="text-slate-300 font-medium mb-3 text-sm uppercase tracking-wider">
              Communication Mode
            </h2>
            <p className="text-slate-500 text-xs mb-3">
              Pick the kind of speaking challenge you want to practice.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {communicationModes.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedCommunicationMode(item.id)}
                  className={`text-left p-4 rounded-xl border transition-all ${
                    selectedCommunicationMode === item.id
                      ? "border-cyan-500 bg-cyan-900/20"
                      : "border-slate-700 bg-slate-900 hover:border-slate-600"
                  }`}
                >
                  <div className="text-white font-medium text-sm">
                    {item.label}
                  </div>
                  <div className="text-slate-400 text-xs mt-1">
                    {item.desc}
                  </div>
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

        {needsRole && (
          <div className="mb-8">
            <h2 className="text-slate-300 font-medium mb-3 text-sm uppercase tracking-wider">
              Target Role
            </h2>
            <div className="flex flex-wrap gap-2">
              {roles.map((role) => (
                <button
                  key={role.id}
                  onClick={() => setSelectedRole(role.id)}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                    selectedRole === role.id
                      ? "border-blue-500 bg-blue-900/30 text-white"
                      : "border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600 hover:text-white"
                  }`}
                >
                  {role.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Question Range */}
        <div className="mb-8">
          <h2 className="text-slate-300 font-medium mb-3 text-sm uppercase tracking-wider">
            Question Range
          </h2>
          <div className="flex gap-3">
            {questionRanges.map((range) => (
              <button
                key={range.id}
                onClick={() => setSelectedQuestionRange(range.id)}
                className={`flex-1 p-4 rounded-xl border transition-all ${
                  selectedQuestionRange === range.id
                    ? "border-blue-500 bg-blue-900/30"
                    : "border-slate-700 bg-slate-900 hover:border-slate-600"
                }`}
              >
                <div className="text-white font-medium text-sm">
                  {range.label}
                </div>
                <div className="text-slate-400 text-xs mt-1">{range.desc}</div>
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
