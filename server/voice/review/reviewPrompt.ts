/**
 * The weekly voice call review: the prompt for the Claude opus run and the parser for its
 * JSON answer. Pure (no db), so it is tested without a model. The data comes from
 * server/storage/voiceReviews.ts, the run itself is in the review runner.
 */
import type { PromptLang, ProposalInput, ReviewDto, ReviewReport, ReviewStats } from "@shared/voiceReview";
import { MAX_PROPOSALS } from "@shared/voiceReview";
import { extractJsonObject } from "../../aiTextHelper";
import { cleanCopy } from "./promptEdits";
import type { ToolEventLite, TranscriptTurn } from "../../storage/voiceReviews";

export const REVIEW_TIMEOUT_MS = 600_000;
export const MAX_TRANSCRIPT_CALLS = 40;
export const TRANSCRIPT_CHARS_PER_CALL = 6000;

const CUT_MARKER = "[rest of the call cut]";

export interface ReviewCallForPrompt {
  callId: string;
  startedAt: string;
  outcome: string | null;
  endReason: string | null;
  latencyMs: number | null;
  latencyP90Ms: number | null;
  tools: ToolEventLite[];
  transcript: TranscriptTurn[] | null;
}

export interface ReviewPromptInput {
  accountName: string;
  periodStart: string;
  periodEnd: string;
  stats: ReviewStats;
  previous: ReviewDto | null;
  rules: string;
  prompts: Partial<Record<PromptLang, string>>;
  knowledge: { title: string; content: string }[];
  rejected: { find: string; replace: string }[];
  calls: ReviewCallForPrompt[];
}

// ─── Transcripts ─────────────────────────────────────────────────────────────

/** Whole turns in order while the running text length stays within `maxChars`; a marker when anything was dropped. */
export function clipTranscript(turns: TranscriptTurn[], maxChars: number): TranscriptTurn[] {
  const kept: TranscriptTurn[] = [];
  let used = 0;
  for (const t of turns) {
    if (used + t.text.length > maxChars) return [...kept, { role: "agent", text: CUT_MARKER }];
    kept.push(t);
    used += t.text.length;
  }
  return kept;
}

// ─── Answer schema ───────────────────────────────────────────────────────────

const strings = { type: "array", items: { type: "string" } };

export const REVIEW_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "comparison", "problems", "worstCalls", "knowledgeBase", "proposals"],
  properties: {
    summary: { type: "string" },
    comparison: { type: "string" },
    problems: {
      type: "array", maxItems: 5,
      items: {
        type: "object", additionalProperties: false, required: ["title", "detail", "callIds"],
        properties: { title: { type: "string" }, detail: { type: "string" }, callIds: strings },
      },
    },
    worstCalls: {
      type: "array", maxItems: 3,
      items: {
        type: "object", additionalProperties: false, required: ["callId", "why"],
        properties: { callId: { type: "string" }, why: { type: "string" } },
      },
    },
    knowledgeBase: { type: "array", maxItems: 3, items: { type: "string" } },
    proposals: {
      type: "array", maxItems: MAX_PROPOSALS,
      items: {
        type: "object", additionalProperties: false,
        required: ["language", "title", "reason", "find", "replace", "mirrorFind", "mirrorReplace", "callIds"],
        properties: {
          language: { type: "string", enum: ["nl", "en"] },
          title: { type: "string" },
          reason: { type: "string" },
          find: { type: "string" },
          replace: { type: "string" },
          mirrorFind: { type: ["string", "null"] },
          mirrorReplace: { type: ["string", "null"] },
          callIds: strings,
        },
      },
    },
  },
};

// ─── Prompt ──────────────────────────────────────────────────────────────────

const TASK = `You review the ElevenLabs phone calls of one account for one period.

Write the report in English. When you quote a caller, keep the caller's own language.
Keep the report short: the summary is one line, at most 5 problems of one line each, at most 3 worst calls, and the comparison is one line against the previous review (or "No earlier review" when there is none).

Proposals are surgical find and replace edits of the live prompt:
- \`find\` is copied verbatim from the live prompt of that language and occurs exactly once in it.
- When the same rule exists in the other language, add the mirror edit (\`mirrorFind\`, \`mirrorReplace\`) copied from that language's prompt. Otherwise set both to null.
- Never invent {marks}: only use template marks that the live prompt already uses.
- Never use em dashes.
- Prefer removing or rewording a conflicting line over adding a louder one.
- Do not repeat an edit from the rejected list unless the new calls show the same problem again.
- Wording of the knowledge base goes in \`knowledgeBase\`, never in proposals.
- Only cite call ids from the list of calls.
- Propose nothing when the calls do not show a clear prompt problem.

Answer with the JSON object of the given schema only.`;

