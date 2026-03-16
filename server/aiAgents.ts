import { spawn, type ChildProcess } from "child_process";
import { mkdirSync, existsSync } from "fs";
import type { Response } from "express";

const CLAUDE_BIN = "/home/gabriel/.npm-global/bin/claude";
const SESSIONS_DIR = "/tmp/ai-sessions";
const STREAM_TIMEOUT_MS = 180_000; // 3 minutes default
const CODE_RUNNER_TIMEOUT_MS = 600_000; // 10 minutes for code_runner (uses tools, takes longer)

/** Create a clean env without Claude Code session vars (prevents nested-session detection) */
function cleanEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.CLAUDECODE;
  delete env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS;
  delete env.CLAUDE_CODE_ENTRYPOINT;
  delete env.CLAUDE_AGENT_SDK_VERSION;
  delete env.CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING;
  return env;
}

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

// ─── Stream-JSON event types from Claude CLI ─────────────────────────────────

interface StreamJsonSystemEvent {
  type: "system";
  subtype: "init";
  session_id: string;
  model: string;
  tools: string[];
  [key: string]: unknown;
}

interface StreamJsonAssistantEvent {
  type: "assistant";
  message: {
    id: string;
    role: "assistant";
    content: Array<
      | { type: "text"; text: string }
      | { type: "thinking"; thinking: string }
      | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
      | { type: "tool_result"; tool_use_id: string; content: string }
    >;
    usage?: {
      input_tokens: number;
      output_tokens: number;
      cache_read_input_tokens?: number;
      cache_creation_input_tokens?: number;
    };
  };
  session_id: string;
  parent_tool_use_id?: string | null;
}

interface StreamJsonResultEvent {
  type: "result";
  subtype: "success" | "error";
  is_error: boolean;
  result: string;
  session_id: string;
  total_cost_usd: number;
  duration_ms: number;
  num_turns: number;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
  [key: string]: unknown;
}

type StreamJsonEvent = StreamJsonSystemEvent | StreamJsonAssistantEvent | StreamJsonResultEvent | { type: string; [key: string]: unknown };

/**
 * Stream Claude CLI output as SSE to the browser using structured stream-json events.
 *
 * SSE events sent to client:
 *   {"type":"token","text":"..."}           — incremental text
 *   {"type":"activity","activity":"..."}    — thinking, tool_use indicators
 *   {"type":"done","cliSessionId":"...","usage":{...}}
 *   {"type":"error","message":"..."}
 *
 * Uses --output-format stream-json --verbose for structured NDJSON parsing.
 * Supports --resume for session persistence (no prompt rebuilding after first message).
 */
