import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "../components/layout/DashboardLayout";
import { useAuth } from "../context/useAuth";
import { supabase } from "../lib/supabase";
import { getStreak, getUserStats } from "../lib/database";

const roleOptions = [
  "SDE Intern",
  "Software Engineer",
  "Frontend Engineer",
  "Backend Engineer",
  "Full Stack Developer",
  "Data Analyst",
  "Product Manager",
];

function StatTile({ label, value, hint }) {
  return (
    <div className="rounded-lg border border-[var(--pf-border)] bg-[var(--pf-panel)] p-6 shadow-lg transition-all hover:-translate-y-0.5">
      <p className="text-sm text-[var(--pf-muted)]">{label}</p>
      <p className="mt-2 text-4xl font-extrabold text-[var(--pf-text)]">{value}</p>
      <p className="mt-1 text-xs text-[var(--pf-muted)]">{hint}</p>
    </div>
  );
}

function Profile() {
  const { user, refreshUser } = useAuth();
  const metadata = user?.user_metadata || {};
  const [form, setForm] = useState({
    fullName: metadata.full_name || metadata.name || "",
    college: metadata.college || "",
    targetRole: metadata.target_role || roleOptions[0],
  });
  const [stats, setStats] = useState({
    total: 0,
    avgScore: null,
    bestScore: null,
  });
  const [streak, setStreak] = useState({ current_streak: 0 });
  const [loadingStats, setLoadingStats] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;

    setForm({
      fullName: metadata.full_name || metadata.name || "",
      college: metadata.college || "",
      targetRole: metadata.target_role || roleOptions[0],
    });
  }, [metadata.college, metadata.full_name, metadata.name, metadata.target_role, user]);

  useEffect(() => {
    if (!user) return;

    async function loadStats() {
      setLoadingStats(true);
      const [statsData, streakData] = await Promise.all([
        getUserStats(user.id),
        getStreak(user.id),
      ]);
      setStats(statsData);
      setStreak(streakData);
      setLoadingStats(false);
    }

    loadStats();
  }, [user]);

  const avatarUrl =
    metadata.avatar_url || metadata.picture || metadata.photo_url || "";
  const initials = useMemo(() => {
    const source = form.fullName || user?.email || "PF";
    return source
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("");
  }, [form.fullName, user?.email]);

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          full_name: form.fullName.trim(),
          college: form.college.trim(),
          target_role: form.targetRole,
        },
      });

      if (updateError) {
        throw updateError;
      }

      await refreshUser();
      setMessage("Profile updated.");
    } catch (err) {
      setError(err?.message || "Could not update profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="px-6 py-8 md:px-8 md:py-10">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-wider text-[var(--pf-primary)]">
            Profile
          </p>
          <h1 className="mt-2 text-2xl font-bold text-[var(--pf-text)]">
            Your PrepForge identity
          </h1>
          <p className="mt-2 text-sm text-[var(--pf-muted)]">
            Keep your target role current so practice rounds stay relevant.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_1fr]">
          <aside className="rounded-lg border border-[var(--pf-border)] bg-[var(--pf-panel)] p-7 shadow-lg">
            <div className="flex items-center gap-4">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={form.fullName || user?.email || "User avatar"}
                  className="h-20 w-20 rounded-lg object-cover shadow-lg"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-[var(--pf-primary)] text-2xl font-bold text-white">
                  {initials}
                </div>
              )}
              <div>
                <h2 className="text-lg font-semibold text-[var(--pf-text)]">
                  {form.fullName || "PrepForge user"}
                </h2>
                <p className="mt-1 break-all text-sm text-[var(--pf-muted)]">
                  {user?.email}
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-3 border-t border-[var(--pf-border)] pt-5">
              <div>
                <p className="text-xs uppercase tracking-wider text-[var(--pf-muted)]">
                  College
                </p>
                <p className="mt-1 text-sm text-[var(--pf-text-secondary)]">
                  {form.college || "Not added yet"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-[var(--pf-muted)]">
                  Target role
                </p>
                <p className="mt-1 text-sm text-[var(--pf-text-secondary)]">
                  {form.targetRole || "Not selected"}
                </p>
              </div>
            </div>
          </aside>

          <section className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <StatTile
                label="Sessions"
                value={loadingStats ? "..." : stats.total}
                hint="Completed rounds"
              />
              <StatTile
                label="Average"
                value={loadingStats ? "..." : (stats.avgScore ?? "--")}
                hint="Score out of 10"
              />
              <StatTile
                label="Best"
                value={loadingStats ? "..." : (stats.bestScore ?? "--")}
                hint="Highest session"
              />
              <StatTile
                label="Streak"
                value={loadingStats ? "..." : streak.current_streak || 0}
                hint="Active days"
              />
            </div>

            <form
              onSubmit={handleSubmit}
              className="rounded-lg border border-[var(--pf-border)] bg-[var(--pf-panel)] p-7 shadow-lg"
            >
              <h2 className="text-lg font-semibold text-[var(--pf-text)]">
                Edit profile
              </h2>
              <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-[var(--pf-muted)]">
                    Name
                  </span>
                  <input
                    value={form.fullName}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        fullName: event.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-lg border border-[var(--pf-border)] bg-[var(--pf-panel)] px-3 py-2.5 text-sm text-[var(--pf-text)] outline-none transition-colors focus:border-[var(--pf-primary)] focus:ring-4 focus:ring-lavender-300/50"
                    placeholder="Your name"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-[var(--pf-muted)]">
                    College
                  </span>
                  <input
                    value={form.college}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        college: event.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-lg border border-[var(--pf-border)] bg-[var(--pf-panel)] px-3 py-2.5 text-sm text-[var(--pf-text)] outline-none transition-colors focus:border-[var(--pf-primary)] focus:ring-4 focus:ring-lavender-300/50"
                    placeholder="College or university"
                  />
                </label>

                <label className="block md:col-span-2">
                  <span className="text-sm font-medium text-[var(--pf-muted)]">
                    Target role
                  </span>
                  <select
                    value={form.targetRole}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        targetRole: event.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-lg border border-[var(--pf-border)] bg-[var(--pf-panel)] px-3 py-2.5 text-sm text-[var(--pf-text)] outline-none transition-colors focus:border-[var(--pf-primary)] focus:ring-4 focus:ring-lavender-300/50"
                  >
                    {roleOptions.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {error && (
                <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-[var(--pf-danger)]">
                  {error}
                </div>
              )}
              {message && (
                <div className="mt-5 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-[var(--pf-success)]">
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="mt-6 rounded-lg bg-[var(--pf-primary)] px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-[var(--pf-primary-dark)] disabled:cursor-not-allowed disabled:bg-[var(--pf-panel-soft)] disabled:text-[var(--pf-muted)]"
              >
                {saving ? "Saving..." : "Save profile"}
              </button>
            </form>
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default Profile;
