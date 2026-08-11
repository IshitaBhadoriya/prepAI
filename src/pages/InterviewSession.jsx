import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import DashboardLayout from "../components/layout/DashboardLayout";
import { useDeepgramTranscription } from "../hooks/useDeepgramTranscription";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";
import { generateQuestions, generateFollowUp } from "../lib/api";
import { computeSpeechMetrics } from "../lib/speechMetrics";

const USE_DEEPGRAM = import.meta.env.VITE_USE_DEEPGRAM !== "false";

function formatLabel(value) {
  const labels = {
    hr: "HR",
    dsa: "DSA",
    dbms: "DBMS",
    os: "Operating Systems",
    cn: "Computer Networks",
    custom: "Custom Questions",
  };

  if (!value) return "";
  if (labels[value]) return labels[value];

  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getQuestionTimeLimit(difficulty, isFollowup) {
  const baseSeconds =
    {
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

function normalizeCustomQuestions(value) {
  return Array.isArray(value)
    ? value.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
}

function shuffleQuestions(items) {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }

  return shuffled;
}

function clampQuestionCount(value, total) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return total;
  return Math.max(1, Math.min(total, Math.floor(numericValue)));
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
    customQuestionCount,
    customQuestions,
    customQuestionSetId,
    customQuestionSetName,
  } = state || {};
  const customQuestionList = useMemo(
    () => normalizeCustomQuestions(customQuestions),
    [customQuestions],
  );
  const isCustomMode = mode === "custom" && customQuestionList.length > 0;
  const sessionDifficulty = difficulty || "medium";
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
        : "",
    [technicalSubjects],
  );
  const sessionContextLabel = useMemo(() => {
    if (mode === "custom") {
      return customQuestionSetName || subject || "Custom Questions";
    }

    if (mode === "technical") {
      return subjectSummary;
    }

    if (mode === "communication" && communicationMode) {
      return formatLabel(communicationMode);
    }

    return "";
  }, [communicationMode, customQuestionSetName, mode, subject, subjectSummary]);

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
  const usedMicRef = useRef(false);
  const wantsMicRef = useRef(false);
  const deepgramFallbackWarnedRef = useRef(false);
  const [timeLimit, setTimeLimit] = useState(() =>
    getQuestionTimeLimit(sessionDifficulty, false),
  );
  const [timeLeft, setTimeLeft] = useState(() =>
    getQuestionTimeLimit(sessionDifficulty, false),
  );
  const [useWebSpeechFallback, setUseWebSpeechFallback] = useState(false);

  // Speech recognition
  const deepgram = useDeepgramTranscription();
  const webSpeech = useSpeechRecognition();
  const usingDeepgram = USE_DEEPGRAM && !useWebSpeechFallback;
  const transcript = usingDeepgram ? deepgram.transcript : webSpeech.transcript;
  const isListening = usingDeepgram
    ? deepgram.isListening
    : webSpeech.isListening;
  const isSupported = usingDeepgram
    ? deepgram.isSupported
    : webSpeech.isSupported;
  const startListening = usingDeepgram
    ? deepgram.startListening
    : webSpeech.startListening;
  const stopListening = usingDeepgram
    ? deepgram.stopListening
    : webSpeech.stopListening;
  const recognitionWords = usingDeepgram ? deepgram.words : undefined;
  const recognitionDuration = usingDeepgram ? deepgram.duration : undefined;
  const isMicConnecting = usingDeepgram && deepgram.isConnecting;
  useEffect(() => {
    if (!USE_DEEPGRAM || useWebSpeechFallback) {
      return;
    }

    if (!deepgram.isSupported && webSpeech.isSupported) {
      setUseWebSpeechFallback(true);

      if (import.meta.env.DEV && !deepgramFallbackWarnedRef.current) {
        console.warn(
          "Deepgram voice recognition is unavailable. Switching to browser speech recognition.",
        );
        deepgramFallbackWarnedRef.current = true;
      }
      return;
    }

    if (deepgram.connectionError) {
      setUseWebSpeechFallback(true);

      if (import.meta.env.DEV && !deepgramFallbackWarnedRef.current) {
        console.warn(
          "Deepgram voice recognition failed. Switching to browser speech recognition.",
          deepgram.connectionError,
        );
        deepgramFallbackWarnedRef.current = true;
      }
    }
  }, [
    deepgram.connectionError,
    deepgram.isSupported,
    useWebSpeechFallback,
    webSpeech.isSupported,
  ]);

  useEffect(() => {
    if (
      !useWebSpeechFallback ||
      !wantsMicRef.current ||
      webSpeech.isListening ||
      !webSpeech.isSupported
    ) {
      return;
    }

    // Depend only on primitive values, not the whole `webSpeech` object —
    // that object is a new reference every render, which made this effect
    // re-fire on every re-render (not just when the fallback actually
    // changed) and call startListening() while it was already running.
    webSpeech.startListening();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useWebSpeechFallback, webSpeech.isListening, webSpeech.isSupported]);
  const resetSpeechTranscripts = useCallback(() => {
    deepgram.resetTranscript();
    webSpeech.resetTranscript();
  }, [deepgram, webSpeech]);

  const handleMicToggle = useCallback(() => {
    if (isMicConnecting) return;

    if (isListening) {
      wantsMicRef.current = false;
      stopListening();
      return;
    }

    usedMicRef.current = true;
    wantsMicRef.current = true;
    startListening();
  }, [isListening, isMicConnecting, startListening, stopListening]);

  // Load questions on mount
  useEffect(() => {
    if (
      !mode ||
      (!sessionDifficulty && !isCustomMode) ||
      (mode === "custom" && customQuestionList.length === 0) ||
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

        if (isCustomMode) {
          const requestedCount = clampQuestionCount(
            customQuestionCount,
            customQuestionList.length,
          );
          const shuffledQuestions = shuffleQuestions(customQuestionList).slice(
            0,
            requestedCount,
          );
          setQuestions(shuffledQuestions);
          setCurrentQuestion(shuffledQuestions[0]);
          setError("");
          setLoading(false);
          return;
        }

        const qs = await generateQuestions(
          mode,
          technicalSubjects,
          sessionDifficulty,
          role,
          questionRange,
          communicationMode,
        );

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
    customQuestionCount,
    customQuestionList,
    isCustomMode,
    mode,
    navigate,
    questionRange,
    role,
    sessionDifficulty,
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
    const nextLimit = getQuestionTimeLimit(sessionDifficulty, isFollowup);
    setTimeLimit(nextLimit);
    setTimeLeft(nextLimit);
    autoSubmittedRef.current = false;
    usedMicRef.current = false;
  }, [currentQuestion, sessionDifficulty, isFollowup]);

  // Progress calculation
  const totalQuestions = questions.length;
  const progress =
    totalQuestions > 0 ? (currentIndex / totalQuestions) * 100 : 0;
  const isLastQuestion = currentIndex + 1 >= totalQuestions;
  const canGenerateFollowUp =
    mode !== "communication" && !isFollowup && followUpCount < 1;
  const primaryActionLabel = submitting
    ? canGenerateFollowUp
      ? "Checking follow-up..."
      : "Submitting..."
    : canGenerateFollowUp
      ? "Submit Answer"
      : isLastQuestion
        ? "Finish & Get Feedback"
        : "Next Question";

  const moveToNextMainQuestion = useCallback(
    (nextAnswers) => {
      const nextIndex = currentIndex + 1;

      if (nextIndex >= questions.length) {
        navigate("/interview/feedback", {
          state: {
            answers: nextAnswers,
            mode,
            subject:
              technicalSubjects.length > 0
                ? technicalSubjects.join(", ")
                : subject || null,
            selectedSubjects: technicalSubjects,
            communicationMode,
            customQuestionSetId,
            customQuestionSetName,
            difficulty: sessionDifficulty,
            role,
            userId: user?.id,
          },
        });
        return;
      }

      setAnswers(nextAnswers);
      setCurrentIndex(nextIndex);
      setCurrentQuestion(questions[nextIndex]);
      setIsFollowup(false);
      setFollowUpCount(0);
      setTextAnswer("");
      resetSpeechTranscripts();
    },
    [
      communicationMode,
      currentIndex,
      customQuestionSetId,
      customQuestionSetName,
      mode,
      navigate,
      questions,
      resetSpeechTranscripts,
      role,
      sessionDifficulty,
      subject,
      technicalSubjects,
      user?.id,
    ],
  );

  const handleNext = useCallback(
    async ({ autoSubmit = false } = {}) => {
      const answer = (autoSubmit ? latestAnswerRef.current : textAnswer).trim();
      const allowFollowUp = mode !== "communication";

      if (!answer && !autoSubmit) {
        setError("Please provide an answer before continuing.");
        return;
      }

      if (autoSubmit) {
        autoSubmittedRef.current = true;
      }

      if (isListening) {
        wantsMicRef.current = false;
        stopListening();
      }

      setSubmitting(true);
      setError("");

      const finalAnswer = answer || "[No answer submitted before time ended.]";
      const elapsedSeconds = Math.max(timeLimit - timeLeft, 1);
      const speechDuration = usingDeepgram
        ? Math.max(Number(recognitionDuration) || 0, elapsedSeconds)
        : elapsedSeconds;
      const spokenMetrics =
        usedMicRef.current && answer
          ? computeSpeechMetrics({
              transcript: finalAnswer,
              words: usingDeepgram ? recognitionWords : undefined,
              duration: speechDuration,
            })
          : null;
      const newAnswers = [
        ...answers,
        {
          question: currentQuestion,
          answer: finalAnswer,
          isFollowup,
          timedOut: autoSubmit && !answer,
          wasSpoken: Boolean(spokenMetrics),
          fillerWords: spokenMetrics?.fillerWords ?? null,
          wordsPerMinute: spokenMetrics?.wordsPerMinute ?? null,
          longestPauseSeconds: spokenMetrics?.longestPauseSeconds ?? null,
          averagePauseSeconds: spokenMetrics?.averagePauseSeconds ?? null,
          repeatedPhrases: spokenMetrics?.repeatedPhrases ?? [],
          usedRealTimestamps: spokenMetrics?.usedRealTimestamps ?? false,
        },
      ];

      try {
        if (allowFollowUp && answer && !isFollowup && followUpCount < 1) {
          const followUpSubject =
            mode === "custom"
              ? customQuestionSetName || subject || "custom question bank"
              : technicalSubjects;

          const followUpResult = await generateFollowUp(
            currentQuestion,
            finalAnswer,
            role,
            mode,
            followUpSubject,
            communicationMode,
          );

          if (
            followUpResult?.shouldFollowUp &&
            followUpResult.question &&
            followUpResult.question.length > 5
          ) {
            setCurrentQuestion(followUpResult.question);
            setIsFollowup(true);
            setFollowUpCount(1);
            setAnswers(newAnswers);
            setTextAnswer("");
            resetSpeechTranscripts();
            setSubmitting(false);
            return;
          }
        }

        // 🧠 STEP 2: Move to next main question
        moveToNextMainQuestion(newAnswers);
      } catch (err) {
        console.error("Follow-up error:", err);
        setError("Something went wrong. Try again.");
      } finally {
        setSubmitting(false);
      }
    },
    [
      answers,
      communicationMode,
      currentQuestion,
      customQuestionSetName,
      followUpCount,
      isFollowup,
      isListening,
      mode,
      moveToNextMainQuestion,
      recognitionDuration,
      recognitionWords,
      role,
      resetSpeechTranscripts,
      stopListening,
      subject,
      technicalSubjects,
      textAnswer,
      timeLeft,
      timeLimit,
      usingDeepgram,
    ],
  );

  const handleSkip = useCallback(() => {
    if (submitting) return;

    if (isListening) {
      wantsMicRef.current = false;
      stopListening();
    }

    const skippedAnswers = [
      ...answers,
      {
        question: currentQuestion,
        answer: "[Question skipped. No answer submitted.]",
        isFollowup,
        skipped: true,
      },
    ];

    setError("");
    moveToNextMainQuestion(skippedAnswers);
  }, [
    answers,
    currentQuestion,
    isFollowup,
    isListening,
    moveToNextMainQuestion,
    stopListening,
    submitting,
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
          <div className="rounded-2xl border border-[var(--pf-border)] bg-[var(--pf-panel)] p-8 text-center shadow-lg">
            <div className="text-4xl mb-4 animate-pulse">🤔</div>
            <p className="text-[var(--pf-text)] font-medium">
              Preparing your questions...
            </p>
            <p className="text-[var(--pf-muted)] text-sm mt-1">
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
          <div className="w-full max-w-lg rounded-2xl border border-red-200 bg-[var(--pf-panel)] p-6 shadow-lg">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--pf-danger)]">
              Interview could not start
            </p>
            <h1 className="mt-2 text-2xl font-bold text-[var(--pf-text)]">
              Questions did not load.
            </h1>
            <p className="mt-3 text-sm leading-6 text-[var(--pf-text-secondary)]">
              {error}
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={retryLoadingQuestions}
                className="flex-1 rounded-lg bg-[var(--pf-primary)] px-4 py-3 text-sm font-bold text-white hover:bg-[var(--pf-primary-dark)]"
              >
                Retry
              </button>
              <button
                onClick={() => navigate("/interview/setup")}
                className="flex-1 rounded-lg border border-[var(--pf-border)] bg-[var(--pf-panel)] px-4 py-3 text-sm font-semibold text-[var(--pf-text)] hover:bg-[var(--pf-primary-light)]"
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
      <div className="px-6 py-8 md:px-8 md:py-10 max-w-3xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-[var(--pf-muted)] text-sm capitalize">
              {formatLabel(mode)}
              {mode !== "custom" ? ` / ${formatLabel(sessionDifficulty)}` : ""}
              {sessionContextLabel ? ` / ${sessionContextLabel}` : ""}
            </p>
          </div>
          <span className="text-[var(--pf-muted)] text-sm">
            Question {currentIndex + 1} of {totalQuestions}
            {isFollowup && (
              <span className="ml-2 text-[var(--pf-warning)] text-xs">
                (follow-up)
              </span>
            )}
          </span>
        </div>

        <div className="mb-6 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-panel)] p-6 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-[var(--pf-muted)]">
              Time remaining
            </span>
            <span
              className={`text-sm font-bold ${
                timeLeft <= 20
                  ? "text-[var(--pf-danger)]"
                  : "text-[var(--pf-text)]"
              }`}
              aria-live="polite"
            >
              {formatTime(timeLeft)}
            </span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-[var(--pf-panel-soft)] shadow-inner">
            <div
              className={`h-2.5 rounded-full transition-all duration-500 ${
                timeLeft <= 20
                  ? "bg-[var(--pf-danger)]"
                  : timeLeft <= 45
                    ? "bg-[var(--pf-warning)]"
                    : "bg-[var(--pf-primary)]"
              }`}
              style={{
                width: `${timeLimit > 0 ? (timeLeft / timeLimit) * 100 : 0}%`,
              }}
            />
          </div>
          <p className="mt-2 text-xs text-[var(--pf-muted)]">
            The answer will auto-submit when the timer reaches zero.
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8 h-2 w-full rounded-full bg-[var(--pf-panel-soft)] shadow-inner">
          <div
            className="h-2 rounded-full bg-[var(--pf-primary)] transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Question Card */}
        <div className="mb-6 rounded-2xl border border-[var(--pf-border)] bg-[var(--pf-panel)] p-8 shadow-lg">
          <p className="text-[var(--pf-text)] text-lg font-medium leading-relaxed">
            {currentQuestion}
          </p>
        </div>

        {/* Answer Input */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-[var(--pf-muted)] text-sm">
              Your Answer
            </label>
            {isSupported && (
              <button
                onClick={handleMicToggle}
                disabled={isMicConnecting}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isMicConnecting
                    ? "bg-amber-50 text-[var(--pf-warning)] border border-amber-200 cursor-not-allowed"
                    : isListening
                      ? "bg-red-50 text-[var(--pf-danger)] border border-red-200"
                      : "bg-[var(--pf-panel-soft)] text-[var(--pf-muted)] border border-[var(--pf-border)] hover:text-[var(--pf-text)]"
                }`}
              >
                {isMicConnecting
                  ? "⏳ Connecting..."
                  : isListening
                    ? "⏹ Stop Recording"
                    : "🎤 Use Microphone"}
              </button>
            )}
          </div>

          {USE_DEEPGRAM && useWebSpeechFallback && (
            <p className="mb-2 text-xs text-[var(--pf-warning)]">
              Voice recognition switched to browser mode.
            </p>
          )}

          {isListening && (
            <div className="flex items-center gap-2 mb-2 text-xs text-[var(--pf-danger)]">
              <span className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
              Listening... speak clearly
            </div>
          )}

          <textarea
            value={textAnswer}
            onChange={(e) => setTextAnswer(e.target.value)}
            placeholder="Type your answer here, or use the microphone button above..."
            rows={5}
            className="w-full bg-[var(--pf-panel)] border border-[var(--pf-border)] rounded-xl px-4 py-3 text-[var(--pf-text)] placeholder:text-[var(--pf-muted)] text-sm resize-none shadow-lg focus:outline-none focus:border-[var(--pf-primary)] focus:ring-4 focus:ring-lavender-300/50 transition-colors"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-[var(--pf-danger)] text-sm">
            {error}
          </div>
        )}

        {/* Next Button */}
        <button
          onClick={() => handleNext()}
          disabled={submitting || !textAnswer.trim()}
          className={`w-full rounded-xl py-4 text-sm font-bold shadow-lg transition-all ${
            submitting || !textAnswer.trim()
              ? "bg-[var(--pf-panel-soft)] text-[var(--pf-text-secondary)] cursor-not-allowed"
              : "bg-[var(--pf-primary)] hover:bg-[var(--pf-primary-dark)] text-white"
          }`}
        >
          {primaryActionLabel}
        </button>
        <button
          type="button"
          onClick={handleSkip}
          disabled={submitting}
          className={`mt-3 w-full rounded-xl border py-4 text-sm font-semibold transition-all ${
            submitting
              ? "cursor-not-allowed border-[#EAE2E8] bg-[var(--pf-panel)] text-[var(--pf-text-secondary)]"
              : "border-[var(--pf-border)] bg-[var(--pf-panel)] text-[var(--pf-text)] hover:bg-[var(--pf-primary-light)]"
          }`}
        >
          Skip
        </button>
      </div>
    </DashboardLayout>
  );
}

export default InterviewSession;
