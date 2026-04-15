/**
 * Small AI text completion helper for enrichment tasks.
 *
 * Tries Claude Haiku via `claude -p` first (subscription, no per-call cost).
 * Falls back to Groq (free tier) on failure. Returns null if both fail.
 *
 * Designed for short, fast completions (< 30s). No streaming, no thinking.
 */

import { execFile } from "child_process";

const CLAUDE_BIN = "/home/gabriel/.npm-global/bin/claude";
const CLAUDE_TIMEOUT_MS = 30_000;
const GROQ_TIMEOUT_MS = 20_000;
const GROQ_MODEL = "llama-3.1-8b-instant";

function cleanClaudeEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.CLAUDECODE;
  delete env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS;
  delete env.CLAUDE_CODE_ENTRYPOINT;
  delete env.CLAUDE_AGENT_SDK_VERSION;
  delete env.CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING;
  return env;
}

/** Single completion via Claude Haiku. Returns null on error. */
async function tryHaiku(prompt: string): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(
      CLAUDE_BIN,
      ["-p", prompt, "--model", "haiku", "--max-turns", "1"],
      { timeout: CLAUDE_TIMEOUT_MS, maxBuffer: 1024 * 1024, env: cleanClaudeEnv() },
      (err, stdout) => {
        if (err || !stdout?.trim()) {
          if (err) console.warn("[aiTextHelper] Haiku failed:", err.message);
          return resolve(null);
        }
        resolve(stdout.trim());
      },
    );
  });
}

/** Single completion via Groq. Returns null on error or missing key. */
async function tryGroq(prompt: string, systemPrompt?: string): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GROQ_TIMEOUT_MS);
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
          { role: "user", content: prompt },
        ],
        max_tokens: 800,
        temperature: 0.4,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn("[aiTextHelper] Groq error:", res.status);
      return null;
    }
    const json = await res.json() as any;
    const text = json.choices?.[0]?.message?.content?.trim();
    return text || null;
  } catch (err: any) {
    console.warn("[aiTextHelper] Groq fetch failed:", err.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Strip common markdown code fences from a completion. */
export function stripFences(s: string): string {
  let out = s.trim();
  if (out.startsWith("```")) {
    out = out.replace(/^```(?:json|text)?\s*/i, "").replace(/\s*```$/i, "");
  }
  return out.trim();
}

/**
 * Complete a prompt. Tries Haiku first, falls back to Groq. Returns null if both fail.
 * For fast enrichment tasks only — not for long-running reasoning.
 */
export async function completeText(prompt: string, systemPrompt?: string): Promise<string | null> {
  const haiku = await tryHaiku(systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt);
  if (haiku) return haiku;
  const groq = await tryGroq(prompt, systemPrompt);
  return groq;
}
