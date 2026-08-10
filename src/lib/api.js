import { supabase } from "./supabase";

const QUESTION_COUNT_BY_RANGE = {
  short: 4,
  standard: 7,
  extended: 10,
};

const DIFFICULTY_LABELS = {
  easy: "fresher level (no work experience)",
  medium: "internship level (some projects or internships)",
  hard: "placement level (top product companies)",
};

const TECHNICAL_SUBJECT_GUIDANCE = {
  dsa: "data structures, algorithms, complexity analysis, edge cases, and trade-offs",
  dbms: "schema design, normalization, indexing, SQL reasoning, transactions, and concurrency",
  os: "processes, threads, memory, scheduling, synchronization, deadlocks, and system behaviour",
  cn: "network layers, TCP/IP, HTTP, latency, reliability, routing, and protocol trade-offs",
  general:
    "balanced computer science fundamentals spanning problem solving, systems, databases, and networking",
};

const SCENARIO_FLAVORS = [
  "a fast-moving early-stage startup",
  "a large enterprise with many stakeholders and approval layers",
  "a fully remote, distributed team across time zones",
  "a client-facing consulting or agency engagement",
  "a product still finding market fit, with fast-changing requirements",
  "a team recovering from a recent reorg or leadership change",
  "a high-stakes production incident under time pressure",
  "a cross-functional project involving design, product, and engineering",
  "an open-source or community-driven codebase",
  "a tight, time-boxed sprint or hackathon setting",
];

