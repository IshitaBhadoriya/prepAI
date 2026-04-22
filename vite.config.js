import process from "node:process";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { handleAiRequest } from "./api/_ai.js";

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";

    req.on("data", (chunk) => {
      raw += chunk;
    });

    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });

    req.on("error", reject);
  });
}

function localApiPlugin(env) {
  return {
    name: "prepai-local-api",
    configureServer(server) {
      server.middlewares.use("/api/ai", async (req, res) => {
        try {
          const body = await readJsonBody(req);
          const result = await handleAiRequest({
            method: req.method,
            headers: req.headers,
            body,
            env,
          });

          res.statusCode = result.status;
          for (const [key, value] of Object.entries(result.headers)) {
            res.setHeader(key, value);
          }
          res.end(JSON.stringify(result.body));
        } catch (error) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              error: "Invalid API request.",
              details: error?.message || "Unknown error.",
            }),
          );
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = { ...process.env, ...loadEnv(mode, process.cwd(), "") };

  return {
    plugins: [react(), tailwindcss(), localApiPlugin(env)],
  };
});
