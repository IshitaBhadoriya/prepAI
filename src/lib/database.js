import { supabase } from "./supabase";

// ─── USERS ────────────────────────────────────────────────────────────────────

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

// Get all sessions for the current user, most recent first
export async function getUserSessions(userId) {
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("user_id", userId) // only this user's sessions
    .order("created_at", { ascending: false }) // newest first
    .limit(20); // max 20 for now

  if (error) {
    console.error("Error fetching sessions:", error.message);
    return [];
  }
  return data;
}

// Get session stats summary for dashboard
export async function getUserStats(userId) {
  const { data, error } = await supabase
    .from("sessions")
    .select("tech_score, comm_score, completeness_score, created_at")
    .eq("user_id", userId);

  if (error || !data || data.length === 0) {
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
}

// Insert a new session record — returns the created session with its id
export async function createSession(userId, mode, subject, difficulty) {
  const { data, error } = await supabase
    .from("sessions")
    .insert({
      user_id: userId,
      mode,
      subject: subject || null,
      difficulty,
    })
    .select() // .select() returns the created row, including the auto-generated id
    .single(); // we inserted one row, so we expect one back

  if (error) {
    console.error("Error creating session:", error.message);
    return null;
  }
  return data;
}

// Update session scores after feedback is generated
export async function updateSessionScores(
  sessionId,
  techScore,
  commScore,
  completenessScore,
  durationSeconds,
) {
  const { error } = await supabase
    .from("sessions")
    .update({
      tech_score: techScore,
      comm_score: commScore,
      completeness_score: completenessScore,
      duration_seconds: durationSeconds,
    })
    .eq("id", sessionId);

  if (error) console.error("Error updating session scores:", error.message);
}

// ─── STREAKS ──────────────────────────────────────────────────────────────────

export async function getStreak(userId) {
  const { data, error } = await supabase
    .from("streaks")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error) return { current_streak: 0, longest_streak: 0 };
  return data;
}

export async function updateStreak(userId) {
  const today = new Date().toISOString().split("T")[0]; // "2026-03-08"

  const { data: existing } = await supabase
    .from("streaks")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!existing) {
    // First time — create streak record
    await supabase.from("streaks").insert({
      user_id: userId,
      current_streak: 1,
      longest_streak: 1,
      last_active_date: today,
    });
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

  await supabase
    .from("streaks")
    .update({
      current_streak: newStreak,
      longest_streak: Math.max(newStreak, existing.longest_streak),
      last_active_date: today,
    })
    .eq("user_id", userId);
}
