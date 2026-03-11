import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import DashboardLayout from "../components/layout/DashboardLayout";
import { generateQuestions } from "../lib/api";
import { saveSession } from "../lib/database";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";

function InterviewSession() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { mode, subject, difficulty } = state || {};

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
    if (!mode || !difficulty) {
      navigate("/interview/setup");
      return;
    }
    async function loadQuestions() {
      try {
        setLoading(true);
        setError("");
        const qs = await generateQuestions(mode, subject, difficulty);
        setQuestions(qs);
        setCurrentQuestion(qs[0]);
        setError("");
        setLoading(false);
      } catch (err) {
        setError("Failed to load questions. Please go back and try again.");
        setLoading(false);
      }
    }
    loadQuestions();
  }, []);

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
    if (!answer) {
      setError("Please provide an answer before continuing.");
      return;
    }

    if (isListening) stopListening();

    const newAnswers = [
      ...answers,
      {
        question: currentQuestion,
        answer,
        isFollowup: false,
      },
    ];
    setAnswers(newAnswers);
    setError("");

    const nextIndex = currentIndex + 1;
    if (nextIndex >= totalQuestions) {
      navigate("/interview/feedback", {
        state: {
          answers: newAnswers,
          mode,
          subject,
          difficulty,
          userId: user?.id,
        },
      });
    } else {
      setCurrentIndex(nextIndex);
      setCurrentQuestion(questions[nextIndex]);
      setTextAnswer("");
      resetTranscript();
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
              Gemini is crafting personalised questions for you
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
              {subject ? ` · ${subject}` : ""}
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
