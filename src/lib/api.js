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

function normalizeCommunicationEvaluation(data) {
  return {
    scores: normalizeCommunicationScores(data?.scores),
    summary:
      String(data?.summary || "").trim() ||
      "The answer was evaluated, but the summary was incomplete.",
    whatWentWell: toStringArray(
      data?.whatWentWell,
      "The answer had a useful core idea, but it needed stronger execution.",
    ),
    issues: toStringArray(
      data?.issues,
      "The answer needed clearer structure, sharper language, and better focus.",
    ),
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

async function evaluateCommunicationAnswer(question, answer, selectedMode) {
  const communicationMode = inferCommunicationEvalMode(question, selectedMode);
  const trimmedAnswer = String(answer || "").trim();
  if (trimmedAnswer.length < 10) {
    return normalizeCommunicationEvaluation({
      scores: { clarity: 0, structure: 0, fluency: 0, depth: 0, relevance: 0 },
      summary: "The candidate did not provide a meaningful answer.",
      whatWentWell: [
        "No strengths to highlight — the answer was too brief to evaluate.",
      ],
      issues: [
        "The answer was too short to demonstrate any communication ability.",
        "No structure, depth, or relevance could be assessed.",
        "A complete, thoughtful response is required.",
      ],
      improvedAnswer:
        "A proper answer to this question would require the candidate to describe their approach in detail, using specific examples and structured reasoning.",
    });
  }

  const prompt = `
You are a senior communication coach and interviewer.

Your task is to evaluate and improve a candidate's spoken answer.

COMMUNICATION MODE:
${communicationMode}

Modes:
- impromptu -> evaluate thinking clarity, flow, coherence
- structured -> evaluate structured answering (STAR format)
- explain -> evaluate simplicity and clarity of explanation

CANDIDATE QUESTION:
${question}

CANDIDATE ANSWER:
${answer || "[No answer given]"}

EVALUATION RULES:
- Be strict and realistic.
- DO NOT give generic praise.
- DO NOT say "good answer" without justification.
- DO NOT ignore mistakes.
- Evaluate based on:
  1. Clarity
  2. Structure
  3. Depth
  4. Fluency
  5. Relevance
- Each score must be between 0 and 10 using integers only.

CRITICAL INSTRUCTION - IMPROVED ANSWER:
- Rewrite the candidate's answer into a high-quality ideal version.
- Keep the SAME core idea of the candidate.
- DO NOT change the meaning completely.
- Fix structure, grammar, clarity.
- Remove filler and repetition.
- Make it sound confident and professional.
- Keep it natural, not robotic.
- If mode = impromptu:
  - organize into a clear opening
  - 2-3 logical points
  - short conclusion
- If mode = structured:
  - convert into STAR format:
    - Situation
    - Task
    - Action
    - Result
- If mode = explain:
  - simplify language
  - use analogy if possible
  - make it understandable to a beginner

YOUR OUTPUT MUST BE JSON ONLY:
{
  "scores": {
    "clarity": 0,
    "structure": 0,
    "fluency": 0,
    "depth": 0,
    "relevance": 0
  },
  "summary": "",
  "whatWentWell": ["", "", ""],
  "issues": ["", "", ""],
  "improvedAnswer": ""
}

NO markdown
NO explanation outside JSON
RETURN ONLY JSON
`;

  const text = await callGroq(prompt, 0.3, 900);
  const parsed = JSON.parse(extractJsonBlock(text));
  return normalizeCommunicationEvaluation(parsed);
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

function normalizeFeedback(data, questionCount) {
  const perQuestion = Array.isArray(data?.perQuestion) ? data.perQuestion : [];

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
      const item = perQuestion[index] || {};
      const fillerWords =
        item?.fillerWords && typeof item.fillerWords === "object"
          ? item.fillerWords
          : {};

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
        console.log(
          `Groq ${res.status}. Waiting 15s before retry ${i + 1}/${retries}...`,
        );
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
        console.log(`Groq timed out. Retrying ${i + 1}/${retries}...`);
        if (i === retries - 1) {
          throw new Error(
            "Request timed out after 3 attempts. Please try again.",
          );
        }
        await new Promise((resolve) => setTimeout(resolve, 5000));
        continue;
      }

      if (i === retries - 1) throw err;
      console.log(`Groq call failed. Retrying ${i + 1}/${retries}...`);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  throw new Error("Failed after retries. Please wait a moment and try again.");
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

Rules:
- Generate EXACTLY ${questionCount} questions.
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
      : "General";
  const communicationModeLabel =
    mode === "communication"
      ? humanizeId(communicationMode, "Impromptu")
      : null;
  const prompt = `
You are a strict ${modeConfig.interviewer} hiring for ${roleLabel}.

Interview Type: ${humanizeId(mode)}
Subject Coverage: ${subjectLabel}
Communication Mode: ${communicationModeLabel || "N/A"}
Primary Focus: ${modeConfig.focus}
Interviewer Intent: ${modeConfig.interviewerIntent}

Original Question:
${question}

Candidate Answer:
${answer || "[No answer given]"}

Your task:
Generate EXACTLY ONE follow-up question.

Follow-up MUST:
- Be based on the candidate's answer
- Identify a weakness, missing concept, or shallow explanation
- Be relevant to the role (${roleLabel})
- ${modeConfig.followUpFocus}
- Be precise, role-aware, and interview-level
- Continue the same thread instead of switching topics
- Stay inside the same communication mode when the interview type is communication

DO NOT:
- Repeat the original question
- Ask generic questions
- Ask unrelated topics
- Switch to a different interview type

STRICT OUTPUT:
Return ONLY the follow-up question as plain text.
`;
  const text = await callGroq(prompt, 0.7, 256);
  return normalizeQuestionText(text);
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
      : "General";
  const communicationModeLabel =
    mode === "communication"
      ? humanizeId(communicationMode, "Impromptu")
      : null;

  if (mode === "communication") {
    const evaluations = [];

    for (const item of sessionData) {
      const evaluation = await evaluateCommunicationAnswer(
        item.question,
        item.answer,
        communicationMode,
      );
      evaluations.push(evaluation);
    }

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

    const whatWentWell = toStringArray(
      evaluations.flatMap((item) => item.whatWentWell),
      "The answer had a usable core idea, but it needed stronger communication discipline.",
    );
    const areasToImprove = toStringArray(
      evaluations.flatMap((item) => item.issues),
      "The answer needed clearer structure, stronger precision, and less filler.",
    );
    const weakestAreas = getWeakestCommunicationAreas(averageScores);
    const studySuggestions = toStringArray(
      weakestAreas.map(createCommunicationStudySuggestion),
      "Record mock answers and review whether each sentence adds value.",
    );

    return {
      overallTechScore,
      overallCommScore,
      overallCompletenessScore,
      summary: summarizeCommunicationPerformance(averageScores),
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
          idealAnswer: item.improvedAnswer,
          fillerWords: { um: 0, uh: 0, like: 0 },
        };
      }),
    };
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

      return `Q${i + 1}: ${item.question}${communicationModeHint}\nA${i + 1}: ${item.answer || "[No answer]"}`;
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
- Reward clarity, correctness, and depth
- Evaluate based on role expectations (${roleLabel})
- Keep the evaluation aligned with the selected interview type
- Score each field on a 0 to 10 scale using whole numbers only
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
      "idealAnswer": "",
      "fillerWords": {"um": 0, "uh": 0, "like": 0}
    }
  ]
}

No markdown. No extra text.
`;

  const text = await callGroq(prompt, 0.4, 2048);
  const parsed = JSON.parse(extractJsonBlock(text));
  return normalizeFeedback(parsed, sessionData.length);
}