const pad = (n: number) => String(n).padStart(2, "0");
const amsterdamParts = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Amsterdam", hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric",
  hour: "numeric", minute: "numeric",
});

/** "YYYY-MM-DD HH:mm" in Europe/Amsterdam; the input unchanged when it is not a date. */
function amsterdamTime(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return iso;
  const p: Record<string, string> = {};
  for (const part of amsterdamParts.formatToParts(at)) p[part.type] = part.value;
  return `${p.year}-${pad(Number(p.month))}-${pad(Number(p.day))} ${pad(Number(p.hour))}:${pad(Number(p.minute))}`;
}

const section = (title: string, body: string) => `## ${title}\n${body}`;

function previousSection(prev: ReviewDto | null): string {
  const r = prev?.report;
  if (!prev || !r) return "None";
  const problems = r.problems.length ? r.problems.map((p) => `- ${p.title}: ${p.detail}`).join("\n") : "- none";
  return `Period ${prev.periodStart} to ${prev.periodEnd}\nSummary: ${r.summary}\nComparison: ${r.comparison}\nProblems:\n${problems}`;
}

function callBlock(c: ReviewCallForPrompt): string {
  const latency = c.latencyMs == null ? "unknown" : `${c.latencyMs} ms (p90 ${c.latencyP90Ms ?? "unknown"} ms)`;
  const tools = c.tools.length
    ? c.tools.map((t) => `  - ${t.tool} [${t.status ?? "no status"}]${t.error ? ` error: ${t.error}` : ""} ${t.args}`.trimEnd()).join("\n")
    : "  none";
  const transcript = c.transcript
    ? c.transcript.map((t) => `${t.role === "caller" ? "Caller" : "Agent"}: ${t.text}`).join("\n")
    : "(transcript not included)";
  return [
    `### ${c.callId}`,
    `Start: ${amsterdamTime(c.startedAt)} (Europe/Amsterdam)`,
    `Outcome: ${c.outcome ?? "unknown"}`,
    `End reason: ${c.endReason ?? "unknown"}`,
    `Latency: ${latency}`,
    `Tools:\n${tools}`,
    `Transcript:\n${transcript}`,
  ].join("\n");
}

export function buildReviewPrompt(input: ReviewPromptInput): { system: string; user: string } {
  const knowledge = input.knowledge.length
    ? input.knowledge.map((k) => `### ${k.title}\n${k.content}`).join("\n\n")
    : "(empty)";
  const rejected = input.rejected.length
    ? input.rejected.map((r) => `- find: ${JSON.stringify(r.find)}\n  replace: ${JSON.stringify(r.replace)}`).join("\n")
    : "None";
  const calls = input.calls.length ? input.calls.map(callBlock).join("\n\n") : "(no calls)";
  const user = [
    section("Account and period", `Account: ${input.accountName}\nPeriod: ${input.periodStart} to ${input.periodEnd}`),
    section("Stats", JSON.stringify(input.stats)),
    section("Previous review", previousSection(input.previous)),
    section("Live prompt NL", input.prompts.nl ?? "(not available)"),
    section("Live prompt EN", input.prompts.en ?? "(not available)"),
    section("Knowledge base", knowledge),
    section("Rejected edits", rejected),
    section("Calls", calls),
  ].join("\n\n");
  return { system: `${input.rules}\n\n${TASK}`, user };
}

// ─── Answer ──────────────────────────────────────────────────────────────────

export type ParsedReview =
  | { ok: true; report: ReviewReport; proposals: ProposalInput[] }
  | { ok: false; reason: "not_json" | "bad_shape" };

const MAX_PROBLEMS = 5;
const MAX_WORST_CALLS = 3;
const MAX_KNOWLEDGE_ITEMS = 3;

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown): v is string => typeof v === "string";

