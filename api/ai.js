import process from "node:process";
import { handleAiRequest } from "./_ai.js";

export default async function handler(req, res) {
  const result = await handleAiRequest({
    method: req.method,
    headers: req.headers,
    body: req.body,
    env: process.env,
  });

  res.status(result.status);

  for (const [key, value] of Object.entries(result.headers)) {
    res.setHeader(key, value);
  }

  res.json(result.body);
}