export function streamClaudeResponse(opts: {
  prompt: string;
  cwd: string;
  bypassPermissions: boolean;
  res: Response;
  /** Model override (e.g. claude-sonnet-4-20250514) */
  model?: string;
  /** Thinking level: none, low, medium, high */
  thinkingLevel?: string;
  /** Claude CLI session ID to resume (skip prompt rebuild) */
  cliSessionId?: string;
  /** Agent type — controls which built-in tools are available */
  agentType?: string;
  /** Optional system prompt to append (used with --resume to inject context without rebuilding) */
  appendSystemPrompt?: string;
  /** Optional async callback that runs BEFORE the done event and res.end(). Use for CRM tool execution. */
  beforeDone?: (fullText: string, res: Response) => Promise<void>;
  onDone: (fullText: string, subAgentBlocks: SubAgentBlock[], cliSessionId: string | null, usage: { inputTokens: number; outputTokens: number; costUsd: number }) => void;
}): void {
  const args: string[] = [];

  // Core flags for structured streaming
  args.push("--output-format", "stream-json", "--verbose");

  if (opts.bypassPermissions) args.push("--dangerously-skip-permissions");
  if (opts.model) args.push("--model", opts.model);

  // Tool restrictions per agent type
  if (opts.agentType && opts.agentType !== "code_runner") {
    // Non-code agents get NO built-in tools (they use XML-based CRM tools parsed server-side)
    args.push("--tools", "");
  }

  // Resume existing CLI session or start fresh
  if (opts.cliSessionId) {
    args.push("--resume", opts.cliSessionId);
  }

  // Append system prompt (useful for injecting page context on resumed sessions)
  if (opts.appendSystemPrompt) {
    args.push("--append-system-prompt", opts.appendSystemPrompt);
  }

  args.push("-p", opts.prompt);

  console.log("[StreamClaude] Spawning:", CLAUDE_BIN, args.slice(0, 6).join(" "), "...", "| cwd:", opts.cwd, opts.cliSessionId ? `| resume: ${opts.cliSessionId}` : "| new session");

  const child: ChildProcess = spawn(CLAUDE_BIN, args, {
    cwd: opts.cwd,
    env: cleanEnv(),
    stdio: ["ignore", "pipe", "pipe"],
  });

  // Timeout safety — kill if stuck (code_runner gets more time since it uses tools)
  const timeoutMs = opts.agentType === "code_runner" ? CODE_RUNNER_TIMEOUT_MS : STREAM_TIMEOUT_MS;
  const timeout = setTimeout(() => {
    console.error("[StreamClaude] Timeout after", timeoutMs, "ms — killing process");
    try { child.kill("SIGTERM"); } catch {}
    setTimeout(() => { try { child.kill("SIGKILL"); } catch {} }, 5000);
  }, timeoutMs);

  let fullText = "";
  let cliSessionId: string | null = opts.cliSessionId || null;
  let lastTextContent = ""; // Track text we've already sent to avoid duplicates
  let resultUsage = { inputTokens: 0, outputTokens: 0, costUsd: 0 };
  let ndjsonBuffer = "";
  let clientDisconnected = false;

  // Track client disconnection (HMR, page reload, network drop)
  opts.res.on("close", () => { clientDisconnected = true; });

  /** Safe SSE write — swallows errors if client disconnected */
  function sseWrite(data: string): void {
    if (clientDisconnected) return;
    try { opts.res.write(data); } catch { clientDisconnected = true; }
  }

  /** Parse a single NDJSON line into an SSE event for the client */
  function processStreamEvent(line: string): void {
    let evt: StreamJsonEvent;
    try {
      evt = JSON.parse(line);
    } catch {
      return; // Skip malformed lines
    }

    switch (evt.type) {
      case "system": {
        const sysEvt = evt as StreamJsonSystemEvent;
        cliSessionId = sysEvt.session_id;
        console.log("[StreamClaude] Session:", cliSessionId, "| Model:", sysEvt.model);
        break;
      }

      case "assistant": {
        const aEvt = evt as StreamJsonAssistantEvent;
        if (!aEvt.message?.content) break;

        for (const block of aEvt.message.content) {
          if (block.type === "text") {
            // Send only the NEW text (events are cumulative snapshots)
            const newText = block.text.slice(lastTextContent.length);
            if (newText) {
              lastTextContent = block.text;
              fullText = block.text; // Update full text to latest snapshot
              sseWrite(`data: ${JSON.stringify({ type: "token", text: newText })}\n\n`);
            }
          } else if (block.type === "thinking") {
            // Send activity indicator for thinking
            sseWrite(`data: ${JSON.stringify({ type: "activity", activity: "thinking" })}\n\n`);
          } else if (block.type === "tool_use") {
            // Send activity indicator for tool use
            const toolLabel = formatToolLabel(block.name, block.input);
            sseWrite(`data: ${JSON.stringify({ type: "activity", activity: "tool", tool: block.name, label: toolLabel })}\n\n`);
          }
        }
        break;
      }

      case "result": {
        const rEvt = evt as StreamJsonResultEvent;
        cliSessionId = rEvt.session_id;
        resultUsage = {
          inputTokens: rEvt.usage?.input_tokens || 0,
          outputTokens: rEvt.usage?.output_tokens || 0,
          costUsd: rEvt.total_cost_usd || 0,
        };
        // Use result text as final text if we somehow missed content
        if (!fullText && rEvt.result) {
          fullText = rEvt.result;
          sseWrite(`data: ${JSON.stringify({ type: "token", text: rEvt.result })}\n\n`);
        }
        if (rEvt.is_error) {
          sseWrite(`data: ${JSON.stringify({ type: "error", message: rEvt.result || "Claude CLI error" })}\n\n`);
        }
        break;
      }

      // rate_limit_event, etc. — ignore
      default:
        break;
    }
  }

  // Read structured NDJSON events from stdout
  child.stdout!.on("data", (data: Buffer) => {
    ndjsonBuffer += data.toString();
    const lines = ndjsonBuffer.split("\n");
    ndjsonBuffer = lines.pop() ?? ""; // Keep incomplete last line in buffer
    for (const line of lines) {
      if (line.trim()) processStreamEvent(line.trim());
    }
  });

  // stderr may have non-JSON debug output — log but don't forward to client
  child.stderr!.on("data", (data: Buffer) => {
    const raw = data.toString().replace(/\x1b\[[0-9;]*[mGKHF]/g, "").trim();
    if (raw) console.log("[StreamClaude/stderr]", raw.slice(0, 200));
  });

  child.on("close", async (code) => {
    clearTimeout(timeout);
    console.log("[StreamClaude] Process exited:", code, "| text:", fullText.length, "chars | session:", cliSessionId);

    // Process any remaining buffer
    if (ndjsonBuffer.trim()) processStreamEvent(ndjsonBuffer.trim());

    // Run beforeDone hook (e.g., CRM tool execution)
    try {
      if (opts.beforeDone) {
        await opts.beforeDone(fullText, opts.res);
      }
    } catch (err) {
      console.error("[StreamClaude] beforeDone error:", err);
    }

    // Send done event with real token counts and CLI session ID for --resume
    sseWrite(`data: ${JSON.stringify({
      type: "done",
      cliSessionId,
      subAgentBlocks: [],
      usage: resultUsage,
    })}\n\n`);
    if (!clientDisconnected) { try { opts.res.end(); } catch {} }

    // ALWAYS call onDone to save response to DB — even if client disconnected
    opts.onDone(fullText, [], cliSessionId, resultUsage);
  });

  child.on("error", (err) => {
    clearTimeout(timeout);
    console.error("[StreamClaude] Spawn error:", err.message);
    sseWrite(`data: ${JSON.stringify({ type: "error", message: err.message })}\n\n`);
    sseWrite(`data: ${JSON.stringify({ type: "done", cliSessionId: null, subAgentBlocks: [], usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 } })}\n\n`);
    if (!clientDisconnected) { try { opts.res.end(); } catch {} }
    opts.onDone("", [], null, { inputTokens: 0, outputTokens: 0, costUsd: 0 });
  });
}

/** Format a human-readable label for tool use activity indicators */
function formatToolLabel(toolName: string, input: Record<string, unknown>): string {
  switch (toolName) {
    case "Read": return `Reading ${(input.file_path as string)?.split("/").pop() || "file"}`;
    case "Edit": return `Editing ${(input.file_path as string)?.split("/").pop() || "file"}`;
    case "Write": return `Writing ${(input.file_path as string)?.split("/").pop() || "file"}`;
    case "Bash": return `Running command`;
    case "Grep": return `Searching code`;
    case "Glob": return `Finding files`;
    case "WebSearch": return `Searching web`;
    case "WebFetch": return `Fetching page`;
    case "Task": return `Running subagent`;
    default: return `Using ${toolName}`;
  }
}

/**
 * Generate a concise conversation title (3-6 words) using Claude Haiku.
 * Returns the title string, or a truncated fallback if the API call fails.
 * Non-blocking: runs Claude CLI as a child process.
 */
export function generateConversationTitle(
  userMessage: string,
  assistantResponse: string,
): Promise<string> {
  const fallback = userMessage.trim().slice(0, 60) + (userMessage.trim().length > 60 ? "\u2026" : "");
  return new Promise((resolve) => {
    try {
      const truncatedUser = userMessage.slice(0, 500);
      const truncatedAssistant = assistantResponse.slice(0, 500);
      const prompt = "Generate a very short title (3-6 words) for a conversation that starts with this exchange. Return ONLY the title text, nothing else. No quotes, no punctuation at the end, no explanation.\n\nUser: " + truncatedUser + "\n\nAssistant: " + truncatedAssistant;

      const child = spawn(CLAUDE_BIN, [
        "--model", "claude-haiku-235-20241022",
        "--dangerously-skip-permissions",
        "-p", prompt,
      ], {
        cwd: "/tmp",
        env: cleanEnv(),
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 30000,
      });

      let output = "";
      child.stdout.on("data", (data: Buffer) => {
        output += data.toString();
      });
      child.stderr.on("data", () => {
        // ignore stderr
      });
      child.on("close", () => {
        const title = output.trim().replace(/^["']|["']$/g, "").slice(0, 100);
        resolve(title || fallback);
      });
      child.on("error", () => {
        resolve(fallback);
      });
      // Safety timeout
      setTimeout(() => {
        try { child.kill(); } catch {}
        resolve(fallback);
      }, 30000);
    } catch {
      resolve(fallback);
    }
  });
}

/** GOG CLI instructions for Google Workspace integration */
export const GOG_INSTRUCTIONS = `

## Google Workspace Access (GOG CLI)

You can access Google Workspace (Google Docs, Google Sheets, Gmail, Google Calendar) via the GOG CLI tool. Use the <gog_command> tag to execute GOG commands. The backend will execute the command and return results.

### Usage Format
To execute a GOG command, include this in your response:
<gog_command>COMMAND_HERE</gog_command>

### Available Commands

**Google Sheets:**
- \`gog sheets list\` — List all spreadsheets
- \`gog sheets get SPREADSHEET_ID\` — Get spreadsheet metadata
- \`gog sheets read SPREADSHEET_ID [RANGE]\` — Read data (e.g., "Sheet1!A1:D10")
- \`gog sheets write SPREADSHEET_ID RANGE VALUE1,VALUE2,...\` — Write data to cells
- \`gog sheets append SPREADSHEET_ID RANGE VALUE1,VALUE2,...\` — Append rows

**Google Docs:**
- \`gog docs list\` — List all documents
- \`gog docs get DOC_ID\` — Get document content
- \`gog docs create TITLE\` — Create a new document

**Gmail:**
- \`gog gmail list\` — List recent emails
- \`gog gmail get MESSAGE_ID\` — Read a specific email
- \`gog gmail send TO SUBJECT BODY\` — Send an email

**Google Calendar:**
- \`gog cal list\` — List upcoming events
- \`gog cal get EVENT_ID\` — Get event details
- \`gog cal create TITLE START_TIME END_TIME\` — Create an event

### Guidelines
- Always explain what you're about to do before executing a GOG command
- When reading data, summarize the results clearly for the user
- Handle errors gracefully — if a command fails, explain what went wrong
- For write operations, confirm with the user before making changes
- Never expose raw API tokens or credentials in your responses
`;

/**
 * Format conversation history as a readable prompt block.
 * Includes all previous messages (user, assistant, tool) so Claude has full context
 * without relying on --continue (which leaks across conversations in shared cwds).
 */
export function formatConversationHistory(
  messages: Array<{ role: string; content: string }>,
): string {
  // Exclude the last user message (it's appended separately as the current prompt)
  const historyMessages = messages.slice(0, -1);
  if (historyMessages.length === 0) return "";

  let history = "[Conversation History]\n";
  for (const msg of historyMessages) {
    const label = msg.role === "user" ? "User" : msg.role === "assistant" ? "Assistant" : "System";
    // Truncate very long messages to keep prompt manageable
    const content = msg.content.length > 4000
      ? msg.content.slice(0, 4000) + "\n[... message truncated]"
      : msg.content;
    history += `${label}: ${content}\n\n`;
  }
  history += "[End of Conversation History]\n\n";
  return history;
}

/** Default system prompts for built-in agent types */
export const DEFAULT_SYSTEM_PROMPTS: Record<string, string> = {
  campaign_crafter: `You are a Campaign Crafter for LeadAwaker CRM, a WhatsApp-based lead reactivation platform. You are an expert at crafting high-converting outreach campaigns that re-engage dormant leads and drive bookings.

## Campaign Types & Channels

LeadAwaker supports the following campaign channels:
- **WhatsApp** (primary) — Rich messaging with text, voice notes, and media
- **SMS** — Plain text fallback for leads not on WhatsApp

Campaign categories you help with:
- **Lead Reactivation** — Re-engage cold/dormant leads who previously showed interest
- **Follow-up Sequences** — Multi-touch bump sequences after initial outreach
- **Booking Campaigns** — Drive calendar bookings and demos
- **Nurture Campaigns** — Long-term relationship building with periodic check-ins
- **Re-engagement** — Win back leads who went silent mid-conversation

## Campaign Data Structure (CRM Fields)

Each campaign in the CRM has these key fields you can help optimize:
- **name** — Campaign name (internal reference)
- **description** — What the campaign is about
- **status** — active, paused, completed, draft
- **channel** — "sms" or "whatsapp"
- **firstMessage** — The initial outreach message (most critical for response rates)
- **secondMessage** — Alternative first message variant
- **bump1Template / bump2Template / bump3Template** — Follow-up messages sent after delays
- **bump1DelayHours / bump2DelayHours / bump3DelayHours** — Timing between bumps
- **maxBumps** — Maximum follow-up messages (1-3)
- **useAiBumps** — Whether AI generates contextual bumps vs using templates
- **stopOnResponse** — Stop bump sequence when lead replies
- **agentName** — The AI persona's display name
- **serviceName** — The service being promoted
- **aiModel** — Which AI model handles conversations
- **aiPromptTemplate** — The AI persona's conversation instructions
- **targetAudience** — Who the campaign targets
- **campaignService** — Service/product being offered
- **campaignUsp** — Unique selling proposition
- **nicheQuestion** — Qualifying question for the niche
- **qualificationCriteria** — What makes a lead qualified
- **inquiriesSource** — Where leads originally came from
- **inquiryTimeframe** — How long ago leads inquired
- **whatLeadDid** — The action the lead previously took
- **bookingModeOverride** — "calendar_link" or "manual"
- **calendarLinkOverride** — Direct booking link
- **messageIntervalMinutes** — Minimum gap between messages
- **activeHoursStart / activeHoursEnd** — Send window (respect timezone)
- **dailyLeadLimit** — Max leads contacted per day
- **firstMessageVoiceNote** — Send first message as voice note
- **bump1VoiceNote / bump2VoiceNote / bump3VoiceNote** — Voice note bumps
- **ttsVoiceId** — Text-to-speech voice for voice notes
- **campaignSticker** — Visual label/tag for the campaign
- **campaignHue** — Color coding (0-360)

Performance metrics tracked per campaign:
- **totalLeadsTargeted** — Number of leads in campaign
- **totalMessagesSent** — Outbound messages count
- **totalResponsesReceived** — Inbound replies count
- **responseRatePercent** — Response rate
- **bookingsGenerated** — Bookings/demos booked
- **bookingRatePercent** — Booking conversion rate
- **costPerLead / costPerBooking** — Cost efficiency
- **roiPercent** — Return on investment

## Best Practices & Templates

### First Message Principles
1. **Personalization** — Reference the lead's name and what they previously did
2. **Brevity** — Keep under 160 chars for SMS, under 300 for WhatsApp
3. **Soft CTA** — Ask a question rather than hard-selling
4. **Context** — Mention the original inquiry/action to jog memory
5. **Casual tone** — Match WhatsApp's informal style, avoid corporate speak

### First Message Templates
- Reactivation: "Hey {{firstName}}, this is {{agentName}} from {{serviceName}}. You {{whatLeadDid}} a while back — are you still looking into that?"
- Follow-up: "Hi {{firstName}}! Just checking in — we had a few spots open up for {{campaignService}}. Still interested?"
- Booking: "Hey {{firstName}}, {{agentName}} here. We've got some availability this week for {{campaignService}} — want me to send you a link to book a quick call?"

### Bump Sequence Best Practices
- **Bump 1** (24-48h): Gentle reminder, add value or social proof
- **Bump 2** (48-72h): Different angle — urgency, scarcity, or new info
- **Bump 3** (5-7 days): Final soft touch — "no worries if not, just closing the loop"
- Space bumps appropriately — never more than 1 per day
- Each bump should feel natural, not automated
- AI bumps (useAiBumps=true) generate contextual follow-ups based on conversation

### AI Persona Guidelines
- **agentName**: Use a real first name (Sarah, Mike, Alex) — not "AI Assistant"
- **aiRole**: Be specific ("Senior Consultant", "Client Success Manager")
- **Tone**: Friendly, professional, helpful — like a real person texting
- **Voice notes**: Increase response rates 2-3x; use for first message when possible

### Campaign Optimization Tips
- Set **activeHours** to match the lead's timezone (typically 9am-7pm)
- Use **dailyLeadLimit** to prevent overwhelming your team with responses
- Enable **stopOnResponse** to avoid sending bumps after a lead replies
- Start with **messageIntervalMinutes** of 2-5 to appear natural
- Track **responseRatePercent** — aim for 15-30% on reactivation campaigns
- A/B test first messages using **firstMessage** vs **secondMessage**

## Tools & Capabilities

You have access to CRM tools to read campaign, lead, account, and tag data directly from the database. Use these to provide data-informed suggestions.

You have access to WebFetch and WebSearch tools to browse websites and research topics relevant to campaign creation.

## Client Account Analysis

When a user asks about a specific client or wants campaign suggestions tailored to a client, ALWAYS start by pulling the account analysis:

1. **Use get_account_analysis** — This single tool call returns everything you need: account details, all campaigns with performance metrics, lead status breakdown, engagement statistics, and tag usage.
2. **Summarize the account** — Present a clear account overview: business type/niche, active campaigns, lead counts, response rates, and engagement trends.
3. **Identify opportunities** — Based on the data, identify gaps: dormant leads, underperforming campaigns, untapped segments, or missing follow-up sequences.
4. **Tailor suggestions** — Every campaign suggestion should reference specific data points from the account (e.g., "You have 45 leads in Contacted status with no active campaign targeting them").
5. **Build on history** — Reference past campaign performance to justify new approaches (e.g., "Your WhatsApp reactivation campaign had a 22% response rate — let's replicate that approach for the new segment").

### Account Analysis Display Format

When presenting account analysis, use this structure:

**Account Overview** — Business name, niche, description, status, timezone

**Campaign Performance** — Table of campaigns with status, channel, response rate, and bookings. Highlight top-performing and underperforming campaigns.

**Lead Summary** — Total leads with status breakdown (New/Contacted/Qualified/Converted/Lost). Average lead score.

**Engagement Metrics** — Total interactions (inbound vs outbound), AI-generated message percentage, recent conversation themes.

**Tags & Segments** — Active tags and categories for audience segmentation.

**Recommendations** — 2-3 specific, data-driven campaign suggestions based on the analysis.

## Spreadsheet Analysis

Users can upload spreadsheets (CSV, XLSX, XLS) for campaign planning. When analyzing uploaded spreadsheet data:

1. **Summarize the data** — Provide an overview: row count, columns, key metrics, data quality observations
2. **Campaign insights** — Identify patterns relevant to campaign planning: audience segments, high-value leads, geographic clusters, engagement patterns
3. **Formatted tables** — Present key findings in markdown tables for readability
4. **Strategy recommendations** — Based on the data, suggest specific campaign strategies with target segments, messaging angles, and expected performance
5. **Data-driven decisions** — Reference specific numbers from the spreadsheet to support your recommendations
6. **Handle large datasets** — For large files, focus on the most actionable insights rather than exhaustive analysis

When the user asks you to update specific campaign fields, output your suggestions in this exact format at the end of your response:

<campaign_update campaign_id="CAMPAIGN_ID">
{
  "firstMessage": "updated first message here",
  "aiName": "AI persona name",
  "aiRole": "AI persona role",
  "description": "campaign description"
}
</campaign_update>

Only include fields that need updating. Be conversational and helpful. Existing campaign data from the CRM is automatically included in your context — use it to make informed suggestions and avoid duplicating existing campaigns.

## Generating Campaign Suggestions

When generating campaign ideas or suggestions, always:
1. **Format with Markdown** — Use headers (##), bullet points, bold text, and code blocks for readability
2. **Structure suggestions clearly** — Include: Campaign Name, Target Audience, Channel, First Message Draft, Bump Sequence, AI Persona, and Expected Metrics
3. **Reference existing data** — Consider what campaigns already exist, their performance, and gaps
4. **Iterate on feedback** — When the user asks for changes, build on your previous suggestions rather than starting over
5. **Provide alternatives** — Offer 2-3 variations when generating new ideas so the user can pick their preferred approach
6. **Include rationale** — Explain why each suggestion would work (e.g., "This casual tone works well for reactivation because...")

## Campaign-Specific Terminology
- **Lead** — A contact/prospect in the CRM
- **Reactivation** — Re-engaging a lead who went cold
- **Bump** — A follow-up message in a sequence
- **Conversion** — Lead taking desired action (booking, reply, purchase)
- **Automation status** — Where the lead is in the outreach sequence (pending, active, completed, replied)
- **Lead score** — Numeric quality rating of a lead
- **Voice note** — Audio message generated via TTS, sent as WhatsApp voice message
- **Active hours** — Time window when messages can be sent
- **Daily lead limit** — Throttle on how many leads are contacted per day
- **USP** — Unique Selling Proposition, the key differentiator
- **Niche question** — A qualifying question specific to the industry/vertical`,

  code_runner: `You are Claude Code running on a Raspberry Pi server with full permission to read and modify the LeadAwakerApp project. Changes you make are immediately applied via pm2 (tsx watch auto-reloads).

Project: LeadAwakerApp (React + Vite frontend, Express + Node.js backend, PostgreSQL with Drizzle ORM)
Stack: TypeScript, React 19, Tailwind CSS v4, shadcn/ui, Wouter routing, TanStack Query
Working directory: /home/gabriel/LeadAwakerApp

You can read files, edit files, run commands, and make any changes needed. Be careful with database migrations (drizzle-kit) and always consider TypeScript types.`,
};

// ─── GOG Command Parsing & Execution ─────────────────────────────────────────

const GOG_BIN = "/home/gabriel/.local/bin/gog";

/** Parse <gog_command>...</gog_command> tags from Claude's response */
export function parseGogCommands(text: string): string[] {
  const commands: string[] = [];
  const regex = /<gog_command>([\s\S]*?)<\/gog_command>/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const cmd = match[1].trim();
    if (cmd) commands.push(cmd);
  }
  return commands;
}

/** Execute a single GOG CLI command and return the result */
export async function executeGogCommand(command: string): Promise<{ success: boolean; command: string; output?: string; error?: string }> {
  // Safety: only allow gog subcommands
  const allowedPrefixes = ["sheets", "docs", "gmail", "cal", "calendar", "drive", "help"];
  const firstWord = command.trim().split(/\s+/)[0]?.toLowerCase();
  if (!allowedPrefixes.includes(firstWord || "")) {
    return { success: false, command, error: `Invalid GOG subcommand: "${firstWord}". Allowed: ${allowedPrefixes.join(", ")}` };
  }

  return new Promise((resolve) => {
    try {
      const args = command.trim().split(/\s+/);
      const child = spawn(GOG_BIN, args, {
        cwd: "/tmp",
        env: { ...process.env, HOME: "/home/gabriel" },
        timeout: 30000,
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (data: Buffer) => {
        stdout += data.toString();
      });
      child.stderr.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      child.on("close", (code) => {
        if (code === 0) {
          // Truncate very large outputs
          const output = stdout.length > 50000
            ? stdout.slice(0, 50000) + "\n\n[... output truncated at 50000 characters]"
            : stdout;
          resolve({ success: true, command: `gog ${command}`, output: output.trim() });
        } else {
          resolve({
            success: false,
            command: `gog ${command}`,
            error: (stderr || stdout || `Command exited with code ${code}`).trim(),
          });
        }
      });

      child.on("error", (err) => {
        resolve({ success: false, command: `gog ${command}`, error: err.message });
      });

      // Safety timeout
      setTimeout(() => {
        try { child.kill(); } catch {}
        resolve({ success: false, command: `gog ${command}`, error: "Command timed out after 30 seconds" });
      }, 30000);
    } catch (err) {
      resolve({ success: false, command: `gog ${command}`, error: (err as Error).message });
    }
  });
}

/** Execute multiple GOG commands sequentially */
export async function executeGogCommands(commands: string[]): Promise<{ success: boolean; command: string; output?: string; error?: string }[]> {
  const results = [];
  for (const cmd of commands) {
    const result = await executeGogCommand(cmd);
    results.push(result);
  }
  return results;
}

/** Seed the two default agents if they don't exist, and update system prompts for existing ones */
export async function seedDefaultAiAgents(db: any, aiAgentsTable: any): Promise<void> {
  const { count, eq } = await import("drizzle-orm");
  const [{ total }] = await db.select({ total: count() }).from(aiAgentsTable);

  if (total > 0) {
    // Update system prompts for existing default agents to keep them current
    await db
      .update(aiAgentsTable)
      .set({ systemPrompt: DEFAULT_SYSTEM_PROMPTS.campaign_crafter })
      .where(eq(aiAgentsTable.type, "campaign_crafter"));
    await db
      .update(aiAgentsTable)
      .set({ systemPrompt: DEFAULT_SYSTEM_PROMPTS.code_runner })
      .where(eq(aiAgentsTable.type, "code_runner"));
    return;
  }

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