// A malformed report never gets this far: it throws here and parseReviewAnswer reports bad_shape (a malformed proposal is only skipped).
class BadShape extends Error {}
const need = <T>(v: T | undefined): T => { if (v === undefined) throw new BadShape(); return v; };

const clip = (s: string, max: number) => cleanCopy(s).slice(0, max).trimEnd();

/** Em dashes become commas like cleanCopy, but the text keeps the whitespace it started and ended with. */
function cleanKeepEdges(s: string): string {
  const lead = /^\s*/.exec(s)![0];
  const trail = /\s*$/.exec(s.slice(lead.length))![0];
  return lead + cleanCopy(s.slice(lead.length, s.length - trail.length)) + trail;
}

const stringList = (v: unknown): string[] => (Array.isArray(v) ? v.filter(str) : []);
/** The first `max` items of an array of objects. */
const objects = (v: unknown, max: number): Record<string, unknown>[] => {
  if (!Array.isArray(v)) throw new BadShape();
  return v.slice(0, max).map((x) => need(isObject(x) ? x : undefined));
};

function readProposal(o: Record<string, unknown>): ProposalInput {
  const language = need(o.language === "nl" || o.language === "en" ? o.language : undefined);
  // `find` and `mirrorFind` must match the live prompt byte for byte: never cleaned or clipped.
  const find = need(str(o.find) ? o.find : undefined);
  // A mirror needs both halves: a mirrorFind without a string mirrorReplace drops the mirror, not the proposal.
  const hasMirror = str(o.mirrorFind) && o.mirrorFind !== "" && str(o.mirrorReplace);
  const mirrorFind = hasMirror ? (o.mirrorFind as string) : null;
  const mirrorReplace = hasMirror ? cleanKeepEdges(o.mirrorReplace as string) : null;
  return {
    language,
    title: clip(need(str(o.title) ? o.title : undefined), 120),
    reason: clip(need(str(o.reason) ? o.reason : undefined), 500),
    find,
    replace: cleanKeepEdges(need(str(o.replace) ? o.replace : undefined)),
    mirrorFind,
    mirrorReplace,
    callIds: stringList(o.callIds),
  };
}

/** Parse the model's JSON answer. Text fields are cleaned of em dashes and cut to their limits. */
export function parseReviewAnswer(text: string): ParsedReview {
  const json = extractJsonObject(text);
  if (json === null) return { ok: false, reason: "not_json" };
  let data: unknown;
  try { data = JSON.parse(json); } catch { return { ok: false, reason: "not_json" }; }
  try {
    const o = need(isObject(data) ? data : undefined);
    const report: ReviewReport = {
      summary: clip(need(str(o.summary) ? o.summary : undefined), 300),
      comparison: clip(need(str(o.comparison) ? o.comparison : undefined), 300),
      problems: objects(o.problems, MAX_PROBLEMS).map((p) => ({
        title: clip(need(str(p.title) ? p.title : undefined), 120),
        detail: clip(need(str(p.detail) ? p.detail : undefined), 300),
        callIds: stringList(p.callIds),
      })),
      worstCalls: objects(o.worstCalls, MAX_WORST_CALLS).map((w) => ({
        callId: need(str(w.callId) ? w.callId : undefined),
        why: clip(need(str(w.why) ? w.why : undefined), 160),
      })),
      knowledgeBase: need(Array.isArray(o.knowledgeBase) && o.knowledgeBase.every(str) ? (o.knowledgeBase as string[]) : undefined)
        .slice(0, MAX_KNOWLEDGE_ITEMS).map((k) => clip(k, 300)),
      droppedProposals: 0,
    };
    // A malformed proposal is skipped and counted, never the reason to lose the whole report.
    if (!Array.isArray(o.proposals)) throw new BadShape();
    const proposals: ProposalInput[] = [];
    for (const item of o.proposals.slice(0, MAX_PROPOSALS)) {
      try {
        proposals.push(readProposal(need(isObject(item) ? item : undefined)));
      } catch (err) {
        if (!(err instanceof BadShape)) throw err;
        report.droppedProposals++;
      }
    }
    return { ok: true, report, proposals };
  } catch (err) {
    if (err instanceof BadShape) return { ok: false, reason: "bad_shape" };
    throw err;
  }
}
