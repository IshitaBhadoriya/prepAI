import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import DashboardLayout from "../components/layout/DashboardLayout";
import { useAuth } from "../context/useAuth";
import {
  createQuestionSet,
  deleteQuestionSet,
  getQuestionSets,
  updateQuestionSet,
} from "../lib/database";

const MAX_QUESTIONS = 200;

function parseQuestions(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function normalizePracticeCount(value, total) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return Math.min(10, total);
  return Math.max(1, Math.min(total, Math.floor(numericValue)));
}

function formatDate(value) {
  if (!value) return "Recently created";

  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function PracticeSetupModal({ questionSet, onClose, onStart }) {
  const totalQuestions = questionSet?.questions.length || 0;
  const [questionCount, setQuestionCount] = useState(
    Math.min(10, totalQuestions),
  );
  const requestedQuestionCount = normalizePracticeCount(
    questionCount,
    totalQuestions,
  );

  function handleSubmit(event) {
    event.preventDefault();
    onStart(questionSet, requestedQuestionCount);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 px-4 py-8">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-950"
      >
        <div className="border-b border-slate-800 px-6 py-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-400">
            Start Practice
          </p>
          <h2 className="mt-1 text-lg font-semibold text-white">
            {questionSet.name}
          </h2>
        </div>

        <div className="px-6 py-6">
          <label className="mb-2 block text-sm font-medium text-slate-300">
            Questions to practice
          </label>
          <input
            type="number"
            min="1"
            max={totalQuestions}
            value={questionCount}
            onChange={(event) => setQuestionCount(event.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-blue-500"
          />
          <p className="mt-2 text-xs text-slate-500">
            {requestedQuestionCount} random question
            {requestedQuestionCount === 1 ? "" : "s"} will be selected from{" "}
            {totalQuestions} saved questions.
          </p>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-800 px-6 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"
          >
            Start Interview
          </button>
        </div>
      </form>
    </div>
  );
}

function QuestionSetModal({ initialSet, saving, onClose, onSave }) {
  const [name, setName] = useState(initialSet?.name || "");
  const [rawQuestions, setRawQuestions] = useState(
    initialSet?.questions?.map((question) => question.question_text).join("\n") ||
      "",
  );
  const [error, setError] = useState("");

  const parsedQuestions = useMemo(
    () => parseQuestions(rawQuestions),
    [rawQuestions],
  );
  const isEditing = Boolean(initialSet);

  function handleSubmit(event) {
    event.preventDefault();
    const trimmedName = name.trim();

    if (!trimmedName) {
      setError("Give this set a clear name.");
      return;
    }

    if (parsedQuestions.length < 1) {
      setError("Add at least one question.");
      return;
    }

    if (parsedQuestions.length > MAX_QUESTIONS) {
      setError(`Keep each set to ${MAX_QUESTIONS} questions or fewer.`);
      return;
    }

    setError("");
    onSave({
      id: initialSet?.id,
      name: trimmedName,
      questions: parsedQuestions,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 px-4 py-8">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-5xl rounded-lg border border-slate-700 bg-slate-950"
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-400">
              {isEditing ? "Edit Set" : "Create Set"}
            </p>
            <h2 className="mt-1 text-lg font-semibold text-white">
              {isEditing ? "Update question file" : "New question file"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            Close
          </button>
        </div>

        <div className="grid gap-6 px-6 py-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Set name
              </label>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Amazon DSA Prep"
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-blue-500"
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <label className="block text-sm font-medium text-slate-300">
                  Questions
                </label>
                <span
                  className={`text-xs font-medium ${
                    parsedQuestions.length > MAX_QUESTIONS
                      ? "text-red-400"
                      : "text-slate-500"
                  }`}
                >
                  {parsedQuestions.length}/{MAX_QUESTIONS}
                </span>
              </div>
              <textarea
                value={rawQuestions}
                onChange={(event) => setRawQuestions(event.target.value)}
                placeholder="Paste questions here, one per line."
                rows={18}
                className="w-full resize-y rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm leading-6 text-white outline-none transition-colors placeholder:text-slate-600 focus:border-blue-500"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}
          </div>

          <aside className="rounded-lg border border-slate-800 bg-slate-900 p-4">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">
                Live preview
              </h3>
              <span className="rounded-full border border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-300">
                {parsedQuestions.length} questions
              </span>
            </div>

            {parsedQuestions.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-700 px-4 py-10 text-center">
                <p className="text-sm text-slate-400">
                  Parsed questions will appear here as you paste them.
                </p>
              </div>
            ) : (
              <div className="max-h-[430px] space-y-2 overflow-y-auto pr-1">
                {parsedQuestions.slice(0, MAX_QUESTIONS).map((question, index) => (
                  <div
                    key={`${question}-${index}`}
                    className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2"
                  >
                    <p className="text-xs font-semibold text-slate-500">
                      Q{index + 1}
                    </p>
                    <p className="mt-1 text-sm leading-5 text-slate-300">
                      {question}
                    </p>
                  </div>
                ))}
                {parsedQuestions.length > MAX_QUESTIONS && (
                  <p className="px-1 text-xs text-red-300">
                    Remove {parsedQuestions.length - MAX_QUESTIONS} questions
                    before saving.
                  </p>
                )}
              </div>
            )}
          </aside>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-800 px-6 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
              saving
                ? "bg-slate-800 text-slate-500"
                : "bg-blue-600 text-white hover:bg-blue-500"
            }`}
          >
            {saving ? "Saving..." : isEditing ? "Save Changes" : "Create Set"}
          </button>
        </div>
      </form>
    </div>
  );
}

function QuestionSetCard({ questionSet, onEdit, onDelete, onStart }) {
  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">
            {questionSet.name}
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Created {formatDate(questionSet.created_at)}
          </p>
        </div>
        <span className="rounded-full border border-blue-800 bg-blue-950 px-2.5 py-1 text-xs font-medium text-blue-300">
          {questionSet.questions.length} questions
        </span>
      </div>

      <div className="mt-5 space-y-2">
        {questionSet.questions.slice(0, 3).map((question, index) => (
          <div
            key={question.id || `${question.question_text}-${index}`}
            className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2"
          >
            <p className="text-xs font-medium text-slate-500">
              Preview {index + 1}
            </p>
            <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-300">
              {question.question_text}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <button
          onClick={() => onStart(questionSet)}
          className="rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"
        >
          Start Interview
        </button>
        <button
          onClick={() => onEdit(questionSet)}
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-700"
        >
          Edit
        </button>
        <button
          onClick={() => onDelete(questionSet)}
          className="rounded-lg border border-red-900/60 bg-red-950/30 px-3 py-2.5 text-sm font-semibold text-red-300 hover:bg-red-950/50"
        >
          Delete
        </button>
      </div>
    </section>
  );
}

function Questions() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [questionSets, setQuestionSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [modalSet, setModalSet] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [practiceSet, setPracticeSet] = useState(null);

  const loadQuestionSets = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      setError("");
      const sets = await getQuestionSets(user.id);
      setQuestionSets(sets);
    } catch (err) {
      setError(
        err?.message ||
          "Question sets could not be loaded. Check your Supabase schema.",
      );
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadQuestionSets();
  }, [loadQuestionSets]);

  function openCreateModal() {
    setModalSet(null);
    setIsModalOpen(true);
  }

  function openEditModal(questionSet) {
    setModalSet(questionSet);
    setIsModalOpen(true);
  }

  async function handleSave(payload) {
    try {
      setSaving(true);
      setError("");

      if (payload.id) {
        const updated = await updateQuestionSet(
          user.id,
          payload.id,
          payload.name,
          payload.questions,
        );
        setQuestionSets((sets) =>
          sets.map((set) => (set.id === updated.id ? updated : set)),
        );
      } else {
        const created = await createQuestionSet(
          user.id,
          payload.name,
          payload.questions,
        );
        setQuestionSets((sets) => [created, ...sets]);
      }

      setIsModalOpen(false);
      setModalSet(null);
    } catch (err) {
      setError(err?.message || "Question set could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(questionSet) {
    const ok = window.confirm(`Delete "${questionSet.name}" permanently?`);
    if (!ok) return;

    try {
      setError("");
      await deleteQuestionSet(user.id, questionSet.id);
      setQuestionSets((sets) =>
        sets.filter((current) => current.id !== questionSet.id),
      );
    } catch (err) {
      setError(err?.message || "Question set could not be deleted.");
    }
  }

  function openPracticeModal(questionSet) {
    if (questionSet.questions.length === 0) {
      setError("This set has no questions yet.");
      return;
    }

    setPracticeSet(questionSet);
  }

  function handleStart(questionSet, questionCount) {
    const customQuestions = questionSet.questions
      .map((question) => question.question_text)
      .filter(Boolean);

    if (customQuestions.length === 0) {
      setError("This set has no questions yet.");
      return;
    }

    setPracticeSet(null);
    navigate("/interview/session", {
      state: {
        mode: "custom",
        subject: questionSet.name,
        difficulty: "medium",
        role: null,
        customQuestionSetId: questionSet.id,
        customQuestionSetName: questionSet.name,
        customQuestionCount: normalizePracticeCount(
          questionCount,
          customQuestions.length,
        ),
        customQuestions,
      },
    });
  }

  return (
    <DashboardLayout>
      {isModalOpen && (
        <QuestionSetModal
          initialSet={modalSet}
          saving={saving}
          onClose={() => {
            setIsModalOpen(false);
            setModalSet(null);
          }}
          onSave={handleSave}
        />
      )}
      {practiceSet && (
        <PracticeSetupModal
          questionSet={practiceSet}
          onClose={() => setPracticeSet(null)}
          onStart={handleStart}
        />
      )}

      <div className="px-8 py-8">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-wider text-blue-400">
              Question Bank
            </p>
            <h1 className="mt-2 text-2xl font-bold text-white">
              Build reusable interview question files
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Paste your own prompts, keep them organized, and run AI-powered
              interview sessions from any saved set.
            </p>
          </div>
          <button
            onClick={openCreateModal}
            className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"
          >
            Create New Set
          </button>
        </div>

        {error && (
          <div className="mb-5 rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-lg border border-slate-800 bg-slate-900 px-6 py-14 text-center">
            <p className="text-sm font-medium text-white">
              Loading question sets...
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Your saved files will appear here.
            </p>
          </div>
        ) : questionSets.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/60 px-6 py-14 text-center">
            <h2 className="text-lg font-semibold text-white">
              No question sets yet
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
              Create a set once, then reuse it from here or from interview
              setup whenever you practice.
            </p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <button
                onClick={openCreateModal}
                className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"
              >
                Create New Set
              </button>
              <Link
                to="/interview/setup"
                className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-700"
              >
                Go to Setup
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            {questionSets.map((questionSet) => (
              <QuestionSetCard
                key={questionSet.id}
                questionSet={questionSet}
                onEdit={openEditModal}
                onDelete={handleDelete}
                onStart={openPracticeModal}
              />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

export default Questions;
