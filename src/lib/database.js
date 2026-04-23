import { supabase } from "./supabase";

/** Supabase/PostgREST can hang (paused project, network). Fail so retries can run. */
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`${label} timed out after ${ms}ms`)),
        ms,
      ),
    ),
  ]);
}

const SUPABASE_OP_TIMEOUT_MS = 25_000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createUuid() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  throw new Error("crypto.randomUUID is not available in this browser");
}

// ─── USERS ────────────────────────────────────────────────────────────────────

function normalizeQuestionRows(questions) {
  return (questions ?? [])
    .map((question, index) => ({
      question_text: String(question?.question_text || question || "").trim(),
      sort_order: Number.isInteger(question?.sort_order)
        ? question.sort_order
        : index,
    }))
    .filter((question) => question.question_text);
}

function mapQuestionSet(set, questionsBySetId = new Map()) {
  const relatedQuestions =
    questionsBySetId.get(set.id) || normalizeQuestionRows(set.questions);

  return {
    ...set,
    questions: [...relatedQuestions].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
    ),
  };
}

// Save user to our users table after they log in
// We use "upsert" — insert if not exists, update if already there
// This is safe to call every time someone logs in
export async function saveUser(authUser) {
  const { error } = await supabase.from("users").upsert(
    {
      id: authUser.id,
      email: authUser.email,
      name: authUser.user_metadata?.full_name || null,
    },
    {
      onConflict: "id", // if id already exists, update instead of insert
      ignoreDuplicates: false, // always update name/email in case they changed
    },
  );

  if (error) console.error("Error saving user:", error.message);
}

// ─── SESSIONS ─────────────────────────────────────────────────────────────────

