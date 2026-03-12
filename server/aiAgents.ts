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
  /** Model override (e.g. claude-sonnet-4-20250514) */
  model?: string;
  /** Thinking level: none, low, medium, high */
  thinkingLevel?: string;
  /** Optional async callback that runs BEFORE the done event and res.end(). Use for CRM tool execution. */
  beforeDone?: (fullText: string, res: Response) => Promise<void>;
  onDone: (fullText: string, subAgentBlocks: SubAgentBlock[]) => void;
}): void {
  const args: string[] = [];
  if (opts.bypassPermissions) args.push("--dangerouslySkipPermissions");
  if (!opts.isFirstMessage) args.push("--continue");

  // Pass model if specified
  if (opts.model) {
    args.push("--model", opts.model);
  }

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

  child.on("close", async () => {
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

    // Run beforeDone hook (e.g., CRM tool execution) before closing the stream
    try {
      if (opts.beforeDone) {
        await opts.beforeDone(fullText, opts.res);
      }
    } catch (err) {
      console.error("[StreamClaude] beforeDone error:", err);
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