function pickScenarioFlavors(count = 2) {
  const shuffled = [...SCENARIO_FLAVORS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

const DIFFICULTY_PROGRESSIONS = {
  easy: "start with straightforward fundamentals, then move into applied reasoning, and end with slightly tougher follow-ups or scenario-based questions",
  medium:
    "start with solid fundamentals, then move into applied interview problems, and end with deeper trade-offs, debugging, or design judgement",
  hard: "start at a strong interview baseline, then increase into multi-step reasoning, optimization, edge cases, and senior-level trade-off discussion",
};

const MODE_CONFIG = {
  hr: {
    interviewer: "senior HR interviewer",
    focus:
      "behavioural and situational HR questioning around teamwork, conflict, ownership, leadership, adaptability, judgement, and role fit",
    interviewerIntent:
      "test how the candidate behaves in realistic workplace situations and whether they show reflection, maturity, and role fit",
    questionMix: [
      "behavioural deep-dives",
      "situational judgement",
      "stakeholder management",
      "motivation and role fit",
    ],
    followUpFocus:
      "Ask a sharper HR follow-up that probes evidence, decisions, stakeholder handling, reflection, ownership, or impact from the candidate's answer.",
    scoringFocus:
      "Judge the candidate on role fit, self-awareness, professionalism, clarity, behavioural depth, judgement, and specificity of examples.",
  },
  communication: {
    interviewer: "senior communication coach and interviewer",
    focus:
      "communication interview prompts that test clarity, structure, fluency, audience awareness, persuasion, and concise explanation",
    interviewerIntent:
      "stress-test how clearly the candidate thinks aloud, organizes ideas, and adapts their message to the listener",
    questionMix: [
      "impromptu thinking",
      "structured example-based answers",
      "explain-it-simply prompts",
      "stakeholder communication scenarios",
    ],
    followUpFocus:
      "Ask a follow-up that targets the biggest communication weakness in the answer, such as weak structure, vague reasoning, shallow examples, or audience mismatch.",
    scoringFocus:
      "Judge the candidate on clarity, structure, fluency, depth, relevance, confidence, audience awareness, and completeness.",
  },
  custom: {
    interviewer: "senior interview coach",
    focus: (subjectInput) =>
      `user-provided custom interview questions from ${formatSubjectList(
        subjectInput,
        "a custom question bank",
      )}`,
    interviewerIntent:
      "use the user's saved question bank as the primary interview source while probing the candidate's reasoning, specificity, and communication quality",
    questionMix: [
      "user-provided prompts",
      "answer-specific probing",
      "depth checks",
      "realistic interview judgement",
    ],
    followUpFocus:
      "Ask a sharp follow-up grounded in the custom question and the candidate's answer, probing the biggest gap, assumption, missing example, or weak reasoning.",
    scoringFocus:
      "Judge the candidate on answer quality, reasoning depth, relevance to the custom prompt, communication, and completeness.",
  },
  technical: {
    interviewer: "senior technical interviewer",
    focus: (subjectInput) =>
      `technical interview questions for ${formatSubjectList(subjectInput, "general computer science")} covering core concepts, applied reasoning, trade-offs, and realistic problem solving`,
    interviewerIntent:
      "probe technical understanding progressively, starting with foundations and moving toward applied reasoning, depth, and decision-making",
    questionMix: [
      "conceptual understanding",
      "applied reasoning",
      "debugging and edge cases",
      "real interview scenarios",
    ],
    followUpFocus:
      "Ask a technical follow-up that probes the most important missing concept, edge case, trade-off, optimization, or real-world implication.",
    scoringFocus:
      "Judge the candidate on correctness, technical depth, reasoning quality, communication, and completeness.",
  },
};

function normalizeSubjectInput(subjectInput) {
  const rawItems = Array.isArray(subjectInput)
    ? subjectInput
    : typeof subjectInput === "string"
      ? subjectInput.split(",")
      : [];

  const seen = new Set();

  return rawItems
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function formatSubjectList(
  subjectInput,
  fallback = "General Computer Science",
) {
  const subjects = normalizeSubjectInput(subjectInput);

  if (subjects.length === 0) {
    return fallback;
  }

  return subjects.map((item) => humanizeId(item)).join(", ");
}

function buildSubjectCoveragePlan(subjectInput, questionCount) {
  const subjects = normalizeSubjectInput(subjectInput);
  const plannedSubjects = subjects.length > 0 ? subjects : ["general"];
  const baseCount = Math.floor(questionCount / plannedSubjects.length);
  let remainder = questionCount % plannedSubjects.length;

  return plannedSubjects.map((subject) => {
    const count = baseCount + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;

    return {
      id: subject,
      label: humanizeId(subject, "General Computer Science"),
      guidance:
        TECHNICAL_SUBJECT_GUIDANCE[subject] ||
        TECHNICAL_SUBJECT_GUIDANCE.general,
      count,
    };
  });
}

function buildSubjectSequence(coveragePlan) {
  const remaining = coveragePlan.map((item) => ({ ...item }));
  const sequence = [];

  while (remaining.some((item) => item.count > 0)) {
    for (const item of remaining) {
      if (item.count > 0) {
        sequence.push(item.label);
        item.count -= 1;
      }
    }
  }

  return sequence;
}

function getModeConfig(mode, subjectInput) {
  const config = MODE_CONFIG[mode] || MODE_CONFIG.technical;

  return {
    ...config,
    focus:
      typeof config.focus === "function"
        ? config.focus(subjectInput)
        : config.focus,
  };
}

function humanizeId(value, fallback = "General") {
  if (!value) return fallback;

  const specialLabels = {
    hr: "HR",
    dsa: "DSA",
    dbms: "DBMS",
    os: "Operating Systems",
    cn: "Computer Networks",
    general: "General Mix",
    custom: "Custom Questions",
  };

  if (specialLabels[value]) {
    return specialLabels[value];
  }

  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function extractJsonBlock(text) {
  if (!text) {
    throw new Error("Model returned an empty response.");
  }

  const cleaned = text
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  const arrayStart = cleaned.indexOf("[");
  const objectStart = cleaned.indexOf("{");

  if (arrayStart === -1 && objectStart === -1) {
    throw new Error("No JSON found in model response.");
  }

  if (arrayStart !== -1 && (objectStart === -1 || arrayStart < objectStart)) {
    return cleaned.slice(arrayStart, cleaned.lastIndexOf("]") + 1);
  }

  return cleaned.slice(objectStart, cleaned.lastIndexOf("}") + 1);
}

function clampScore(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(10, Math.round(numeric)));
}

function normalizeCommunicationScores(value) {
  const scoreObject =
    value && typeof value === "object"
      ? value
      : {
          clarity: 0,
          structure: 0,
          fluency: 0,
          depth: 0,
          relevance: 0,
        };

  return {
    clarity: clampScore(scoreObject.clarity),
    structure: clampScore(scoreObject.structure),
    fluency: clampScore(scoreObject.fluency),
    depth: clampScore(scoreObject.depth),
    relevance: clampScore(scoreObject.relevance),
  };
}

function toStringArray(value, fallback, targetLength = 3) {
  const items = Array.isArray(value)
    ? value
        .filter(Boolean)
        .map((item) => String(item).trim())
        .filter(Boolean)
    : [];

  while (items.length < targetLength) {
    items.push(fallback);
  }

  return items.slice(0, targetLength);
}

function normalizeQuestionText(value) {
  return String(value || "")
    .replace(/^\s*[-*•\d]+[.)\s-]*/u, "")
    .replace(/^"(.*)"$/, "$1")
    .trim();
}

function questionDedupKey(question) {
  return question
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function inferCommunicationEvalMode(question, selectedMode) {
  if (selectedMode) {
    return selectedMode;
  }

  const text = String(question || "").toLowerCase();

  if (
    /\b(explain|teach|describe .* to|non-technical|beginner|simple terms|simplify)\b/.test(
      text,
    )
  ) {
    return "explain";
  }

  if (
    /\b(tell me about a time|describe a time|give me an example|walk me through|situation|conflict|challenge|failure|feedback|leadership|project|deadline|stakeholder)\b/.test(
      text,
    )
  ) {
    return "structured";
  }

  return "impromptu";
}

function toStringArrayNoPad(value, fallback) {
  const items = Array.isArray(value)
    ? value
        .filter(Boolean)
        .map((item) => String(item).trim())
        .filter(Boolean)
    : [];

  return items.length > 0 ? items : [fallback];
}

function normalizeCommunicationEvaluation(data) {
  const missedPoints = Array.isArray(data?.missedPoints)
    ? data.missedPoints
        .filter(Boolean)
        .map((item) => String(item).trim())
        .filter(Boolean)
    : [];

  return {
    scores: normalizeCommunicationScores(data?.scores),
    summary:
      String(data?.summary || "").trim() ||
      "The answer was evaluated, but the summary was incomplete.",
    whatWentWell: toStringArrayNoPad(
      data?.whatWentWell,
      "The answer had a useful core idea, but it needed stronger execution.",
    ),
    issues: toStringArrayNoPad(
      data?.issues,
      "The answer needed clearer structure, sharper language, and better focus.",
    ),
    missedPoints,
    improvedAnswer:
      String(data?.improvedAnswer || "").trim() ||
      "The answer needed a stronger, clearer rewrite.",
  };
}

function averageScore(values) {
  const valid = values.filter((value) => Number.isFinite(value));
  if (valid.length === 0) return 0;
  return clampScore(
    valid.reduce((sum, value) => sum + value, 0) / valid.length,
  );
}

function getWeakestCommunicationAreas(scores) {
  return Object.entries(scores)
    .sort((a, b) => a[1] - b[1])
    .map(([key]) => key);
}

function createCommunicationStudySuggestion(area) {
  const suggestions = {
    clarity:
      "Open with your main point first, then expand instead of discovering the answer mid-sentence.",
    structure:
      "Use a simple framework before you speak, such as opening, 2 key points, and conclusion.",
    fluency:
      "Practice 60-second recordings to remove fillers and make your delivery steadier under pressure.",
    depth:
      "Support each answer with a specific example, decision, or insight instead of staying at a surface level.",
    relevance:
      "Pause, identify the exact ask, and make sure every point directly answers that question.",
  };

  return suggestions[area] || suggestions.structure;
}

function summarizeCommunicationPerformance(averageScores) {
  const entries = Object.entries(averageScores).sort((a, b) => b[1] - a[1]);
  const strongest = entries[0];
  const weakest = entries[entries.length - 1];

  if (!strongest || !weakest || strongest[0] === weakest[0]) {
    return "The communication round was evaluated. Focus on building clearer structure and more deliberate phrasing to sound interview-ready.";
  }

  return `Your strongest area was ${strongest[0]} (${strongest[1]}/10), while ${weakest[0]} (${weakest[1]}/10) was the main gap. The answers showed usable ideas, but they still need tighter delivery, better structure, and more deliberate phrasing to sound interview-ready.`;
}

function buildSpeechMetricsHint(item) {
  if (!item?.wasSpoken) return "";
  const filler = item.fillerWords || { um: 0, uh: 0, like: 0 };
  const total = (filler.um || 0) + (filler.uh || 0) + (filler.like || 0);
  return `\nMeasured speech data: ${item.wordsPerMinute || 0} words/min, ${total} filler words (um: ${filler.um || 0}, uh: ${filler.uh || 0}, like: ${filler.like || 0}).`;
}

async function evaluateCommunicationSession(sessionData, communicationMode) {
  const qaBlocks = sessionData
    .map((item, i) => {
      if (item?.skipped) {
        return `[ITEM_ID: ${i}]\nQ${i + 1}: ${item.question}\nA${i + 1}: [Skipped — no answer given]`;
      }
      const inferredMode = inferCommunicationEvalMode(
        item.question,
        communicationMode,
      );
      return `[ITEM_ID: ${i}]\nQ${i + 1}: ${item.question}\nMode: ${inferredMode}\nA${i + 1}: ${item.answer}${buildSpeechMetricsHint(item)}`;
    })
    .join("\n\n");

  const prompt = `
You are a senior communication coach reviewing a full mock interview with ${sessionData.length} questions, all at once.

${qaBlocks}

EVALUATION RULES:
- Be strict and realistic. Do not give generic praise without justification.
- Score each answer 0-10 (integers) on: clarity, structure, fluency, depth, relevance.
- A question marked "[Skipped — no answer given]" must score 0 on every dimension.
- Ground every piece of feedback in specifics from THAT answer — quote or closely
  paraphrase an actual phrase, example, or moment the candidate actually said.
  Never use a bare generic label like "filled with filler words and repetition" on
  its own — say what was actually repeated, or which specific sentence lacked structure.
- If real measured speech data (words/min, filler word counts) is given for a question,
  use those exact numbers in your feedback instead of guessing from the text.
- If the SAME underlying problem (e.g. heavy filler word usage) shows up in more than
  one answer, say so explicitly ONCE as a pattern across the session (e.g. "this is the
  second answer in a row with heavy filler word use") instead of repeating the same
  generic sentence on every question as if it were new each time.
- issues must ONLY cover delivery problems (filler words, structure, pacing, clarity of
  phrasing) — never content gaps. Content gaps go in missedPoints instead, described below.
- missedPoints is a SEPARATE category: 2-4 specific, substantive points, examples,
  considerations, or angles relevant to THIS SPECIFIC QUESTION'S TOPIC that the candidate
  did not mention but should have to make the answer stronger. This is about WHAT was said,
  not HOW it was said. Ground this in real subject-matter reasoning about the question
  itself. If the answer already covered the obvious points well, name a more advanced or
  nuanced angle instead — there is almost always a next-level point to add.
- FORBIDDEN missedPoints phrasing — NEVER write meta-instructions telling the candidate to
  add something without naming the actual thing. Banned patterns include: "a specific
  example of...", "the steps they would take to...", "more details about...", "the outcome
  of the situation", "add more detail". If you catch yourself writing one of these, STOP
  and replace it with the actual concrete point, named directly, as if you were answering
  the question yourself.
- GOLD STANDARD EXAMPLE — calibrate your depth and specificity to match this bar:
  Question: "Tell me about a time you showed leadership without being asked."
  Weak missedPoint (BANNED STYLE): "A specific example of when they showed leadership."
  Strong missedPoint (REQUIRED STYLE): "You could have named the actual friction you
  solved — e.g. two teams duplicating work because nobody owned a shared status update —
  and quantified the fix, like 'cut repeated bugs by half' or 'saved the team roughly
  X hours a week', since concrete numbers are what separate a generic leadership story
  from a memorable one."
  A correspondingly strong improvedAnswer for that question reads like a real, complete,
  interview-ready answer with a real named problem, real actions taken, and a real
  measurable outcome — not a one-sentence summary of what a good answer would contain.
- For each answer, rewrite it into a high-quality improved version with real substance,
  not a short summary. ${sessionData.length > 6 ? "This session has many questions — keep each rewrite focused (roughly 3-4 sentences) rather than maximally long, since consistent depth across all questions matters more than maximum length on any one." : "Several sentences is appropriate here."} Keep the same core idea, fix
  structure/grammar/clarity, remove fillers and repetition, confident and natural tone —
  AND naturally weave in the missedPoints you identified, so the improved answer actually
  demonstrates the depth and completeness a strong candidate would give, the way an
  experienced interview coach would model the answer for a student, not a placeholder
  description of what a good answer would contain.

YOUR OUTPUT MUST BE JSON ONLY, in this exact shape:
{
  "perQuestion": [
    {
      "questionIndex": 0,
      "scores": { "clarity": 0, "structure": 0, "fluency": 0, "depth": 0, "relevance": 0 },
      "whatWentWell": ["specific point", "specific point"],
      "issues": ["specific delivery point", "specific delivery point"],
      "missedPoints": ["specific content point", "specific content point"],
      "improvedAnswer": ""
    }
  ],
  "overallSummary": ""
}
perQuestion must have exactly ${sessionData.length} items. Each Q/A pair above starts
with a tag like [ITEM_ID: 3] — copy that exact number into questionIndex for the item
describing that answer; do not infer position yourself. Before finalizing, walk through
every [ITEM_ID: N] tag in order and confirm you produced exactly one entry per ID with
matching content. overallSummary should synthesize the whole session in 2-3 sentences,
naming any pattern that repeated across multiple answers.

NO markdown. NO explanation outside JSON. RETURN ONLY JSON.
`;

  const feedbackTokenBudget = 1200 + sessionData.length * 400;
  const parsed = await callGroqForJson(prompt, 0.3, feedbackTokenBudget);
  const rawItems = Array.isArray(parsed?.perQuestion) ? parsed.perQuestion : [];
  const rawByIndex = buildIndexedFeedbackMap(rawItems, sessionData.length);

  const evaluations = sessionData.map((item, index) => {
    if (item?.skipped) {
      return {
        scores: {
          clarity: 0,
          structure: 0,
          fluency: 0,
          depth: 0,
          relevance: 0,
        },
        summary:
          "The question was skipped, so there was no answer to evaluate.",
        whatWentWell: ["No strengths to highlight — the question was skipped."],
        issues: [
          "The answer was skipped.",
          "No structure, depth, or relevance could be assessed.",
          "A complete response is required for interview evaluation.",
        ],
        missedPoints: [],
        improvedAnswer:
          "This question needs a complete spoken answer before it can be improved.",
      };
    }
    return normalizeCommunicationEvaluation(
      rawByIndex.get(index) || rawItems[index],
    );
  });

  return {
    evaluations,
    overallSummary: String(parsed?.overallSummary || "").trim(),
  };
}

function validateQuestionSet(parsed, questionCount) {
  const rawQuestions = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.questions)
      ? parsed.questions
      : [];

  if (rawQuestions.length !== questionCount) {
    return {
      isValid: false,
      questions: [],
      reason: `Expected ${questionCount} questions but received ${rawQuestions.length}.`,
    };
  }

  const cleanedQuestions = rawQuestions.map(normalizeQuestionText);

  if (cleanedQuestions.some((question) => question.length === 0)) {
    return {
      isValid: false,
      questions: [],
      reason: "One or more questions were empty after cleanup.",
    };
  }

  const seen = new Set();
  for (const question of cleanedQuestions) {
    const key = questionDedupKey(question);
    if (seen.has(key)) {
      return {
        isValid: false,
        questions: [],
        reason: "Duplicate questions detected in model output.",
      };
    }
    seen.add(key);
  }

  return {
    isValid: true,
    questions: cleanedQuestions,
    reason: "",
  };
}

function buildIndexedFeedbackMap(rawItems, expectedCount) {
  const byIndex = new Map();
  rawItems.forEach((item, position) => {
    const reportedIndex = Number.isInteger(item?.questionIndex)
      ? item.questionIndex
      : position;
    if (
      reportedIndex >= 0 &&
      reportedIndex < expectedCount &&
      !byIndex.has(reportedIndex)
    ) {
      byIndex.set(reportedIndex, item);
    }
  });

  // Fill any gaps individually using the item at that array position, instead
  // of discarding ID-based matching for the WHOLE response just because one
  // slot's questionIndex was missing, duplicated, or out of range.
  for (let i = 0; i < expectedCount; i += 1) {
    if (!byIndex.has(i) && rawItems[i]) {
      byIndex.set(i, rawItems[i]);
    }
  }

  return byIndex;
}

function normalizeFeedback(data, questionCount) {
  const rawPerQuestion = Array.isArray(data?.perQuestion)
    ? data.perQuestion
    : [];
  const byIndex = buildIndexedFeedbackMap(rawPerQuestion, questionCount);

  return {
    overallTechScore: clampScore(data?.overallTechScore),
    overallCommScore: clampScore(data?.overallCommScore),
    overallCompletenessScore: clampScore(data?.overallCompletenessScore),
    summary:
      String(data?.summary || "").trim() ||
      "Your interview was reviewed, but the summary was incomplete.",
    whatWentWell: toStringArray(
      data?.whatWentWell,
      "Provide stronger, specific examples to highlight your strengths.",
    ),
    areasToImprove: toStringArray(
      data?.areasToImprove,
      "Add more detail and structure to improve answer quality.",
    ),
    studySuggestions: toStringArray(
      data?.studySuggestions,
      "Practice timed mock interviews and review your weaker areas.",
    ),
    perQuestion: Array.from({ length: questionCount }, (_, index) => {
      const item = byIndex.get(index) || rawPerQuestion[index] || {};
      const fillerWords =
        item?.fillerWords && typeof item.fillerWords === "object"
          ? item.fillerWords
          : {};

      const missedPoints = Array.isArray(item?.missedPoints)
        ? item.missedPoints
            .filter(Boolean)
            .map((point) => String(point).trim())
            .filter(Boolean)
        : [];

      return {
        questionIndex: Number.isInteger(item?.questionIndex)
          ? item.questionIndex
          : index,
        techScore: clampScore(item?.techScore),
        commScore: clampScore(item?.commScore),
        completenessScore: clampScore(item?.completenessScore),
        scores: normalizeCommunicationScores(item?.scores),
        whatWentWell: String(item?.whatWentWell || "").trim(),
        whatWasMissed: String(item?.whatWasMissed || "").trim(),
        missedPoints,
        idealAnswer: String(item?.idealAnswer || "").trim(),
        fillerWords: {
          um: Number(fillerWords.um) || 0,
          uh: Number(fillerWords.uh) || 0,
          like: Number(fillerWords.like) || 0,
        },
      };
    }),
  };
}

function attachSpeechMetrics(feedback, sessionData) {
  return {
    ...feedback,
    perQuestion: feedback.perQuestion.map((item, index) => {
      const source = sessionData?.[index];
      const hasRealMetrics = Boolean(source?.wasSpoken && source?.fillerWords);

      return {
        ...item,
        wasSpoken: Boolean(source?.wasSpoken),
        fillerWords: hasRealMetrics ? source.fillerWords : null,
        wordsPerMinute: hasRealMetrics ? (source.wordsPerMinute ?? null) : null,
      };
    }),
  };
}

async function callGroq(
  prompt,
  temperature = 0.7,
  maxTokens = 2048,
  retries = 3,
) {
  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Please sign in again before using AI features.");
      }

      const res = await fetch("/api/ai", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          temperature,
          maxTokens,
          prompt,
        }),
      });

      clearTimeout(timeout);

      if (res.status === 429 || res.status === 503) {
        if (import.meta.env.DEV) {
          console.log(
            `Groq ${res.status}. Waiting 15s before retry ${i + 1}/${retries}...`,
          );
        }
        await new Promise((resolve) => setTimeout(resolve, 15000));
        continue;
      }

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(
          err?.error || `AI request failed with status ${res.status}.`,
        );
      }

      const data = await res.json();
      return data.content;
    } catch (err) {
      if (err.name === "AbortError") {
        if (import.meta.env.DEV) {
          console.log(`Groq timed out. Retrying ${i + 1}/${retries}...`);
        }
        if (i === retries - 1) {
          throw new Error(
            "Request timed out after 3 attempts. Please try again.",
          );
        }
        await new Promise((resolve) => setTimeout(resolve, 5000));
        continue;
      }

      if (i === retries - 1) throw err;
      if (import.meta.env.DEV) {
        console.log(`Groq call failed. Retrying ${i + 1}/${retries}...`);
      }
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  throw new Error(
    "RATE_LIMITED: Groq's usage limit was reached after 3 attempts. Please wait a few minutes before trying again.",
  );
}