export async function getQuestionSets(userId) {
  if (!userId) {
    console.error("getQuestionSets called without a userId");
    return [];
  }

  try {
    const { data: sets, error: setsError } = await withTimeout(
      supabase
        .from("question_sets")
        .select("id, user_id, name, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      SUPABASE_OP_TIMEOUT_MS,
      "question sets select",
    );

    if (setsError) {
      console.error("Error fetching question sets:", setsError.message);
      throw new Error(setsError.message);
    }

    if (!sets || sets.length === 0) {
      return [];
    }

    const { data: questions, error: questionsError } = await withTimeout(
      supabase
        .from("question_bank_items")
        .select("id, set_id, question_text, sort_order")
        .in(
          "set_id",
          sets.map((set) => set.id),
        )
        .order("sort_order", { ascending: true }),
      SUPABASE_OP_TIMEOUT_MS,
      "question bank items select",
    );

    if (questionsError) {
      console.error("Error fetching question bank items:", questionsError.message);
      throw new Error(questionsError.message);
    }

    const questionsBySetId = new Map();
    for (const question of questions ?? []) {
      const list = questionsBySetId.get(question.set_id) || [];
      list.push(question);
      questionsBySetId.set(question.set_id, list);
    }

    return sets.map((set) => mapQuestionSet(set, questionsBySetId));
  } catch (err) {
    console.error("Error fetching question sets:", err.message);
    throw err;
  }
}

export async function getQuestionSetWithQuestions(userId, setId) {
  if (!userId || !setId) {
    console.error("getQuestionSetWithQuestions called without required ids");
    return null;
  }

  try {
    const { data: set, error: setError } = await withTimeout(
      supabase
        .from("question_sets")
        .select("id, user_id, name, created_at")
        .eq("id", setId)
        .eq("user_id", userId)
        .maybeSingle(),
      SUPABASE_OP_TIMEOUT_MS,
      "question set select",
    );

    if (setError || !set) {
      if (setError) console.error("Error fetching set:", setError.message);
      return null;
    }

    const { data: questions, error: questionsError } = await withTimeout(
      supabase
        .from("question_bank_items")
        .select("id, set_id, question_text, sort_order")
        .eq("set_id", setId)
        .order("sort_order", { ascending: true }),
      SUPABASE_OP_TIMEOUT_MS,
      "question set bank items select",
    );

    if (questionsError) {
      console.error("Error fetching set questions:", questionsError.message);
      return mapQuestionSet(set);
    }

    return mapQuestionSet(set, new Map([[set.id, questions ?? []]]));
  } catch (err) {
    console.error("Error fetching question set:", err.message);
    return null;
  }
}

export async function createQuestionSet(userId, name, questions) {
  if (!userId) throw new Error("You must be signed in to save questions.");

  const cleanedQuestions = normalizeQuestionRows(questions);
  if (!name?.trim()) throw new Error("Question set name is required.");
  if (cleanedQuestions.length === 0) {
    throw new Error("Add at least one question.");
  }

  const setId = createUuid();
  const { data: set, error: setError } = await withTimeout(
    supabase
      .from("question_sets")
      .insert({
        id: setId,
        user_id: userId,
        name: name.trim(),
      })
      .select("id, user_id, name, created_at")
      .single(),
    SUPABASE_OP_TIMEOUT_MS,
    "question set insert",
  );

  if (setError) throw new Error(setError.message);

  const questionRows = cleanedQuestions.map((question, index) => ({
    id: createUuid(),
    set_id: setId,
    question_text: question.question_text,
    sort_order: index,
  }));

  const { error: questionsError } = await withTimeout(
    supabase.from("question_bank_items").insert(questionRows),
    SUPABASE_OP_TIMEOUT_MS,
    "question bank items insert",
  );

  if (questionsError) {
    await supabase.from("question_sets").delete().eq("id", setId);
    throw new Error(questionsError.message);
  }

  return mapQuestionSet(set, new Map([[set.id, questionRows]]));
}

export async function updateQuestionSet(userId, setId, name, questions) {
  if (!userId || !setId) {
    throw new Error("Question set could not be updated.");
  }

  const cleanedQuestions = normalizeQuestionRows(questions);
  if (!name?.trim()) throw new Error("Question set name is required.");
  if (cleanedQuestions.length === 0) {
    throw new Error("Add at least one question.");
  }

  const { data: set, error: setError } = await withTimeout(
    supabase
      .from("question_sets")
      .update({ name: name.trim() })
      .eq("id", setId)
      .eq("user_id", userId)
      .select("id, user_id, name, created_at")
      .single(),
    SUPABASE_OP_TIMEOUT_MS,
    "question set update",
  );

  if (setError) throw new Error(setError.message);

  const { error: deleteError } = await withTimeout(
    supabase.from("question_bank_items").delete().eq("set_id", setId),
    SUPABASE_OP_TIMEOUT_MS,
    "question bank items replace delete",
  );

  if (deleteError) throw new Error(deleteError.message);

  const questionRows = cleanedQuestions.map((question, index) => ({
    id: createUuid(),
    set_id: setId,
    question_text: question.question_text,
    sort_order: index,
  }));

  const { error: insertError } = await withTimeout(
    supabase.from("question_bank_items").insert(questionRows),
    SUPABASE_OP_TIMEOUT_MS,
    "question bank items replace insert",
  );

  if (insertError) throw new Error(insertError.message);

  return mapQuestionSet(set, new Map([[set.id, questionRows]]));
}

export async function deleteQuestionSet(userId, setId) {
  if (!userId || !setId) {
    throw new Error("Question set could not be deleted.");
  }

  const { error } = await withTimeout(
    supabase
      .from("question_sets")
      .delete()
      .eq("id", setId)
      .eq("user_id", userId),
    SUPABASE_OP_TIMEOUT_MS,
    "question set delete",
  );

  if (error) throw new Error(error.message);
}

// Get all sessions for the current user, most recent first
export async function getUserSessions(userId) {
  if (!userId) {
    console.error("getUserSessions called without a userId");
    return [];
  }

  try {
    const { data, error } = await withTimeout(
      supabase
        .from("sessions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20),
      SUPABASE_OP_TIMEOUT_MS,
      "sessions select",
    );

    if (error) {
      console.error("Error fetching sessions:", error.message, error);
      return [];
    }

    return data ?? [];
  } catch (err) {
    console.error("Error fetching sessions:", err.message);
    return [];
  }
}

// Get session stats summary for dashboard
export async function getUserStats(userId) {
  if (!userId) {
    console.error("getUserStats called without a userId");
    return { total: 0, avgScore: null, bestScore: null };
  }

  try {
    const { data, error } = await withTimeout(
      supabase
        .from("sessions")
        .select("tech_score, comm_score, completeness_score, created_at")
        .eq("user_id", userId),
      SUPABASE_OP_TIMEOUT_MS,
      "sessions stats select",
    );

    if (error || !data || data.length === 0) {
      if (error) console.error("Error fetching stats:", error.message, error);
      return { total: 0, avgScore: null, bestScore: null };
    }

    const total = data.length;

    // Calculate average of all three score types
    const scores = data
      .map((s) => {
        const vals = [s.tech_score, s.comm_score, s.completeness_score].filter(
          Boolean,
        );
        return vals.length > 0
          ? vals.reduce((a, b) => a + b, 0) / vals.length
          : null;
      })
      .filter(Boolean);

    const avgScore =
      scores.length > 0
        ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
        : null;

    const bestScore = scores.length > 0 ? Math.max(...scores).toFixed(1) : null;

    return { total, avgScore, bestScore };
  } catch (err) {
    console.error("Error fetching stats:", err.message);
    return { total: 0, avgScore: null, bestScore: null };
  }
}

export async function createSession(userId, mode, subject, difficulty) {
  if (!userId) {
    console.error("createSession called without a userId");
    return null;
  }

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const sessionId = createUuid();
      const { error } = await withTimeout(
        supabase.from("sessions").insert({
          id: sessionId,
          user_id: userId,
          mode,
          subject: subject || null,
          difficulty,
        }),
        SUPABASE_OP_TIMEOUT_MS,
        "sessions insert",
      );

      if (error) {
        console.error(`Attempt ${attempt} error:`, error.message, error);
        if (attempt < 3) await sleep(2000);
        continue;
      }

      return { id: sessionId };
    } catch (err) {
      console.error(`Attempt ${attempt} exception:`, err.message);
      if (attempt < 3) await sleep(2000);
    }
  }
  return null;
}

