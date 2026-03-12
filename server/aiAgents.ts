import { spawn } from "child_process";
import { mkdirSync, existsSync } from "fs";
import type { Response } from "express";

const CLAUDE_BIN = "/home/gabriel/.npm-global/bin/claude";
const SESSIONS_DIR = "/tmp/ai-sessions";

export interface SubAgentBlock {
  name: string;
  content: string;
}

/** Get working directory for a session. Code Runner uses the real codebase; others get an isolated temp dir. */
export function getSessionCwd(sessionId: string, agentType: string): string {
  if (agentType === "code_runner") {
    return "/home/gabriel/LeadAwakerApp";
  }
  const dir = `${SESSIONS_DIR}/${sessionId}`;
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Stream Claude CLI output as SSE to the browser.
 * SSE events:
 *   data: {"type":"token","text":"..."}
 *   data: {"type":"done","subAgentBlocks":[...]}
 *   data: {"type":"error","message":"..."}
 */
export function streamClaudeResponse(opts: {
  prompt: string;
  cwd: string;
  bypassPermissions: boolean;
  isFirstMessage: boolean;
  res: Response;
  onDone: (fullText: string, subAgentBlocks: SubAgentBlock[]) => void;
}): void {
  const args: string[] = [];
  if (opts.bypassPermissions) args.push("--dangerouslySkipPermissions");
  if (!opts.isFirstMessage) args.push("--continue");
  args.push("-p", opts.prompt);

  const child = spawn(CLAUDE_BIN, args, {
    cwd: opts.cwd,
    env: { ...process.env },
  });

  let fullText = "";
  let stdoutBuffer = "";

  child.stdout.on("data", (data: Buffer) => {
    const chunk = data.toString();
    fullText += chunk;
    stdoutBuffer += chunk;
    const evt = JSON.stringify({ type: "token", text: chunk });
    opts.res.write(`data: ${evt}\n\n`);
  });

  child.stderr.on("data", (data: Buffer) => {
    // Claude sometimes writes progress info to stderr — forward it but filter ANSI
    const raw = data.toString();
    const clean = raw.replace(/\x1b\[[0-9;]*[mGKHF]/g, "").replace(/\r/g, "");
    if (clean.trim()) {
      fullText += clean;
      stdoutBuffer += clean;
      const evt = JSON.stringify({ type: "token", text: clean });
      opts.res.write(`data: ${evt}\n\n`);
    }
  });

  child.on("close", () => {
    // Parse sub-agent blocks from full output
    const subAgentBlocks: SubAgentBlock[] = [];
    const blockRegex = /╔═+[^╗]*╗([\s\S]*?)╚═+/g;
    let match: RegExpExecArray | null;
    while ((match = blockRegex.exec(stdoutBuffer)) !== null) {
      // Try to extract agent name from the header line
      const headerLine = match[0].split("\n")[0];
      const nameMatch = headerLine.match(/[A-Z][a-z][\w\s]+(?:agent|Agent)/i) ||
                        headerLine.match(/╔═+\s*([^═╗]+?)\s*═*╗/);
      const name = nameMatch ? nameMatch[1]?.trim() || "Agent" : "Agent";
      subAgentBlocks.push({ name, content: match[1].trim() });
    }

    // Approximate token counts (4 chars ≈ 1 token)
    const inputTokens = Math.ceil(opts.prompt.length / 4);
    const outputTokens = Math.ceil(fullText.length / 4);
    opts.res.write(`data: ${JSON.stringify({ type: "done", subAgentBlocks, usage: { inputTokens, outputTokens } })}\n\n`);
    opts.res.end();
    opts.onDone(fullText, subAgentBlocks);
  });

  child.on("error", (err) => {
    opts.res.write(`data: ${JSON.stringify({ type: "error", message: err.message })}\n\n`);
    opts.res.write(`data: ${JSON.stringify({ type: "done", subAgentBlocks: [] })}\n\n`);
    opts.res.end();
    opts.onDone("", []);
  });
}

/** Default system prompts for built-in agent types */
export const DEFAULT_SYSTEM_PROMPTS: Record<string, string> = {
  campaign_crafter: `You are a Campaign Crafter for LeadAwaker CRM, a WhatsApp lead reactivation platform. You help craft and improve campaign messages, AI persona names, roles, and descriptions.

You have access to WebFetch and WebSearch tools to browse websites and research topics.

When the user asks you to update specific campaign fields, output your suggestions in this exact format at the end of your response:

<campaign_update campaign_id="CAMPAIGN_ID">
{
  "firstMessage": "updated first message here",
  "aiName": "AI persona name",
  "aiRole": "AI persona role",
  "description": "campaign description"
}
</campaign_update>

Only include fields that need updating. Be conversational and helpful. The current account campaigns will be provided in each message.`,

  code_runner: `You are Claude Code running on a Raspberry Pi server with full permission to read and modify the LeadAwakerApp project. Changes you make are immediately applied via pm2 (tsx watch auto-reloads).

Project: LeadAwakerApp (React + Vite frontend, Express + Node.js backend, PostgreSQL with Drizzle ORM)
Stack: TypeScript, React 19, Tailwind CSS v4, shadcn/ui, Wouter routing, TanStack Query
Working directory: /home/gabriel/LeadAwakerApp

You can read files, edit files, run commands, and make any changes needed. Be careful with database migrations (drizzle-kit) and always consider TypeScript types.`,
};

/** Seed the two default agents if they don't exist */
export async function seedDefaultAiAgents(db: any, aiAgentsTable: any): Promise<void> {
  const { count } = await import("drizzle-orm");
  const [{ total }] = await db.select({ total: count() }).from(aiAgentsTable);
  if (total > 0) return;

  await db.insert(aiAgentsTable).values([
    {
      name: "Campaign Crafter",
      type: "campaign_crafter",
      systemPrompt: DEFAULT_SYSTEM_PROMPTS.campaign_crafter,
      photoUrl: null,
      enabled: true,
      displayOrder: 1,
    },
    {
      name: "Code Runner",
      type: "code_runner",
      systemPrompt: DEFAULT_SYSTEM_PROMPTS.code_runner,
      photoUrl: null,
      enabled: true,
      displayOrder: 2,
    },
  ]);
  console.log("[AI Agents] Seeded Campaign Crafter + Code Runner");
}
