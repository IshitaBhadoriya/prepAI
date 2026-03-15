const GROQ_KEY = import.meta.env.VITE_GROQ_KEY;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

async function callGroq(
  prompt,
  temperature = 0.7,
  maxTokens = 2048,
  retries = 3,
) {
  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

      const res = await fetch(GROQ_URL, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${GROQ_KEY}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: prompt }],
          temperature,
          max_tokens: maxTokens,
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
        const err = await res.json();
        throw new Error(`Groq error ${res.status}: ${JSON.stringify(err)}`);
      }

      const data = await res.json();
      return data.choices?.[0]?.message?.content;
    } catch (err) {
      if (err.name === "AbortError") {
        console.log(`Groq timed out. Retrying ${i + 1}/${retries}...`);
        if (i === retries - 1)
          throw new Error(
            "Request timed out after 3 attempts. Please try again.",
          );
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

  const text = await callGroq(prompt, 0.8, 1024);
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

  const text = await callGroq(prompt, 0.2, 4096);
  const cleaned = text
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();
  return JSON.parse(cleaned);
}