// Update session scores after feedback is generated
export async function updateSessionScores(
  sessionId,
  techScore,
  commScore,
  completenessScore,
  durationSeconds,
) {
  if (!sessionId) {
    console.error("updateSessionScores called without a sessionId");
    return;
  }

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const { error } = await withTimeout(
        supabase
          .from("sessions")
          .update({
            tech_score: techScore,
            comm_score: commScore,
            completeness_score: completenessScore,
            duration_seconds: durationSeconds,
          })
          .eq("id", sessionId),
        SUPABASE_OP_TIMEOUT_MS,
        "sessions update scores",
      );

      if (error) {
        console.error(
          `updateSessionScores attempt ${attempt} error:`,
          error.message,
        );
        if (attempt < 3) await sleep(2000);
        continue;
      }

      return;
    } catch (err) {
      console.error(
        `updateSessionScores attempt ${attempt} exception:`,
        err.message,
      );
      if (attempt < 3) await sleep(2000);
    }
  }
}

// ─── STREAKS ──────────────────────────────────────────────────────────────────

export async function getStreak(userId) {
  if (!userId) {
    console.error("getStreak called without a userId");
    return { current_streak: 0, longest_streak: 0 };
  }

  try {
    const { data, error } = await withTimeout(
      supabase.from("streaks").select("*").eq("user_id", userId).maybeSingle(),
      SUPABASE_OP_TIMEOUT_MS,
      "streaks select",
    );

    if (error) {
      console.error("Error fetching streak:", error.message, error);
      return { current_streak: 0, longest_streak: 0 };
    }

    return data ?? { current_streak: 0, longest_streak: 0 };
  } catch (err) {
    console.error("Error fetching streak:", err.message);
    return { current_streak: 0, longest_streak: 0 };
  }
}

export async function updateStreak(userId) {
  if (!userId) {
    console.error("updateStreak called without a userId");
    return;
  }

  const today = new Date().toISOString().split("T")[0]; // "2026-03-08"

  const { data: existing, error: existingError } = await withTimeout(
    supabase.from("streaks").select("*").eq("user_id", userId).maybeSingle(),
    SUPABASE_OP_TIMEOUT_MS,
    "streaks lookup",
  );

  if (existingError) {
    console.error(
      "Error fetching streak before update:",
      existingError.message,
    );
    return;
  }

  if (!existing) {
    // First time — create streak record
    const { error } = await withTimeout(
      supabase.from("streaks").insert({
        user_id: userId,
        current_streak: 1,
        longest_streak: 1,
        last_active_date: today,
      }),
      SUPABASE_OP_TIMEOUT_MS,
      "streaks insert",
    );

    if (error) {
      console.error("Error creating streak:", error.message, error);
    }
    return;
  }

  const lastActive = existing.last_active_date;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  let newStreak = existing.current_streak;

  if (lastActive === today) {
    // Already practiced today — don't change streak
    return;
  } else if (lastActive === yesterdayStr) {
    // Practiced yesterday — increment streak
    newStreak = existing.current_streak + 1;
  } else {
    // Streak broken — reset to 1
    newStreak = 1;
  }

  const { error } = await withTimeout(
    supabase
      .from("streaks")
      .update({
        current_streak: newStreak,
        longest_streak: Math.max(newStreak, existing.longest_streak),
        last_active_date: today,
      })
      .eq("user_id", userId),
    SUPABASE_OP_TIMEOUT_MS,
    "streaks update",
  );

  if (error) {
    console.error("Error updating streak:", error.message, error);
  }
}
// Save full feedback JSON to a session
export async function saveSessionFeedback(sessionId, feedbackJson) {
  if (!sessionId) return;
  try {
    const { error } = await withTimeout(
      supabase
        .from("sessions")
        .update({ feedback_json: feedbackJson })
        .eq("id", sessionId),
      SUPABASE_OP_TIMEOUT_MS,
      "sessions feedback update",
    );
    if (error) console.error("Error saving feedback:", error.message);
  } catch (err) {
    console.error("saveSessionFeedback exception:", err.message);
  }
}

// Get a single session with its feedback
export async function getSessionWithFeedback(sessionId) {
  if (!sessionId) return null;
  try {
    const { data, error } = await withTimeout(
      supabase.from("sessions").select("*").eq("id", sessionId).single(),
      SUPABASE_OP_TIMEOUT_MS,
      "session fetch",
    );
    if (error) {
      console.error("Error fetching session:", error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.error("getSessionWithFeedback exception:", err.message);
    return null;
  }
}