// Feedback responses are large JSON objects (per-question scores, missed points,
// full rewritten answers, across up to 10 questions) and can occasionally come
// back truncated or malformed. Retry with a larger token budget rather than
// surfacing a parse error to the user on the first hiccup.
async function callGroqForJson(
  prompt,
  temperature,
  baseMaxTokens,
  retries = 1,
) {
  // IMPORTANT: callGroq() already retries internally (up to 3x) on rate limits
  // and timeouts. Retrying that whole call again here on top of it multiplies
  // total network requests fast (each JSON-retry attempt can itself trigger
  // several network-level retries) — which can trigger the very rate limits
  // this is trying to recover from. Keep `retries` small (1 extra attempt max).
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const attemptTokens = baseMaxTokens + attempt * 600;
    const text = await callGroq(prompt, temperature, attemptTokens);

    try {
      return JSON.parse(extractJsonBlock(text));
    } catch (err) {
      lastError = err;
      if (import.meta.env.DEV) {
        console.log(
          `Feedback JSON parse failed (attempt ${attempt + 1}/${retries + 1}): ${err.message}. Retrying with a slightly larger token budget...`,
        );
      }
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  }

  throw new Error(
    `The AI response could not be parsed after ${retries + 1} attempts (${lastError?.message || "unknown error"}). Please try again in a moment.`,
  );
}

