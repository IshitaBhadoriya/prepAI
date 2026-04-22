import process from "node:process";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";
const MAX_PROMPT_CHARS = 32_000;

function getEnv(name, env = process.env) {
  return env[name] || "";
}

function json(status, payload) {
  return {
    status,
    headers: { "Content-Type": "application/json" },
    body: payload,
  };
}

async function verifySupabaseToken(token, env = process.env) {
  const supabaseUrl =
    getEnv("SUPABASE_URL", env) || getEnv("VITE_SUPABASE_URL", env);
  const supabaseAnonKey =
    getEnv("SUPABASE_ANON_KEY", env) || getEnv("VITE_SUPABASE_ANON_KEY", env);

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      ok: false,
      reason: "Supabase server environment is not configured.",
    };
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    return { ok: false, reason: "Invalid or expired session." };
  }

  return { ok: true };
}

async function callGroq({ prompt, temperature, maxTokens }, env = process.env) {
  const apiKey = getEnv("GROQ_API_KEY", env);

  if (!apiKey) {
    return json(503, {
      code: "AI_CONFIG_MISSING",
      error:
        "AI service is not configured. Add GROQ_API_KEY to the server environment and restart the dev server.",
    });
  }

  const response = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature,
      max_tokens: maxTokens,
    }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    return json(response.status, {
      error: "AI provider request failed.",
      providerStatus: response.status,
      details: data?.error?.message || data?.error || "Unknown provider error.",
    });
  }

  return json(200, {
    content: data?.choices?.[0]?.message?.content || "",
  });
}

export async function handleAiRequest({ method, headers, body, env }) {
  if (method !== "POST") {
    return json(405, { error: "Method not allowed." });
  }

  const authorization =
    headers?.authorization ||
    headers?.Authorization ||
    headers?.get?.("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";

  if (!token) {
    return json(401, { error: "Authentication is required." });
  }

  const authResult = await verifySupabaseToken(token, env);
  if (!authResult.ok) {
    return json(401, { error: authResult.reason });
  }

  const prompt = String(body?.prompt || "").trim();
  const temperature = Number.isFinite(Number(body?.temperature))
    ? Math.max(0, Math.min(1, Number(body.temperature)))
    : 0.7;
  const maxTokens = Number.isFinite(Number(body?.maxTokens))
    ? Math.max(128, Math.min(4096, Number(body.maxTokens)))
    : 2048;

  if (!prompt) {
    return json(400, { error: "Prompt is required." });
  }

  if (prompt.length > MAX_PROMPT_CHARS) {
    return json(413, { error: "Prompt is too large." });
  }

  try {
    return await callGroq({ prompt, temperature, maxTokens }, env);
  } catch (error) {
    return json(500, {
      error: "AI request failed unexpectedly.",
      details: error?.message || "Unknown error.",
    });
  }
}
