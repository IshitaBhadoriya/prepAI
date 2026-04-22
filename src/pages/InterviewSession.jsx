import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
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

function getQuestionTimeLimit(difficulty, isFollowup) {
  const baseSeconds = {
    easy: 180,
    medium: 150,
    hard: 120,
  }[difficulty] || 150;

  return isFollowup ? Math.max(60, Math.round(baseSeconds * 0.6)) : baseSeconds;
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
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
  const [loadAttempt, setLoadAttempt] = useState(0);
  const hasLoaded = useRef(false);
  const latestAnswerRef = useRef("");
  const autoSubmittedRef = useRef(false);
  const [timeLimit, setTimeLimit] = useState(() =>
    getQuestionTimeLimit(difficulty, false),
  );
  const [timeLeft, setTimeLeft] = useState(() =>
    getQuestionTimeLimit(difficulty, false),
  );

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
        setQuestions([]);
        setCurrentQuestion("");

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
        const message = err?.message || "";
        setQuestions([]);
        setCurrentQuestion("");
        setError(
          message.includes("GROQ_API_KEY") ||
            message.includes("AI service is not configured")
            ? "AI setup is missing. Add GROQ_API_KEY to the server environment, restart the dev server, and try again."
            : "Failed to load questions. Please check your connection and try again.",
        );
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
    loadAttempt,
  ]);

  function retryLoadingQuestions() {
    hasLoaded.current = false;
    setLoadAttempt((current) => current + 1);
  }

  // Sync speech transcript to text answer
  useEffect(() => {
    if (transcript) setTextAnswer(transcript);
  }, [transcript]);

  useEffect(() => {
    latestAnswerRef.current = textAnswer;
  }, [textAnswer]);

  useEffect(() => {
    if (!currentQuestion) return;
    const nextLimit = getQuestionTimeLimit(difficulty, isFollowup);
    setTimeLimit(nextLimit);
    setTimeLeft(nextLimit);
    autoSubmittedRef.current = false;
  }, [currentQuestion, difficulty, isFollowup]);

  // Progress calculation
  const totalQuestions = questions.length;
  const progress =
    totalQuestions > 0 ? (currentIndex / totalQuestions) * 100 : 0;

  const handleNext = useCallback(async ({ autoSubmit = false } = {}) => {
    const answer = (autoSubmit ? latestAnswerRef.current : textAnswer).trim();
    const allowFollowUp = mode !== "communication";

    if (!answer && !autoSubmit) {
      setError("Please provide an answer before continuing.");
      return;
    }

    if (autoSubmit) {
      autoSubmittedRef.current = true;
    }

    if (isListening) stopListening();

    setSubmitting(true);
    setError("");

    const finalAnswer = answer || "[No answer submitted before time ended.]";
    const newAnswers = [
      ...answers,
      {
        question: currentQuestion,
        answer: finalAnswer,
        isFollowup,
        timedOut: autoSubmit && !answer,
      },
    ];

    try {
      if (allowFollowUp && answer && !isFollowup && followUpCount < 1) {
        const followUp = await generateFollowUp(
          currentQuestion,
          finalAnswer,
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
  }, [
    answers,
    communicationMode,
    currentIndex,
    currentQuestion,
    difficulty,
    followUpCount,
    isFollowup,
    isListening,
    mode,
    navigate,
    questions,
    resetTranscript,
    role,
    stopListening,
    subject,
    technicalSubjects,
    textAnswer,
    user?.id,
  ]);

  useEffect(() => {
    if (loading || submitting || !currentQuestion) return undefined;

    if (timeLeft <= 0) {
      if (!autoSubmittedRef.current) {
        void handleNext({ autoSubmit: true });
      }
      return undefined;
    }

    const timerId = window.setTimeout(() => {
      setTimeLeft((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearTimeout(timerId);
  }, [currentQuestion, handleNext, loading, submitting, timeLeft]);

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

  if (error && questions.length === 0) {
    return (
      <DashboardLayout>
        <div className="flex min-h-screen items-center justify-center px-6">
          <div className="w-full max-w-lg rounded-lg border border-red-900/50 bg-slate-900 p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-red-400">
              Interview could not start
            </p>
            <h1 className="mt-2 text-2xl font-bold text-white">
              Questions did not load.
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">{error}</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={retryLoadingQuestions}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"
              >
                Retry
              </button>
              <button
                onClick={() => navigate("/interview/setup")}
                className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
              >
                Back to setup
              </button>
            </div>
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

        <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900 p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-300">
              Time remaining
            </span>
            <span
              className={`text-sm font-bold ${
                timeLeft <= 20 ? "text-red-400" : "text-white"
              }`}
              aria-live="polite"
            >
              {formatTime(timeLeft)}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-800">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${
                timeLeft <= 20
                  ? "bg-red-500"
                  : timeLeft <= 45
                    ? "bg-yellow-500"
                    : "bg-blue-500"
              }`}
              style={{
                width: `${timeLimit > 0 ? (timeLeft / timeLimit) * 100 : 0}%`,
              }}
            />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            The answer will auto-submit when the timer reaches zero.
          </p>
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
          onClick={() => handleNext()}
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