export async function generateQuestions(
  mode,
  subjectInput,
  difficulty,
  role,
  questionRange,
  communicationMode,
) {
  const questionCount = QUESTION_COUNT_BY_RANGE[questionRange] || 7;
  const difficultyLabel =
    DIFFICULTY_LABELS[difficulty] || DIFFICULTY_LABELS.medium;
  const modeConfig = getModeConfig(mode, subjectInput);
  const roleLabel = humanizeId(role, "Candidate");
  const difficultyProgression =
    DIFFICULTY_PROGRESSIONS[difficulty] || DIFFICULTY_PROGRESSIONS.medium;
  const selectedSubjects = normalizeSubjectInput(subjectInput);
  const subjectLabel =
    mode === "technical"
      ? formatSubjectList(subjectInput, "General Computer Science")
      : "General";
  const communicationModeLabel =
    mode === "communication"
      ? humanizeId(communicationMode, "Impromptu")
      : null;
  const technicalCoveragePlan = buildSubjectCoveragePlan(
    selectedSubjects,
    questionCount,
  );
  const technicalCoverageText = technicalCoveragePlan
    .map((item) => `${item.label}: ${item.count}`)
    .join(", ");
  const technicalSequence = buildSubjectSequence(technicalCoveragePlan)
    .map((item, index) => `Q${index + 1} ${item}`)
    .join(" | ");
  const technicalGuidance = technicalCoveragePlan
    .map((item) => `- ${item.label}: ${item.guidance}`)
    .join("\n");
  const scenarioFlavors = pickScenarioFlavors(2);
  const additionalRules =
    mode === "technical"
      ? `- Cover ALL selected subjects: ${subjectLabel}
    - Balanced coverage target: ${technicalCoverageText}
    - Interleave subjects naturally. Do not cluster the whole interview around one subject.
    - Aim for this broad interview flow: ${technicalSequence}
    - Increase difficulty across the whole set, not separately within each subject.
    - Keep every question explicitly technical, role-aware, and realistic for ${roleLabel}.
    - DO NOT ask questions that require writing or running code (no "write a function", no "implement this algorithm", no "code this").
    - SQL query questions are allowed (e.g. write a SELECT query) but do NOT ask candidates to design a full database schema from scratch.
    - Focus on conceptual understanding, reasoning, trade-offs, and applied problem-solving instead.
    - Subject guidance:
${technicalGuidance}`
      : mode === "hr"
        ? `- Behave like a real HR interviewer hiring for ${roleLabel}.
    - Ask behavioural and situational questions that naturally require STAR-style answers.
    - Include situational judgement, behavioural depth, probing follow-through, and role-fit assessment across the set.
    - Force specificity: decisions made, constraints, stakeholders, trade-offs, conflict handling, accountability, and measurable impact.
    - Keep the HR round clearly role-aware. The expectations for ${roleLabel} should shape the scenarios.
    - Do NOT ask DSA, algorithms, coding, system design, DBMS, OS, or networking questions.`
        : `You are a senior communication coach designing high-quality speaking exercises for interview preparation.

Your goal is to generate tasks that FORCE the user to think clearly, structure ideas, and speak confidently under pressure.

COMMUNICATION MODE:
${communicationMode}

Modes:
1. impromptu
2. structured
3. explain

TASK REQUIREMENTS:
- You must generate EXACTLY ${questionCount} tasks.
- Each task must follow STRICT patterns depending on the mode.

MODE 1 - IMPROMPTU:
- Generate topics that require opinion, reasoning, or explanation.
- They cannot be answered with yes/no.
- They should force the user to speak for 1-2 minutes.
- Do NOT generate factual questions or definition-based questions.

MODE 2 - STRUCTURED:
- Generate behavioural questions that REQUIRE structured answers.
- Each question must involve a real-life scenario.
- Each question must require Situation -> Task -> Action -> Result thinking.
- Do NOT generate generic self-promotion questions like strengths or why should we hire you.

MODE 3 - EXPLAIN:
- Generate concepts that require explanation in simple language.
- Test teaching ability and clarity for non-experts.
- Do NOT generate dry definition prompts.

GLOBAL RULES:
- Questions MUST be clear and natural.
- Avoid generic phrasing.
- Avoid repetition.
- Keep language realistic and interview-level.
- Ensure variety across tasks.
- Keep each task concise but meaningful.
- No role framing is needed for communication mode.
`;

  const prompt = `
You are a ${modeConfig.interviewer} at a top company.

Interview Context:
- Interview Type: ${humanizeId(mode)}
- Subject Coverage: ${subjectLabel}
- Communication Mode: ${communicationModeLabel || "N/A"}
- Role: ${mode === "communication" ? "N/A" : roleLabel}
- Difficulty: ${difficultyLabel}
- Number of Questions: ${questionCount}
- Focus Area: ${modeConfig.focus}
- Interviewer Intent: ${modeConfig.interviewerIntent}

Your task:
Generate a realistic, progressive interview question set that feels like a real interviewer is guiding the round.

Scenario grounding for this specific session (use this to keep questions fresh and
avoid falling back on the same well-worn examples every time): lean toward scenarios
set in the context of ${scenarioFlavors.join(" or ")}.

Rules:
- Generate EXACTLY ${questionCount} questions.
- Vary the concrete scenario, company context, and specific situation every session —
  do not default to the most commonly seen interview clichés verbatim (e.g. don't
  always default to the exact same disagreement-with-a-manager or biggest-weakness
  phrasing). The underlying skill being tested can repeat across sessions, but the
  specific scenario, wording, and details must feel fresh each time.
- Questions MUST follow this progression: ${difficultyProgression}
- Questions MUST be relevant to the target role (${roleLabel}) unless the interview type is communication.
- Every question must be specific, non-generic, and interview-realistic.
- Avoid vague prompts, repetition, duplicate concepts, and beginner fluff unless the difficulty requires it.
- Questions should feel like a coherent interview, not a random list.
- Use this mix where appropriate: ${modeConfig.questionMix.join(", ")}
${additionalRules}

STRICT OUTPUT:
- Return ONLY a valid JSON array of strings.
- No explanation.
- No numbering.
- No markdown.
- No extra keys.
`;

  let lastError = "Model did not return a valid question set.";

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const temperature = [0.7, 0.5, 0.3][attempt] || 0.3;
    const text = await callGroq(prompt, temperature, 1400);
    const parsed = JSON.parse(extractJsonBlock(text));
    const validation = validateQuestionSet(parsed, questionCount);

    if (validation.isValid) {
      return validation.questions;
    }

    lastError = validation.reason;
  }

  throw new Error(`Question validation failed: ${lastError}`);
}

