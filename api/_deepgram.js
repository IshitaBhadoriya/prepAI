import process from "node:process";
import { createClient } from "@deepgram/sdk";

const TOKEN_TTL_SECONDS = 30;

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

async function createDeepgramToken(env = process.env) {
  const apiKey = getEnv("DEEPGRAM_API_KEY", env);

  if (!apiKey) {
    return json(503, {
      code: "DEEPGRAM_CONFIG_MISSING",
      error:
        "Deepgram is not configured. Add DEEPGRAM_API_KEY to the server environment and restart the dev server.",
    });
  }

  const deepgram = createClient(apiKey);
  const { result, error } = await deepgram.auth.grantToken({
    ttl_seconds: TOKEN_TTL_SECONDS,
  });

  if (error) {
    return json(error.status || error.statusCode || 502, {
      error: "Deepgram token request failed.",
      details: error.message || "Unknown provider error.",
    });
  }

  if (!result?.access_token) {
    return json(502, {
      error: "Deepgram token request returned an invalid response.",
    });
  }

  return json(200, {
    token: result.access_token,
    expiresAt: new Date(
      Date.now() + Number(result.expires_in || TOKEN_TTL_SECONDS) * 1000,
    ).toISOString(),
  });
}

export async function handleDeepgramTokenRequest({ method, headers, env }) {
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

  try {
    return await createDeepgramToken(env);
  } catch (error) {
    return json(500, {
      error: "Deepgram token request failed unexpectedly.",
      details: error?.message || "Unknown error.",
    });
  }
}
