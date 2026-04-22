import { Link } from "react-router-dom";
import DashboardLayout from "../components/layout/DashboardLayout";

const banks = [
  {
    title: "Technical Fundamentals",
    description: "DSA, DBMS, OS, and network reasoning for campus interviews.",
    route: "/interview/setup",
    tag: "Technical",
    prompts: [
      "Explain a trade-off between indexing speed and write performance.",
      "Walk through how you would reason about a deadlock scenario.",
      "Compare TCP and UDP for a latency-sensitive product feature.",
    ],
  },
  {
    title: "HR and Behavioural",
    description: "STAR-style evidence, ownership, conflict, and role-fit answers.",
    route: "/interview/setup",
    tag: "HR",
    prompts: [
      "Tell me about a time you changed your approach after feedback.",
      "Describe a conflict where you had to protect the outcome and the relationship.",
      "Walk me through a project decision you would make differently now.",
    ],
  },
  {
    title: "Communication Practice",
    description: "Short speaking drills for clarity, structure, and confidence.",
    route: "/interview/setup",
    tag: "Speaking",
    prompts: [
      "Explain caching to a non-technical teammate.",
      "Argue for or against remote internships in under two minutes.",
      "Structure a response to a vague stakeholder request.",
    ],
  },
];

function Questions() {
  return (
    <DashboardLayout>
      <div className="px-8 py-8">
        <div className="mb-8 max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-blue-400">
            Question Bank
          </p>
          <h1 className="mt-2 text-2xl font-bold text-white">
            Practice from focused interview tracks
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Use these sample prompts to warm up, then start a timed AI session
            when you want full feedback and follow-ups.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {banks.map((bank) => (
            <section
              key={bank.title}
              className="rounded-lg border border-slate-800 bg-slate-900 p-5"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-white">
                  {bank.title}
                </h2>
                <span className="rounded-full border border-blue-800 bg-blue-950 px-2.5 py-1 text-xs font-medium text-blue-300">
                  {bank.tag}
                </span>
              </div>
              <p className="mb-5 text-sm leading-6 text-slate-400">
                {bank.description}
              </p>
              <div className="space-y-3">
                {bank.prompts.map((prompt, index) => (
                  <div
                    key={prompt}
                    className="rounded-lg border border-slate-800 bg-slate-950 p-3"
                  >
                    <p className="text-xs font-medium text-slate-500">
                      Prompt {index + 1}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-300">
                      {prompt}
                    </p>
                  </div>
                ))}
              </div>
              <Link
                to={bank.route}
                className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"
              >
                Start an AI round
              </Link>
            </section>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}

export default Questions;