export async function generateFollowUp(
  question,
  answer,
  role,
  mode,
  subjectInput,
  communicationMode,
) {
  const modeConfig = getModeConfig(mode, subjectInput);
  const roleLabel = humanizeId(role, "Candidate");
  const subjectLabel =
    mode === "technical"
      ? formatSubjectList(subjectInput, "General Computer Science")
      : mode === "custom"
        ? formatSubjectList(subjectInput, "Custom Question Bank")
        : "General";
  const communicationModeLabel =
    mode === "communication"
      ? humanizeId(communicationMode, "Impromptu")
      : null;

  const prompt = `
You are a senior ${modeConfig.interviewer} conducting a real interview for a ${roleLabel} candidate.

Your job is NOT to automatically generate a follow-up after every answer.

Your job is to decide whether this answer genuinely requires a follow-up, and only
generate one when doing so would meaningfully assess the candidate further.

Interview Context:
- Interview Type: ${humanizeId(mode)}
- Subject Coverage: ${subjectLabel}
- Communication Mode: ${communicationModeLabel || "N/A"}
- Role: ${roleLabel}
- Primary Focus: ${modeConfig.focus}
- Interviewer Intent: ${modeConfig.interviewerIntent}

Original Question:
${question}

Candidate Answer:
${answer || "[No answer given]"}

STEP 1 — DECIDE WHETHER A FOLLOW-UP IS WARRANTED

A follow-up IS warranted when the candidate's answer contains a meaningful unresolved
point such as:

- a technically incorrect or questionable claim
- shallow reasoning that needs to be tested
- an important missing concept
- an unsupported claim
- an unexplained decision or assumption
- a missing trade-off
- a missing edge case or limitation
- a vague statement that needs clarification
- an experience with unclear responsibility or ownership
- an action with no explanation of why it was chosen
- a claimed result with no evidence or measurable outcome
- an answer that is strong enough to justify deeper interviewer probing

A follow-up is NOT warranted merely because the answer could theoretically contain
more information.

If the candidate answered the question clearly, correctly, specifically, and sufficiently
for the level of the interview, DO NOT manufacture a weakness. Move on.

Do NOT generate a follow-up just to make the interview longer.

STEP 2 — IDENTIFY THE HIGHEST-VALUE PROBE

If a follow-up is warranted, internally identify the SINGLE most valuable thing to probe.

Choose one:

- MISSING_FOUNDATION
- SHALLOW_REASONING
- UNSUPPORTED_CLAIM
- MISSING_EXAMPLE
- MISSING_RESULT
- MISSING_TRADEOFF
- MISSING_EDGE_CASE
- AMBIGUITY
- INCORRECT_REASONING
- STRONG_ANSWER_DEEPENING

Do not expose this classification in the final response.

STEP 3 — GENERATE THE FOLLOW-UP

The follow-up MUST:

- Be directly grounded in something the candidate actually said.
- Test exactly ONE unresolved point.
- Continue the same conversational thread.
- Be appropriate for the candidate's role and interview type.
- Be concise and natural when spoken by a human interviewer.
- Reveal additional evidence about the candidate's knowledge, reasoning, judgement,
  experience, or communication ability.
- Be answer-dependent. The question should clearly feel like a response to THIS answer,
  not a generic question that could follow anything.

Do NOT:

- Repeat or reword the original question.
- Ask "Can you elaborate?"
- Ask "Can you explain that further?"
- Ask "Can you tell me more?"
- Ask generic filler questions.
- Introduce an unrelated topic.
- Invent facts, projects, technologies, conflicts, decisions, responsibilities,
  metrics, or experiences that the candidate never mentioned.
- Combine multiple independent questions into one.
- Force a follow-up when the answer is already sufficiently complete.

MODE-SPECIFIC GUIDANCE:

TECHNICAL:
- Probe correctness, reasoning, complexity, trade-offs, edge cases, limitations,
  scalability, failure modes, or practical implications.
- If the candidate proposes an approach, probe why it works or when it would fail.
- If the candidate gives a definition, probe application, limitation, or trade-off.
- If the candidate compares approaches, probe the condition under which the choice changes.
- If the candidate gives a strong answer, deepen it rather than inventing a flaw.

HR:
- Probe the actual situation, responsibility, decision, stakeholder handling,
  accountability, result, or reflection described by the candidate.
- If the candidate gives a vague story, ask for the missing concrete detail.
- If the candidate describes an action, probe why they chose it.
- If they describe a successful outcome, probe measurable impact or learning.
- Never invent a conflict, leadership role, failure, or result.

COMMUNICATION:
- Probe the most important weakness actually visible in the answer:
  clarity, structure, depth, relevance, audience awareness, or reasoning.
- If the answer is vague, request a concrete example.
- If the structure is weak, ask something that forces clearer organization.
- If the answer is already strong, deepen the idea rather than criticizing it.
- Stay within the selected communication mode.

CUSTOM:
- Stay tightly grounded in the original custom question and candidate answer.
- Probe the most important missing reasoning, assumption, evidence, or implication.
- Do not introduce unrelated subject matter.

QUALITY CHECK:

Before returning the result, verify:

1. Could this question only have been generated after reading the candidate's answer?
2. Does it test one specific unresolved point?
3. Does it avoid assuming anything the candidate never said?
4. Is it different from the original question?
5. Would an experienced human interviewer genuinely ask it next?
6. Is a follow-up actually necessary?

OUTPUT ONLY THIS JSON:

{
  "shouldFollowUp": true,
  "question": "..."
}

If no meaningful follow-up is warranted:

{
  "shouldFollowUp": false,
  "question": ""
}

No markdown.
No explanation.
No extra fields.
`;

  const text = await callGroq(prompt, 0.5, 256);
  const parsed = JSON.parse(extractJsonBlock(text));

  return {
    shouldFollowUp: Boolean(parsed?.shouldFollowUp),
    question: parsed?.shouldFollowUp
      ? normalizeQuestionText(parsed?.question)
      : "",
  };
}

