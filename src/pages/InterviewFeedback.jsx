import { useState, useRef, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import DashboardLayout from "../components/layout/DashboardLayout";
import { generateFeedback } from "../lib/api";
import {
  createSession,
  updateSessionScores,
  updateStreak,
  saveSessionFeedback,
} from "../lib/database";
import { downloadFeedbackPdf } from "../lib/pdfReport";

function formatLabel(value) {
  const labels = {
    hr: "HR",
    dsa: "DSA",
    dbms: "DBMS",
    os: "Operating Systems",
    cn: "Computer Networks",
  };

  if (!value) return "";
  if (labels[value]) return labels[value];

  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function ScoreBar({ label, score }) {
  const percentage = (score / 10) * 100;
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
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function InterviewFeedback() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const hasFetched = useRef(false);

  const {
    answers,
    mode,
    subject,
    selectedSubjects,
    communicationMode,
    difficulty,
    role,
    userId,
  } = state || {};
  const technicalSubjects = useMemo(() => {
    if (Array.isArray(selectedSubjects) && selectedSubjects.length > 0) {
      return selectedSubjects;
    }

    return subject
      ? subject
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      : [];
  }, [selectedSubjects, subject]);
  const subjectSummary = useMemo(
    () =>
      technicalSubjects.length > 0
        ? technicalSubjects.map((item) => formatLabel(item)).join(", ")
        : mode === "communication" && communicationMode
          ? formatLabel(communicationMode)
          : subject || "",
    [communicationMode, mode, subject, technicalSubjects],
  );
  const storedSubject = useMemo(
    () =>
      technicalSubjects.length > 0
        ? technicalSubjects.join(", ")
        : mode === "communication" && communicationMode
          ? communicationMode
          : subject || null,
    [communicationMode, mode, subject, technicalSubjects],
  );

  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!answers || answers.length === 0) {
      navigate("/interview/setup");
      return;
    }
    if (hasFetched.current) return;
    hasFetched.current = true;

    async function saveToSupabase(result) {
      try {
        const session = await createSession(
          userId,
          mode,
          storedSubject,
          difficulty,
        );
        if (session?.id) {
          await updateSessionScores(
            session.id,
            result.overallTechScore,
            result.overallCommScore,
            result.overallCompletenessScore,
            null,
          );
          await saveSessionFeedback(session.id, result);
          await updateStreak(userId);
          setSaved(true);
        }
      } catch (err) {
        console.error("Background save failed:", err.message);
      }
    }

    async function loadFeedback() {
      try {
        setLoading(true);
        const result = await generateFeedback(answers, {
          mode,
          subject: technicalSubjects.length > 0 ? technicalSubjects : subject,
          communicationMode,
          difficulty,
          role,
        });
        setFeedback(result);
        void saveToSupabase(result);
      } catch (err) {
        console.error("FEEDBACK ERROR:", err);
        setError("Failed to generate feedback. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    loadFeedback();
  }, [
    answers,
    communicationMode,
    difficulty,
    mode,
    navigate,
    role,
    storedSubject,
    subject,
    technicalSubjects,
    userId,
  ]);

  const knowledgeLabel =
    mode === "technical"
      ? "Technical Knowledge"
      : mode === "hr"
        ? "HR Judgment"
        : "Content Quality";

  function handleDownloadPdf() {
    downloadFeedbackPdf({
      feedback,
      answers,
      context: {
        mode,
        difficulty,
        subjectSummary,
      },
    });
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="text-4xl mb-4 animate-pulse">📊</div>
            <p className="text-white font-medium">
              Analysing your interview...
            </p>
            <p className="text-slate-400 text-sm mt-1">
              Reviewing your answers and preparing feedback
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="px-8 py-8 max-w-3xl">
          <div className="px-4 py-3 bg-red-900/20 border border-red-800/40 rounded-lg text-red-400 text-sm mb-4">
            {error}
          </div>
          <button
            onClick={() => navigate("/interview/setup")}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm"
          >
            Back to Setup
          </button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="px-8 py-8 max-w-3xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Interview Feedback</h1>
          <p className="text-slate-400 text-sm mt-1 capitalize">
            {mode} · {difficulty}
            {subjectSummary ? ` · ${subjectSummary}` : ""}
            {saved && <span className="ml-2 text-green-400">· Saved ✓</span>}
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 mb-6">
          <h2 className="text-white font-semibold mb-4">Overall Scores</h2>
          <ScoreBar label={knowledgeLabel} score={feedback.overallTechScore} />
          <ScoreBar label="Communication" score={feedback.overallCommScore} />
          <ScoreBar
            label="Completeness"
            score={feedback.overallCompletenessScore}
          />
        </div>

        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 mb-6">
          <h2 className="text-white font-semibold mb-2">Summary</h2>
          <p className="text-slate-300 text-sm leading-relaxed">
            {feedback.summary}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6">
            <h2 className="text-green-400 font-semibold mb-3">
              ✅ What Went Well
            </h2>
            <ul className="space-y-2">
              {feedback.whatWentWell.map((item, i) => (
                <li key={i} className="text-slate-300 text-sm">
                  • {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6">
            <h2 className="text-yellow-400 font-semibold mb-3">
              ⚠️ Areas to Improve
            </h2>
            <ul className="space-y-2">
              {feedback.areasToImprove.map((item, i) => (
                <li key={i} className="text-slate-300 text-sm">
                  • {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 mb-6">
          <h2 className="text-blue-400 font-semibold mb-3">
            📚 Study Suggestions
          </h2>
          <ul className="space-y-2">
            {feedback.studySuggestions.map((item, i) => (
              <li key={i} className="text-slate-300 text-sm">
                • {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="mb-8">
          <h2 className="text-white font-semibold mb-4">
            Per-Question Breakdown
          </h2>
          <div className="space-y-4">
            {feedback.perQuestion.map((q, i) => (
              <div
                key={i}
                className="bg-slate-900 border border-slate-700 rounded-2xl p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-slate-400 text-sm font-medium">
                    Question {i + 1}
                  </span>
                  <div className="flex gap-3 text-xs text-slate-400">
                    <span>
                      Tech: <span className="text-white">{q.techScore}/10</span>
                    </span>
                    <span>
                      Comm: <span className="text-white">{q.commScore}/10</span>
                    </span>
                    <span>
                      Complete:{" "}
                      <span className="text-white">
                        {q.completenessScore}/10
                      </span>
                    </span>
                  </div>
                </div>
                <p className="text-white text-sm font-medium mb-3">
                  {answers[i]?.question}
                </p>
                <div className="bg-slate-800/50 rounded-xl px-4 py-3 mb-4">
                  <p className="text-slate-400 text-xs mb-1">Your answer</p>
                  <p className="text-slate-300 text-sm">{answers[i]?.answer}</p>
                </div>
                <div className="space-y-3">
                  {q.whatWentWell && (
                    <div>
                      <p className="text-green-400 text-xs font-medium mb-1">
                        ✅ What went well
                      </p>
                      <p className="text-slate-300 text-sm">{q.whatWentWell}</p>
                    </div>
                  )}
                  {q.whatWasMissed && (
                    <div>
                      <p className="text-yellow-400 text-xs font-medium mb-1">
                        ⚠️ What was missed
                      </p>
                      <p className="text-slate-300 text-sm">
                        {q.whatWasMissed}
                      </p>
                    </div>
                  )}
                  {q.idealAnswer && (
                    <div>
                      <p className="text-blue-400 text-xs font-medium mb-1">
                        💡 Ideal answer
                      </p>
                      <p className="text-slate-300 text-sm">{q.idealAnswer}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            onClick={handleDownloadPdf}
            className="flex-1 py-3.5 rounded-xl font-semibold text-sm bg-white text-slate-950 transition-all hover:bg-slate-200"
          >
            Download PDF Report
          </button>
          <button
            onClick={() => navigate("/interview/setup")}
            className="flex-1 py-3.5 rounded-xl font-semibold text-sm bg-blue-600 hover:bg-blue-500 text-white transition-all"
          >
            Start New Session →
          </button>
          {!saved && (
            <button
              onClick={async () => {
                const session = await createSession(
                  userId,
                  mode,
                  storedSubject,
                  difficulty,
                );
                if (session?.id) {
                  await updateSessionScores(
                    session.id,
                    feedback.overallTechScore,
                    feedback.overallCommScore,
                    feedback.overallCompletenessScore,
                    null,
                  );
                  await saveSessionFeedback(session.id, feedback);
                  await updateStreak(userId);
                  setSaved(true);
                }
              }}
              className="flex-1 py-3.5 rounded-xl font-semibold text-sm bg-green-700 hover:bg-green-600 text-white transition-all border border-green-600"
            >
              💾 Save Results
            </button>
          )}
          {saved && (
            <div className="flex-1 py-3.5 rounded-xl font-semibold text-sm bg-slate-800 text-green-400 transition-all border border-slate-700 flex items-center justify-center">
              ✓ Saved
            </div>
          )}
          <button
            onClick={() => navigate("/dashboard")}
            className="flex-1 py-3.5 rounded-xl font-semibold text-sm bg-slate-800 hover:bg-slate-700 text-white transition-all border border-slate-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default InterviewFeedback;
