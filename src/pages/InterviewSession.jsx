import { useState, useEffect, useRef, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import DashboardLayout from "../components/layout/DashboardLayout";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";
import { generateQuestions, generateFollowUp } from "../lib/api";

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

function InterviewSession() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const {
    mode,
    subject,
    selectedSubjects,
    communicationMode,
    difficulty,
    role,
    questionRange,
  } = state || {};
  const technicalSubjects = useMemo(() => {
    if (Array.isArray(selectedSubjects) && selectedSubjects.length > 0) {
      return selectedSubjects;
    }

    return subject
      ? subject.split(",").map((item) => item.trim()).filter(Boolean)
      : [];
  }, [selectedSubjects, subject]);
  const subjectSummary = useMemo(
    () =>
      technicalSubjects.length > 0
        ? technicalSubjects.map((item) => formatLabel(item)).join(", ")
        : "",
    [technicalSubjects],
  );
  const sessionContextLabel = useMemo(() => {
    if (mode === "technical") {
      return subjectSummary;
    }

    if (mode === "communication" && communicationMode) {
      return formatLabel(communicationMode);
    }

    return "";
  }, [communicationMode, mode, subjectSummary]);

  // Session state
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [answers, setAnswers] = useState([]);
  const [textAnswer, setTextAnswer] = useState("");
  const [followUpCount, setFollowUpCount] = useState(0);
  const [isFollowup, setIsFollowup] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const hasLoaded = useRef(false);

  // Speech recognition
  const {
    transcript,
    isListening,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition();

  // Load questions on mount
  useEffect(() => {
    if (
      !mode ||
      !difficulty ||
      (mode === "technical" && technicalSubjects.length === 0)
    ) {
      navigate("/interview/setup");
      return;
    }
    if (hasLoaded.current) return;
    hasLoaded.current = true;
    async function loadQuestions() {
      try {
        setLoading(true);
        setError("");

        console.log("Step 1 — calling generateQuestions...");
        const qs = await generateQuestions(
          mode,
          technicalSubjects,
          difficulty,
          role,
          questionRange,
          communicationMode,
        );
        console.log("Step 2 — questions received:", qs);

        setQuestions(qs);
        setCurrentQuestion(qs[0]);

        setError("");
        setLoading(false);
      } catch (err) {
        console.error("LOAD ERROR:", err);
        setError("Failed to load questions. Please go back and try again.");
        setLoading(false);
      }
    }
    loadQuestions();
  }, [
    communicationMode,
    difficulty,
    mode,
    navigate,
    questionRange,
    role,
    technicalSubjects,
  ]);

  // Sync speech transcript to text answer
  useEffect(() => {
    if (transcript) setTextAnswer(transcript);
  }, [transcript]);

  // Progress calculation
  const totalQuestions = questions.length;
  const progress =
    totalQuestions > 0 ? (currentIndex / totalQuestions) * 100 : 0;

  async function handleNext() {
    const answer = textAnswer.trim();
    const allowFollowUp = mode !== "communication";

    if (!answer) {
      setError("Please provide an answer before continuing.");
      return;
    }

    if (isListening) stopListening();

    setSubmitting(true);
    setError("");

    const newAnswers = [
      ...answers,
      {
        question: currentQuestion,
        answer,
        isFollowup,
      },
    ];

    try {
      // 🧠 STEP 1: Decide if follow-up should happen
      if (allowFollowUp && !isFollowup && followUpCount < 1) {
        const followUp = await generateFollowUp(
          currentQuestion,
          answer,
          role,
          mode,
          technicalSubjects,
          communicationMode,
        );

        if (followUp && followUp.length > 5) {
          setCurrentQuestion(followUp);
          setIsFollowup(true);
          setFollowUpCount(1);
          setAnswers(newAnswers);
          setTextAnswer("");
          resetTranscript();
          setSubmitting(false);
          return;
        }
      }

      // 🧠 STEP 2: Move to next main question
      const nextIndex = currentIndex + 1;

      if (nextIndex >= questions.length) {
        navigate("/interview/feedback", {
          state: {
            answers: newAnswers,
            mode,
            subject:
              technicalSubjects.length > 0
                ? technicalSubjects.join(", ")
                : subject || null,
            selectedSubjects: technicalSubjects,
            communicationMode,
            difficulty,
            role,
            userId: user?.id,
          },
        });
        return;
      }

      setAnswers(newAnswers);
      setCurrentIndex(nextIndex);
      setCurrentQuestion(questions[nextIndex]);

      // Reset follow-up state
      setIsFollowup(false);
      setFollowUpCount(0);

      setTextAnswer("");
      resetTranscript();
    } catch (err) {
      console.error("Follow-up error:", err);
      setError("Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // Loading screen
  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="text-4xl mb-4 animate-pulse">🤔</div>
            <p className="text-white font-medium">
              Preparing your questions...
            </p>
            <p className="text-slate-400 text-sm mt-1">
              Preparing a personalised interview for you
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="px-8 py-8 max-w-3xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-sm capitalize">
              {mode} · {difficulty}
              {sessionContextLabel ? ` · ${sessionContextLabel}` : ""}
            </p>
          </div>
          <span className="text-slate-400 text-sm">
            Question {currentIndex + 1} of {totalQuestions}
            {isFollowup && (
              <span className="ml-2 text-yellow-400 text-xs">(follow-up)</span>
            )}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-1.5 bg-slate-800 rounded-full mb-8">
          <div
            className="h-1.5 bg-blue-500 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Question Card */}
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 mb-6">
          <p className="text-white text-lg font-medium leading-relaxed">
            {currentQuestion}
          </p>
        </div>

        {/* Answer Input */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-slate-400 text-sm">Your Answer</label>
            {isSupported && (
              <button
                onClick={isListening ? stopListening : startListening}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isListening
                    ? "bg-red-900/30 text-red-400 border border-red-700/50"
                    : "bg-slate-800 text-slate-400 border border-slate-700 hover:text-white"
                }`}
              >
                {isListening ? "⏹ Stop Recording" : "🎤 Use Microphone"}
              </button>
            )}
          </div>

          {isListening && (
            <div className="flex items-center gap-2 mb-2 text-xs text-red-400">
              <span className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
              Listening... speak clearly
            </div>
          )}

          <textarea
            value={textAnswer}
            onChange={(e) => setTextAnswer(e.target.value)}
            placeholder="Type your answer here, or use the microphone button above..."
            rows={5}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 text-sm resize-none focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 px-4 py-3 bg-red-900/20 border border-red-800/40 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Next Button */}
        <button
          onClick={handleNext}
          disabled={submitting || !textAnswer.trim()}
          className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all ${
            submitting || !textAnswer.trim()
              ? "bg-slate-800 text-slate-600 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-500 text-white"
          }`}
        >
          {submitting
            ? "Thinking..."
            : currentIndex + 1 === totalQuestions && !isFollowup
              ? "Finish & Get Feedback →"
              : "Next Question →"}
        </button>
      </div>
    </DashboardLayout>
  );
}

export default InterviewSession;
