import { supabase } from "../lib/supabase";

function Landing() {
  async function handleGoogleLogin() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin + "/dashboard",
      },
    });
    if (error) {
      console.error("Login error:", error.message);
    }
  }

  return (
    <div
      className="min-h-screen bg-[var(--pf-page)] bg-cover bg-center"
      style={{
        backgroundImage:
          "linear-gradient(90deg, rgba(255,250,253,0.92) 0%, rgba(255,250,253,0.78) 42%, rgba(255,250,253,0.36) 100%), url('/images/prepforge-hero-bg.png')",
      }}
    >
      {/* Navbar */}
      <nav className="flex items-center justify-between px-8 py-6">
        <span className="text-[var(--pf-text)] text-2xl font-extrabold tracking-tight">
          Prep<span className="text-[var(--pf-primary)]">Forge</span>
        </span>
        <button
          onClick={handleGoogleLogin}
          className="bg-[var(--pf-primary)] hover:bg-[var(--pf-primary-dark)] text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors"
        >
          Sign in
        </button>
      </nav>

      {/* Hero */}
      <div className="flex flex-col items-center justify-center text-center px-6 pt-24 pb-20">
        <div className="mb-6 inline-block rounded-full border border-[var(--pf-border)] bg-[var(--pf-primary-light)] px-4 py-1.5 text-sm font-semibold text-[var(--pf-primary)] shadow-lg">
          AI-powered interview practice
        </div>
        <h1 className="max-w-3xl text-5xl font-extrabold leading-tight text-[var(--pf-text)] md:text-6xl">
          Practice interviews like a{" "}
          <span className="text-[var(--pf-primary)]">real candidate</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-8 text-[var(--pf-text-secondary)]">
          AI-driven mock interviews for HR, communication, DSA, DBMS, OS, and
          CN. Get real feedback on content, confidence, and clarity.
        </p>
        <button
          onClick={handleGoogleLogin}
          className="mt-10 rounded-xl bg-[var(--pf-primary)] px-8 py-4 text-lg font-bold text-white shadow-lg shadow-lavender-700/30 transition-colors hover:bg-[var(--pf-primary-dark)]"
        >
          Start Practicing Free →
        </button>
        <p className="text-[var(--pf-muted)] text-sm mt-4">
          No credit card. No signup form. Just Google.
        </p>
      </div>

      {/* Features */}
      <div className="max-w-5xl mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          {
            icon: "🎯",
            title: "AI Follow-up Questions",
            desc: "The AI listens to your answer and asks follow-ups just like a real interviewer would.",
          },
          {
            icon: "🗣️",
            title: "Voice & Speech Analysis",
            desc: "Speak your answers. Get feedback on confidence, clarity, filler words, and pace.",
          },
          {
            icon: "📊",
            title: "Detailed Feedback Scores",
            desc: "Technical score, communication score, and completeness — with exactly what you missed.",
          },
          {
            icon: "📋",
            title: "Bring Your Own Questions",
            desc: "Paste real questions from Glassdoor or prep forums into a saved question bank, and run a full adaptive AI interview from them.",
          },
          {
            icon: "⏱️",
            title: "Real Interview Pressure",
            desc: "A countdown timer per question, calibrated to difficulty, keeps every session honest — no unlimited time to think.",
          },
          {
            icon: "📈",
            title: "Performance Dashboard",
            desc: "Track your progress over time. See your weak areas and watch your scores improve.",
          },
        ].map((f) => (
          <div
            key={f.title}
            className="rounded-xl border border-[var(--pf-border)] bg-white/90 p-7 shadow-lg transition-all hover:-translate-y-0.5 hover:border-[var(--pf-border)]"
          >
            <div className="text-3xl mb-3">{f.icon}</div>
            <h3 className="text-[var(--pf-text)] font-semibold text-lg mb-2">{f.title}</h3>
            <p className="text-[var(--pf-muted)] text-sm leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="text-center text-[var(--pf-muted)] text-sm py-8">
        Built with React, Supabase, and server-side AI feedback
      </div>
    </div>
  );
}

export default Landing;