const FEEDBACK_CHUNK_SIZE = 5;

function buildQaPairsText(sessionData, indices, mode, communicationMode) {
  return indices
    .map((i) => {
      const item = sessionData[i];
      const communicationModeHint =
        mode === "communication"
          ? `\nCommunication Mode Hint: ${inferCommunicationEvalMode(
              item.question,
              communicationMode,
            )}`
          : "";
      return `[ITEM_ID: ${i}]\nQ${i + 1}: ${item.question}${communicationModeHint}\nA${i + 1}: ${item.answer || "[No answer]"}`;
    })
    .join("\n\n");
}

function buildPerQuestionPrompt({
  qaPairsText,
  roleLabel,
  humanModeLabel,
  subjectLabel,
  communicationModeLabel,
  difficultyLabel,
  scoringFocus,
  interviewerIntent,
}) {
  return `
You are a senior interviewer evaluating a ${roleLabel} candidate.

Interview Context:
- Interview Type: ${humanModeLabel}
- Subject: ${subjectLabel}
- Communication Mode: ${communicationModeLabel || "N/A"}
- Role: ${roleLabel}
- Difficulty: ${difficultyLabel}
- Evaluation Focus: ${scoringFocus}
- Interviewer Intent: ${interviewerIntent}

Interview Data (this is a PARTIAL batch of a longer interview — only evaluate the
items shown below, do not reference or assume any other questions exist):
${qaPairsText}

Evaluation Rules:
- Be strict and objective. Do NOT give generic praise. Penalize incomplete or vague answers.
- If an answer says "[Question skipped. No answer submitted.]", treat it as skipped and score 0 across all fields.
- whatWentWell and whatWasMissed must be grounded in specifics from THAT candidate's
  actual answer — never a generic, could-apply-to-any-answer sentence.
- missedPoints: 2-4 specific, substantive points relevant to THAT SPECIFIC QUESTION.
  Never use meta-phrasing like "a specific example of..." — name the actual point directly.
- idealAnswer MUST be a complete, interview-ready rewrite of THIS candidate's own
  answer with real substance, not a one-line description. Keep it efficient (3-4 sentences).
- CRITICAL: Each item above starts with [ITEM_ID: N]. Copy that exact number into
  questionIndex for the entry describing that item. Do not infer position yourself.

Return ONLY valid JSON, an array with exactly one object per item above:
[
  {
    "questionIndex": 0,
    "techScore": 0,
    "commScore": 0,
    "completenessScore": 0,
    "scores": { "clarity": 0, "structure": 0, "fluency": 0, "depth": 0, "relevance": 0 },
    "whatWentWell": "",
    "whatWasMissed": "",
    "missedPoints": ["", ""],
    "idealAnswer": "",
    "fillerWords": {"um": 0, "uh": 0, "like": 0}
  }
]
No markdown. No extra text. Return ONLY the JSON array.
`;
}

async function synthesizeOverallFeedback(perQuestion, ctx) {
  const condensed = perQuestion
    .map(
      (item, i) =>
        `Q${i + 1} — Tech: ${item.techScore}/10, Comm: ${item.commScore}/10, Complete: ${item.completenessScore}/10\nWent well: ${item.whatWentWell || "N/A"}\nMissed: ${item.whatWasMissed || "N/A"}`,
    )
    .join("\n\n");

  const prompt = `
You are a senior interviewer writing the final overall summary for a ${ctx.roleLabel} candidate's ${ctx.humanModeLabel} interview (${ctx.subjectLabel}, ${ctx.difficultyLabel} difficulty), based on per-question results already evaluated below.

Per-question results:
${condensed}

Synthesize an honest, specific overall summary of the WHOLE session — name real
patterns across multiple questions (recurring strengths, recurring gaps), not a
vague restatement. Do not invent detail not present above.

Return ONLY valid JSON:
{ "summary": "", "whatWentWell": ["", "", ""], "areasToImprove": ["", "", ""], "studySuggestions": ["", "", ""] }
No markdown. No extra text.
`;

  const parsed = await callGroqForJson(prompt, 0.4, 900);
  return {
    summary: String(parsed?.summary || "").trim(),
    whatWentWell: toStringArrayNoPad(
      parsed?.whatWentWell,
      "Provide stronger, specific examples to highlight your strengths.",
    ),
    areasToImprove: toStringArrayNoPad(
      parsed?.areasToImprove,
      "Add more detail and structure to improve answer quality.",
    ),
    studySuggestions: toStringArrayNoPad(
      parsed?.studySuggestions,
      "Practice timed mock interviews and review your weaker areas.",
    ),
  };
}

