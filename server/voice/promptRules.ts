/**
 * The written standard for the ElevenLabs phone prompt (elevenPromptRules.md).
 * The weekly review and the prompt coach put this text in their system prompts,
 * so every proposed change is judged against it.
 *
 * Read once and cached. The path is relative to the working directory, as the
 * server and the tests both run from the repo root.
 */
import { readFileSync } from "fs";
import path from "path";

let cached: string | null = null;

export function loadPromptRules(): string {
  if (cached === null) {
    cached = readFileSync(path.join(process.cwd(), "server", "voice", "elevenPromptRules.md"), "utf8");
  }
  return cached;
}

export function resetPromptRulesCache(): void {
  cached = null;
}
