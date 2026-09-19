/**
 * Provider choice for the demo client generator: Claude through the CLI
 * (subscription, default) or the OpenAI API. Whichever is chosen, OpenAI is
 * the fallback when Claude errors, times out or returns something unusable.
 *
 * The contract callers rely on: this either returns parsed, validated data,
 * or throws a GenerationError. It never hands back a template in disguise.
 */

import { claudeJson, extractJsonObject } from "../aiTextHelper";

export type GenProvider = "claude" | "openai";
export type ClaudeModel = "opus" | "sonnet";

export class GenerationError extends Error {
  constructor(message: string, public stage: string) {
    super(message);
    this.name = "GenerationError";
  }
}

/** Full-generation timeouts. Opus reasons longer on the large row 91 prompt. */
export const CLAUDE_TIMEOUT_MS: Record<ClaudeModel, number> = { opus: 240_000, sonnet: 150_000 };

export interface OpenAIOpts {
  model: string;
  maxTokens: number;
  timeoutMs: number;
}

/** A validator returns null when the data is usable, or what is wrong with it. */
export type Validate = (data: any) => string | null;

async function openaiJson(system: string, user: string, o: OpenAIOpts): Promise<string> {
  const apiKey = process.env.OPEN_AI_API_KEY;
  if (!apiKey) throw new Error("no OPEN_AI_API_KEY set");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    signal: AbortSignal.timeout(o.timeoutMs),
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: o.model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      // Reasoning models: max_completion_tokens (max_tokens is rejected), and
      // reasoning tokens count against it. No temperature: only the default is
      // accepted.
      max_completion_tokens: o.maxTokens,
      // json_object, not json_schema: a strict schema would freeze row 91's key
      // set into code, and a key added from the Prompt Library would vanish.
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    throw new Error(`OpenAI HTTP ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`);
  }
  const json = (await res.json()) as any;
  if (json?.choices?.[0]?.finish_reason === "length") {
    throw new Error(`OpenAI answer truncated at ${o.maxTokens} tokens`);
  }
  return (json?.choices?.[0]?.message?.content || "").trim();
}

function parseAndCheck(text: string, validate?: Validate): any {
  const obj = extractJsonObject(text);
  if (!obj) throw new Error("answer was not JSON");
  const data = JSON.parse(obj);
  const problem = validate?.(data);
  if (problem) throw new Error(`answer failed validation: ${problem}`);
  return data;
}

export async function runJson(opts: {
  system: string;
  user: string;
  provider: GenProvider;
  claudeModel: ClaudeModel;
  claudeTimeoutMs?: number;
  validate?: Validate;
  openai: OpenAIOpts;
  /** Names the step in errors and logs ("generate", "directions"). */
  stage: string;
}): Promise<{ data: any; providerUsed: string }> {
  const errors: string[] = [];

  if (opts.provider === "claude") {
    const r = await claudeJson({
      system: opts.system,
      user: opts.user,
      model: opts.claudeModel,
      timeoutMs: opts.claudeTimeoutMs ?? CLAUDE_TIMEOUT_MS[opts.claudeModel],
    });
    try {
      if ("error" in r) throw new Error(r.error);
      return { data: parseAndCheck(r.text, opts.validate), providerUsed: `claude-${opts.claudeModel}` };
    } catch (err) {
      const msg = (err as Error).message;
      errors.push(`Claude ${opts.claudeModel}: ${msg}`);
      console.error(`[demo-gen:${opts.stage}] Claude ${opts.claudeModel} failed, trying OpenAI:`, msg);
    }
  }

  try {
    const text = await openaiJson(opts.system, opts.user, opts.openai);
    return { data: parseAndCheck(text, opts.validate), providerUsed: "openai" };
  } catch (err) {
    const msg = (err as Error).name === "TimeoutError"
      ? `timed out after ${Math.round(opts.openai.timeoutMs / 1000)}s`
      : (err as Error).message;
    errors.push(`OpenAI: ${msg}`);
    console.error(`[demo-gen:${opts.stage}] OpenAI failed:`, msg);
  }

  throw new GenerationError(`Generation failed. ${errors.join(" | ")}`, opts.stage);
}
