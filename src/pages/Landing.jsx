import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

function Landing() {
  const navigate = useNavigate();

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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-8 py-5">
        <span className="text-white text-2xl font-bold tracking-tight">
          Prep<span className="text-blue-400">AI</span>
        </span>
        <button
          onClick={handleGoogleLogin}
          className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Sign in
        </button>
      </nav>

      {/* Hero */}
      <div className="flex flex-col items-center justify-center text-center px-6 pt-24 pb-16">
        <div className="inline-block bg-blue-900/40 border border-blue-700/50 text-blue-300 text-sm px-4 py-1.5 rounded-full mb-6">
          AI-Powered Interview Practice
        </div>
        <h1 className="text-5xl md:text-6xl font-bold text-white leading-tight max-w-3xl">
          Practice interviews like a{" "}
          <span className="text-blue-400">real candidate</span>
        </h1>
        <p className="text-slate-400 text-lg mt-6 max-w-xl">
          AI-driven mock interviews for HR, communication, DSA, DBMS, OS, and
          CN. Get real feedback on content, confidence, and clarity.
        </p>
        <button
          onClick={handleGoogleLogin}
          className="mt-10 bg-blue-600 hover:bg-blue-500 text-white text-lg font-semibold px-8 py-4 rounded-xl transition-colors shadow-lg shadow-blue-900/40"
        >
          Start Practicing Free →
        </button>
        <p className="text-slate-500 text-sm mt-4">
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
            icon: "💻",
            title: "Code Editor for DSA",
            desc: "Write actual code for DSA questions. AI reviews your logic and time complexity.",
          },
          {
            icon: "📄",
            title: "Resume-Based Questions",
            desc: "Upload your resume and get questions tailored to your own projects and skills.",
          },
          {
            icon: "📈",
            title: "Performance Dashboard",
            desc: "Track your progress over time. See your weak areas and watch your scores improve.",
          },
        ].map((f) => (
          <div
            key={f.title}
            className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 hover:border-blue-700/50 transition-colors"
          >
            <div className="text-3xl mb-3">{f.icon}</div>
            <h3 className="text-white font-semibold text-lg mb-2">{f.title}</h3>
            <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="text-center text-slate-600 text-sm py-8">
        Built with React · Supabase · Google Gemini
      </div>
    </div>
  );
}

export default Landing;
