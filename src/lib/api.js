const GEMINI_KEY = import.meta.env.VITE_GEMINI_KEY;

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`;

async function callGemini(prompt, temperature = 0.7, maxTokens = 2048) {
  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature, maxOutputTokens: maxTokens },
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Gemini error ${res.status}: ${JSON.stringify(err)}`);
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text;
}

// Call 1 — Generate 7 questions (1 API call per session)
export async function generateQuestions(mode, subject, difficulty) {
  const modeMap = {
    hr: "behavioural and situational HR interview questions about teamwork, conflict, leadership, strengths, weaknesses, and career goals",
    communication:
      "communication skills questions testing articulation, clarity, and opinion expression",
    technical: `technical interview questions for ${subject} covering core concepts and problem solving`,
  };
  const diffMap = {
    easy: "fresher level (no work experience)",
    medium: "internship level (some projects or internships)",
    hard: "placement level (top product companies)",
  };
  const prompt = `You are a senior interviewer. Generate exactly 7 ${modeMap[mode]} at ${diffMap[difficulty]} difficulty.
Return ONLY a JSON array of 7 strings. No explanation, no numbering, no markdown.
Example: ["Q1?","Q2?","Q3?","Q4?","Q5?","Q6?","Q7?"]`;

  const text = await callGemini(prompt, 0.8, 1024);
  const cleaned = text
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();
  return JSON.parse(cleaned);
}

// Call 2 — Generate full feedback (1 API call per session, at the end)
export async function generateFeedback(sessionData) {
  const qaPairs = sessionData
    .map(
      (item, i) =>
        `Q${i + 1}: ${item.question}\nA${i + 1}: ${item.answer || "[No answer]"}`,
    )
    .join("\n\n");

  const prompt = `You are an expert interview coach. Analyse this mock interview.
${qaPairs}
Respond in this EXACT JSON format, no markdown, no extra text:
{"overallTechScore":0,"overallCommScore":0,"overallCompletenessScore":0,"summary":"","whatWentWell":["","",""],"areasToImprove":["","",""],"studySuggestions":["","",""],"perQuestion":[{"questionIndex":0,"techScore":0,"commScore":0,"completenessScore":0,"whatWentWell":"","whatWasMissed":"","idealAnswer":"","fillerWords":{"um":0,"uh":0,"like":0}}]}`;

  const text = await callGemini(prompt, 0.2, 4096);
  const cleaned = text
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();
  return JSON.parse(cleaned);
}
