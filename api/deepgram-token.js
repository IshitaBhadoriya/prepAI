import process from "node:process";
import { handleDeepgramTokenRequest } from "./_deepgram.js";

export default async function handler(req, res) {
  const result = await handleDeepgramTokenRequest({
    method: req.method,
    headers: req.headers,
    env: process.env,
  });

  res.status(result.status);

  for (const [key, value] of Object.entries(result.headers)) {
    res.setHeader(key, value);
  }

  res.json(result.body);
}