export async function generateFeedback(sessionData, context = {}) {
  const { mode, subject, role, difficulty, communicationMode } = context;
  const modeConfig = getModeConfig(mode, subject);
  const roleLabel = humanizeId(role, "Candidate");
  const difficultyLabel =
    DIFFICULTY_LABELS[difficulty] || DIFFICULTY_LABELS.medium;
  const subjectLabel =
    mode === "technical"
      ? formatSubjectList(subject, "General Computer Science")
      : mode === "custom"
        ? formatSubjectList(subject, "Custom Question Bank")
        : "General";
  const communicationModeLabel =
    mode === "communication"
      ? humanizeId(communicationMode, "Impromptu")
      : null;

  if (mode === "communication") {
    const { evaluations, overallSummary } = await evaluateCommunicationSession(
      sessionData,
      communicationMode,
    );

    const averageScores = {
      clarity: averageScore(evaluations.map((item) => item.scores.clarity)),
      structure: averageScore(evaluations.map((item) => item.scores.structure)),
      fluency: averageScore(evaluations.map((item) => item.scores.fluency)),
      depth: averageScore(evaluations.map((item) => item.scores.depth)),
      relevance: averageScore(evaluations.map((item) => item.scores.relevance)),
    };

    const overallCommScore = averageScore([
      averageScores.clarity,
      averageScores.structure,
      averageScores.fluency,
    ]);
    const overallTechScore = averageScore([
      averageScores.depth,
      averageScores.relevance,
    ]);
    const overallCompletenessScore = averageScore([
      averageScores.structure,
      averageScores.depth,
      averageScores.relevance,
    ]);

    // Exclude skipped questions from the session-wide rollup — their boilerplate
    // ("no strengths to highlight", "answer was skipped") would otherwise crowd
    // out real feedback from the questions that were actually answered.
    const answeredEvaluations = evaluations.filter(
      (_, index) => !sessionData[index]?.skipped,
    );

    const whatWentWell = toStringArray(
      answeredEvaluations.flatMap((item) => item.whatWentWell),
      "The answer had a usable core idea, but it needed stronger communication discipline.",
    );
    const areasToImprove = toStringArray(
      answeredEvaluations.flatMap((item) => item.issues),
      "The answer needed clearer structure, stronger precision, and less filler.",
    );
    const weakestAreas = getWeakestCommunicationAreas(averageScores);
    const studySuggestions = toStringArray(
      weakestAreas.map(createCommunicationStudySuggestion),
      "Record mock answers and review whether each sentence adds value.",
    );

    return attachSpeechMetrics(
      {
        overallTechScore,
        overallCommScore,
        overallCompletenessScore,
        summary:
          overallSummary || summarizeCommunicationPerformance(averageScores),
        whatWentWell,
        areasToImprove,
        studySuggestions,
        perQuestion: evaluations.map((item, index) => {
          const commScore = averageScore([
            item.scores.clarity,
            item.scores.structure,
            item.scores.fluency,
          ]);
          const techScore = averageScore([
            item.scores.depth,
            item.scores.relevance,
          ]);
          const completenessScore = averageScore([
            item.scores.structure,
            item.scores.depth,
            item.scores.relevance,
          ]);

          return {
            questionIndex: index,
            techScore,
            commScore,
            completenessScore,
            scores: item.scores,
            whatWentWell: item.whatWentWell.join(" "),
            whatWasMissed: item.issues.join(" "),
            missedPoints: item.missedPoints,
            idealAnswer: item.improvedAnswer,
            fillerWords: { um: 0, uh: 0, like: 0 },
          };
        }),
      },
      sessionData,
    );
  }

  const humanModeLabel = humanizeId(mode);

  if (sessionData.length > FEEDBACK_CHUNK_SIZE) {
    const chunks = [];
    for (
      let start = 0;
      start < sessionData.length;
      start += FEEDBACK_CHUNK_SIZE
    ) {
      chunks.push(
        Array.from(
          { length: Math.min(FEEDBACK_CHUNK_SIZE, sessionData.length - start) },
          (_, offset) => start + offset,
        ),
      );
    }

    const perQuestionMap = new Map();

    for (const chunkIndices of chunks) {
      const qaPairsText = buildQaPairsText(
        sessionData,
        chunkIndices,
        mode,
        communicationMode,
      );
      const prompt = buildPerQuestionPrompt({
        qaPairsText,
        roleLabel,
        humanModeLabel,
        subjectLabel,
        communicationModeLabel,
        difficultyLabel,
        scoringFocus: modeConfig.scoringFocus,
        interviewerIntent: modeConfig.interviewerIntent,
      });

      const parsedChunk = await callGroqForJson(
        prompt,
        0.4,
        900 + chunkIndices.length * 500,
      );
      const rawChunkItems = Array.isArray(parsedChunk) ? parsedChunk : [];
      const chunkMap = buildIndexedFeedbackMap(
        rawChunkItems,
        sessionData.length,
      );

      for (const index of chunkIndices) {
        perQuestionMap.set(index, chunkMap.get(index) || {});
      }
    }

    const perQuestion = Array.from(
      { length: sessionData.length },
      (_, index) => {
        const item = perQuestionMap.get(index) || {};
        const fillerWords =
          item?.fillerWords && typeof item.fillerWords === "object"
            ? item.fillerWords
            : {};
        const missedPoints = Array.isArray(item?.missedPoints)
          ? item.missedPoints
              .filter(Boolean)
              .map((p) => String(p).trim())
              .filter(Boolean)
          : [];

        return {
          questionIndex: index,
          techScore: clampScore(item?.techScore),
          commScore: clampScore(item?.commScore),
          completenessScore: clampScore(item?.completenessScore),
          scores: normalizeCommunicationScores(item?.scores),
          whatWentWell: String(item?.whatWentWell || "").trim(),
          whatWasMissed: String(item?.whatWasMissed || "").trim(),
          missedPoints,
          idealAnswer: String(item?.idealAnswer || "").trim(),
          fillerWords: {
            um: Number(fillerWords.um) || 0,
            uh: Number(fillerWords.uh) || 0,
            like: Number(fillerWords.like) || 0,
          },
        };
      },
    );

    const overall = await synthesizeOverallFeedback(perQuestion, {
      roleLabel,
      humanModeLabel,
      subjectLabel,
      difficultyLabel,
    });

    const scoredQuestions = perQuestion.filter(
      (_, index) => !sessionData[index]?.skipped,
    );
    const avg = (key) =>
      scoredQuestions.length > 0
        ? averageScore(scoredQuestions.map((q) => q[key]))
        : 0;

    return attachSpeechMetrics(
      {
        overallTechScore: avg("techScore"),
        overallCommScore: avg("commScore"),
        overallCompletenessScore: avg("completenessScore"),
        summary:
          overall.summary ||
          "Your interview was reviewed across multiple batches.",
        whatWentWell: overall.whatWentWell,
        areasToImprove: overall.areasToImprove,
        studySuggestions: overall.studySuggestions,
        perQuestion,
      },
      sessionData,
    );
  }

  const qaPairs = sessionData
    .map((item, i) => {
      const communicationModeHint =
        mode === "communication"
          ? `\nCommunication Mode Hint: ${inferCommunicationEvalMode(
              item.question,
              communicationMode,
            )}`
          : "";

      return `[ITEM_ID: ${i}]\nQ${i + 1}: ${item.question}${communicationModeHint}\nA${i + 1}: ${item.answer || "[No answer]"}`;
    })
    .join("\n\n");
  const communicationRules =
    mode === "communication"
      ? `
Communication-specific rules:
You are a senior communication coach and interviewer.

For EACH Q/A pair, evaluate the candidate's spoken answer using this internal contract:

COMMUNICATION MODE:
- Use the provided Communication Mode Hint when available.
- Selected communication mode for this session: ${communicationModeLabel || "Impromptu"}
- Modes:
  - impromptu -> evaluate thinking clarity, flow, coherence
  - structured -> evaluate structured answering (STAR format)
  - explain -> evaluate simplicity and clarity of explanation

CANDIDATE ANSWER:
- Evaluate the actual answer only, not the question.

EVALUATION RULES:
- Be strict and realistic.
- Do NOT give generic praise.
- Do NOT say "good answer" without justification.
- Do NOT ignore mistakes.
- Evaluate based on:
  1. Clarity
  2. Structure
  3. Depth
  4. Fluency
  5. Relevance
- Each score must be an integer from 0 to 10.

MAP THE RESULT INTO THE EXISTING perQuestion SCHEMA:
- perQuestion[i].scores = { clarity, structure, fluency, depth, relevance }
- perQuestion[i].whatWentWell = a concise evidence-based summary of strengths
- perQuestion[i].whatWasMissed = the main issues, weaknesses, and missed opportunities
- perQuestion[i].idealAnswer = the improvedAnswer

CRITICAL INSTRUCTION FOR perQuestion[i].idealAnswer:
- Keep the SAME core idea of the candidate.
- Do NOT change meaning completely.
- Fix structure, grammar, clarity.
- Remove filler and repetition.
- Make it sound confident and professional.
- Keep it natural, not robotic.
- If mode = impromptu:
  - organize into a clear opening
  - add 2-3 logical points
  - end with a short conclusion
- If mode = structured:
  - convert into STAR format:
    - Situation
    - Task
    - Action
    - Result
- If mode = explain:
  - simplify language
  - use analogy if helpful
  - make it understandable to a beginner

SCORING MAPPING:
- commScore should mainly reflect clarity, structure, and fluency.
- techScore should reflect depth and relevance as content quality.
- completenessScore should reflect whether the answer fully addressed the prompt.

OUTPUT DISCIPLINE:
- Return JSON only.
- No markdown.
- No commentary outside JSON.
`
      : "";

  const prompt = `
You are a senior interviewer evaluating a ${roleLabel} candidate.

Interview Context:
- Interview Type: ${humanizeId(mode)}
- Subject: ${subjectLabel}
- Communication Mode: ${communicationModeLabel || "N/A"}
- Role: ${roleLabel}
- Difficulty: ${difficultyLabel}
- Evaluation Focus: ${modeConfig.scoringFocus}
- Interviewer Intent: ${modeConfig.interviewerIntent}

Interview Data:
${qaPairs}

Evaluation Rules:
- Be strict and objective
- Do NOT give generic praise
- Penalize incomplete or vague answers
- If an answer says "[Question skipped. No answer submitted.]", treat it as skipped and score that per-question item as 0 across all scoring fields.
- CRITICAL: Each Q/A pair above starts with a tag like [ITEM_ID: 3]. You MUST set
  perQuestion[i].questionIndex to the EXACT number from that tag for the item you are
  describing — copy the number directly from the tag, do not infer or count positions
  yourself. This is the single most important rule in this task: a wrong questionIndex
  means the feedback gets shown on the wrong question entirely.
- Before finalizing your output, go through every single [ITEM_ID: N] tag above one at
  a time, in order, and confirm you have produced exactly one perQuestion entry whose
  questionIndex is N, whose content is about THAT specific answer, and whose skipped
  status matches what that answer actually contains. A main question and a skipped
  follow-up next to it are two separate IDs — never merge their content or swap which
  one gets real feedback vs. "not answered" treatment.
- Reward clarity, correctness, and depth
- Evaluate based on role expectations (${roleLabel})
- Keep the evaluation aligned with the selected interview type
- Score each field on a 0 to 10 scale using whole numbers only
- whatWentWell and whatWasMissed for EACH question must be grounded in specifics
  from THAT candidate's actual answer — quote or closely paraphrase something they
  actually said. Never write a generic, could-apply-to-any-answer sentence.

CRITICAL INSTRUCTION FOR perQuestion[i].missedPoints:
- For EACH question, in addition to whatWasMissed (which covers delivery, structure,
  and completeness problems), also fill perQuestion[i].missedPoints: 2-4 specific,
  substantive points, facts, examples, or considerations relevant to THAT SPECIFIC
  QUESTION that the candidate should have mentioned but did not.
- Ground this in real subject-matter reasoning about the actual question asked.
- FORBIDDEN phrasing — NEVER write meta-instructions telling the candidate to add
  something without naming the actual thing. Banned patterns: "a specific example
  of...", "the steps they would take to...", "more details about...", "the outcome
  of the situation". If you catch yourself writing one of these, replace it with the
  actual concrete point, named directly, as if you were answering the question yourself.
- GOLD STANDARD EXAMPLE — calibrate to this bar:
  Question: "Tell me about a time you showed leadership without being asked."
  Weak (BANNED): "A specific example of when they showed leadership."
  Strong (REQUIRED): "You could have named the actual friction you solved — e.g. two
  teams duplicating work because nobody owned a shared status update — and quantified
  the fix, like 'cut repeated bugs by half', since concrete numbers separate a generic
  leadership story from a memorable one."
- If the answer already covered the question thoroughly, name a more advanced or
  edge-case angle instead. missedPoints can be an empty array only if there is
  genuinely nothing more to add, which should be rare.

CRITICAL INSTRUCTION FOR perQuestion[i].idealAnswer:
- idealAnswer MUST be a complete, interview-ready rewrite of THIS candidate's own
  answer — real substance, not a one-line description of what a good answer would
  contain. ${sessionData.length > 6 ? "This session has many questions — keep each rewrite focused and efficient (roughly 3-4 sentences) rather than maximally long, since depth across ALL questions matters more than length on any single one." : "Several sentences of real substance is appropriate here."}
- Keep the same core idea, examples, and facts the candidate actually gave.
- Do NOT invent new facts, projects, or outcomes the candidate never mentioned,
  EXCEPT for weaving in the specific missedPoints you identified above — those
  should be naturally incorporated so the rewrite demonstrates the depth and
  completeness a strong candidate would actually give.
- Fix structure, remove filler words and repetition, tighten vague phrasing.
- If the candidate's answer was too short, vague, or skipped to meaningfully
  rewrite, say so plainly instead of inventing a fictional answer on their behalf.
- Make it sound confident, natural, and professional — the way an experienced coach
  would model a strong answer, never robotic or template-like.
${communicationRules}

Return ONLY valid JSON:

{
  "overallTechScore": 0,
  "overallCommScore": 0,
  "overallCompletenessScore": 0,
  "summary": "",
  "whatWentWell": ["", "", ""],
  "areasToImprove": ["", "", ""],
  "studySuggestions": ["", "", ""],
  "perQuestion": [
    {
      "questionIndex": 0,
      "techScore": 0,
      "commScore": 0,
      "completenessScore": 0,
      "scores": {
        "clarity": 0,
        "structure": 0,
        "fluency": 0,
        "depth": 0,
        "relevance": 0
      },
      "whatWentWell": "",
      "whatWasMissed": "",
      "missedPoints": ["", ""],
      "idealAnswer": "",
      "fillerWords": {"um": 0, "uh": 0, "like": 0}
    }
  ]
}

No markdown. No extra text.
`;

  const feedbackTokenBudget = 1200 + sessionData.length * 400;
  const parsed = await callGroqForJson(prompt, 0.4, feedbackTokenBudget);
  return attachSpeechMetrics(
    normalizeFeedback(parsed, sessionData.length),
    sessionData,
  );
}
