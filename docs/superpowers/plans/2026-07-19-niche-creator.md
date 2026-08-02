# Niche Creator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an agency user type a niche name on the campaign Behavior tab and have AI generate a full Niche_Vocabulary row + fill the campaign's Business/AI fields, with per-option delete in the dropdown and the Generate button moved into the settings footer.

**Architecture:** A new agency-only endpoint `POST /api/niche-vocabulary/generate` calls a Claude-first (sonnet, subscription) → OpenAI (gpt-5.4-mini) chain to synthesize a complete niche row, persisted through the existing `storage.setNicheVocabulary` + `storage.setNicheTemplate`. The `NicheSelect` dropdown gains a "+ New niche…" inline creator (which chains the generate call, a `/api/niches` refetch, and the existing `/api/campaigns/:id/generate` field-fill) plus a per-option delete guarded server-side against in-use niches (409). The existing Generate popover relocates from `DetailViewToolbar` into the `CampaignSettingsLayout` footer, flat-styled, replacing the Prev-nav button.

**Tech Stack:** Express + Drizzle (server), React + TanStack + shadcn/ui + react-i18next (client), Claude CLI + OpenAI (generation).

## Global Constraints

- App runs via **pm2** (`leadawaker`, port 5000, watch on) — never `npm run dev`. `server/` + `shared/` auto-reload in ~5-8s after save. **Never run `tsc`** unless Gabriel asks.
- **No test runner exists** for this code path. Each task's "test" is an explicit manual verification: a `node --env-file=.env` DB/query script, a `curl`, or a browser check via playwright-cli (`leadawaker@gmail.com` / `Admin1234`). Do not scaffold jest/vitest.
- **i18n:** every user-facing string goes through `t()`; add keys to `client/src/locales/en/campaigns.json` and `client/src/locales/nl/campaigns.json`. No `pt` (product is en+nl). No hardcoded strings.
- **Dark mode is live:** never hardcode `bg-white`/hex; use CSS tokens (`var(--paper)`, `var(--ink)`, `var(--wine)`, `var(--line)`, `var(--mute)`).
- CRM tables live in Postgres schema `p2mxx34fvbf3ll6`; the Niche_Vocabulary raw table name is `"p2mxx34fvbf3ll6"."Niche_Vocabulary"`.
- OpenAI env var is `OPEN_AI_API_KEY` (not `OPENAI_API_KEY`). gpt-5.4-mini requires `max_completion_tokens` and rejects custom `temperature`.
- Claude CLI: `CLAUDE_BIN = /home/gabriel/.npm-global/bin/claude`, must run with `cleanClaudeEnv()` (deletes `CLAUDECODE` etc.).
- Model constant: reuse `NICHE_GENERATOR_MODEL` exported from `server/demo-session.ts` (`"gpt-5.4-mini"`).
- Commit after each task with `--no-verify` scoped to the touched files (repo has unrelated uncommitted work — never `git add -A`).

---

### Task 1: Extend aiTextHelper with a Claude-first large-completion chain

**Files:**
- Modify: `server/aiTextHelper.ts`

**Interfaces:**
- Produces: `export async function completeTextLarge(prompt: string, systemPrompt?: string, opts?: { claudeModel?: string; timeoutMs?: number; maxTokens?: number }): Promise<string | null>` — tries Claude (`opts.claudeModel ?? "sonnet"`, `opts.timeoutMs ?? 60_000`) then OpenAI gpt-5.4-mini (`opts.maxTokens ?? 3500`, same timeout), **skipping Groq**. Returns trimmed text or null.

- [ ] **Step 1: Generalize the Claude call to accept a model + timeout**

Replace the existing `tryHaiku` function (lines 29-45) with a general `tryClaude` plus a thin `tryHaiku` wrapper so existing callers are unchanged:

```typescript
/** Single completion via Claude CLI at an arbitrary model/timeout. Returns null on error. */
async function tryClaude(prompt: string, model: string, timeoutMs: number): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(
      CLAUDE_BIN,
      ["-p", prompt, "--model", model, "--max-turns", "1"],
      { timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024, env: cleanClaudeEnv() },
      (err, stdout) => {
        if (err || !stdout?.trim()) {
          if (err) console.warn(`[aiTextHelper] Claude ${model} failed:`, err.message);
          return resolve(null);
        }
        resolve(stdout.trim());
      },
    );
  });
}

/** Single completion via Claude Haiku. Returns null on error. */
async function tryHaiku(prompt: string): Promise<string | null> {
  return tryClaude(prompt, "haiku", CLAUDE_TIMEOUT_MS);
}
```

- [ ] **Step 2: Add the exported `completeTextLarge` chain**

Add after `completeText` (end of file):

```typescript
/**
 * Larger structured completion (e.g. a full niche vocabulary row).
 * Claude (default sonnet, 60s) first — subscription, no per-call cost — then
 * OpenAI gpt-5.4-mini. Groq is skipped: the 8B model is unreliable for large
 * structured JSON. Returns null only if BOTH providers fail.
 */
export async function completeTextLarge(
  prompt: string,
  systemPrompt?: string,
  opts?: { claudeModel?: string; timeoutMs?: number; maxTokens?: number },
): Promise<string | null> {
  const claudeModel = opts?.claudeModel ?? "sonnet";
  const timeoutMs = opts?.timeoutMs ?? 60_000;
  const maxTokens = opts?.maxTokens ?? 3500;

  const claude = await tryClaude(
    systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt,
    claudeModel,
    timeoutMs,
  );
  if (claude) return claude;

  const apiKey = process.env.OPEN_AI_API_KEY;
  if (!apiKey) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
          { role: "user", content: prompt },
        ],
        max_completion_tokens: maxTokens,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn("[aiTextHelper] OpenAI (large) error:", res.status);
      return null;
    }
    const json = await res.json() as any;
    const text = json.choices?.[0]?.message?.content?.trim();
    return text || null;
  } catch (err: any) {
    console.warn("[aiTextHelper] OpenAI (large) fetch failed:", err.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
```

- [ ] **Step 3: Verify it compiles + resolves via a scratch script**

Run (after pm2 reload):
```bash
cd /home/gabriel/LeadAwakerApp && node --env-file=.env -e "
import('./server/aiTextHelper.ts').catch(async () => {
  const { completeTextLarge } = await import('./dist/aiTextHelper.js');
});
" 2>&1 | head -5 || echo "note: run the real check in Task 2 (route uses it)"
```
Expected: no throw. (The helper is exercised end-to-end in Task 2; this step only confirms the module loads.)

- [ ] **Step 4: Commit**

```bash
git commit --no-verify -o server/aiTextHelper.ts -m "Add completeTextLarge Claude-first chain for niche generation

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Niche row generator module

**Files:**
- Create: `server/nicheGenerator.ts`

**Interfaces:**
- Consumes: `completeTextLarge` (Task 1); `storage.setNicheVocabulary`, `storage.setNicheTemplate` (existing); `promptLibrary` schema, `db` (existing).
- Produces: `export async function generateAndSaveNicheRow(niche: string): Promise<{ warnings: string[] } | null>` — synthesizes a full row, persists terms + templates + packs, returns the list of fields that came back empty (as `warnings`). Returns `null` only when the terms are unusable (hard fail).

- [ ] **Step 1: Create the module with the fallback system prompt + generator**

```typescript
/**
 * Niche row generator — synthesizes a complete Niche_Vocabulary row (5 term
 * groups en+nl, 4 example packs en+nl, 3 business templates) from a niche name
 * and persists it via storage. Claude-first via completeTextLarge (Task 1).
 *
 * The system prompt is loaded from Prompt_Library (useCase "niche_row_generator")
 * so it's editable from the Prompts UI, falling back to the constant below.
 */
import { eq } from "drizzle-orm";
import { db } from "./db";
import { promptLibrary } from "@shared/schema";
import { storage } from "./storage";
import { completeTextLarge, stripFences } from "./aiTextHelper";

type LangPack = { en: string; nl: string };
type Groups = {
  projectTerm: string[]; proposalTerm: string[]; decisionTerm: string[];
  advisorTerm: string[]; visitTerm: string[];
};

const EMPTY_GROUPS = (): Groups => ({
  projectTerm: [], proposalTerm: [], decisionTerm: [], advisorTerm: [], visitTerm: [],
});
const EMPTY_PACK = (): LangPack => ({ en: "", nl: "" });

export const NICHE_ROW_GENERATOR_SYSTEM_FALLBACK = `You generate a complete vocabulary + example row for a lead-reactivation AI, for one business niche.

Return ONE JSON object, no prose, no markdown fences, with EXACTLY these keys:
{
  "nl": { "projectTerm": [], "proposalTerm": [], "decisionTerm": [], "advisorTerm": [], "visitTerm": [] },
  "en": { "projectTerm": [], "proposalTerm": [], "decisionTerm": [], "advisorTerm": [], "visitTerm": [] },
  "companyNameTemplate": { "en": "", "nl": "" },
  "descriptionTemplate": { "en": "", "nl": "" },
  "kbTemplate": { "en": "", "nl": "" },
  "questionBank": { "en": "", "nl": "" },
  "badExamples": { "en": "", "nl": "" },
  "objectionExamples": { "en": "", "nl": "" },
  "scenarioExamples": { "en": "", "nl": "" }
}

Term groups (2-5 natural words/phrases each, lowercase):
- projectTerm: what the customer is buying/doing (e.g. "implant treatment", "kitchen renovation").
- proposalTerm: the offer/quote noun (e.g. "treatment plan", "quote").
- decisionTerm: the customer's decision noun (e.g. "decision", "keuze").
- advisorTerm: who advises the customer (e.g. "dental implant specialist", "kitchen designer").
- visitTerm: the meeting/appointment noun (e.g. "consultation", "afspraak").

"nl" = Dutch, "en" = English. Both languages fully filled.

Templates and packs are short text blocks. They MAY use the placeholders {project_term}, {proposal_term}, {advisor_term}, {visit_term} which are substituted at runtime:
- companyNameTemplate: a realistic sample company name for this niche.
- descriptionTemplate: 1-2 sentence business description.
- kbTemplate: 3-5 short knowledge-base bullet lines (pricing ranges, process, guarantees).
- questionBank: 3-5 qualifying questions the AI could ask a lead in this niche.
- badExamples: 2-3 short lines of phrasing to AVOID in this niche.
- objectionExamples: 2-3 objection/response PAIRS (objection line, then a suggested reframe line).
- scenarioExamples: 2-3 short "if lead says X, do Y" playbook lines.

Be specific to the niche. Never output kitchen/home-improvement content unless the niche is actually that.`;

async function loadSystemPrompt(): Promise<string> {
  try {
    const [row] = await db
      .select({ promptText: promptLibrary.promptText })
      .from(promptLibrary)
      .where(eq(promptLibrary.useCase, "niche_row_generator"))
      .limit(1);
    if (row?.promptText) return row.promptText;
  } catch {
    // fall through to constant
  }
  return NICHE_ROW_GENERATOR_SYSTEM_FALLBACK;
}

function coerceGroups(src: any): Groups {
  const g = EMPTY_GROUPS();
  for (const k of Object.keys(g) as (keyof Groups)[]) {
    const arr = src?.[k];
    g[k] = Array.isArray(arr) ? arr.filter((w: unknown): w is string => typeof w === "string").map((w) => w.trim()).filter(Boolean) : [];
  }
  return g;
}

function coercePack(src: any): LangPack {
  const toStr = (v: unknown) => (Array.isArray(v) ? v.join("\n") : (v ?? "").toString()).trim();
  return { en: toStr(src?.en), nl: toStr(src?.nl) };
}

export async function generateAndSaveNicheRow(niche: string): Promise<{ warnings: string[] } | null> {
  const system = await loadSystemPrompt();
  const raw = await completeTextLarge(`Business niche: ${niche}`, system, { maxTokens: 3500 });
  if (!raw) return null;

  let parsed: any;
  try {
    parsed = JSON.parse(stripFences(raw));
  } catch {
    return null;
  }

  const nl = coerceGroups(parsed?.nl);
  const en = coerceGroups(parsed?.en);
  // Hard fail if neither language has any advisor/project terms — row is unusable.
  const hasTerms = [...Object.values(nl), ...Object.values(en)].some((a) => a.length > 0);
  if (!hasTerms) return null;

  const templates = {
    companyNameTemplate: coercePack(parsed?.companyNameTemplate),
    descriptionTemplate: coercePack(parsed?.descriptionTemplate),
    kbTemplate: coercePack(parsed?.kbTemplate),
    questionBank: coercePack(parsed?.questionBank),
    badExamples: coercePack(parsed?.badExamples),
    objectionExamples: coercePack(parsed?.objectionExamples),
    scenarioExamples: coercePack(parsed?.scenarioExamples),
  };

  const warnings: string[] = [];
  for (const [key, pack] of Object.entries(templates)) {
    if (!pack.en && !pack.nl) warnings.push(key);
  }

  // Persist: terms via setNicheVocabulary, templates+packs via setNicheTemplate.
  await storage.setNicheVocabulary(niche, { nl, en });
  await storage.setNicheTemplate(niche, templates);

  return { warnings };
}
```

- [ ] **Step 2: Verify generation end-to-end against a throwaway niche**

Run:
```bash
cd /home/gabriel/LeadAwakerApp && node --env-file=.env --experimental-strip-types -e "
import('./server/nicheGenerator.ts').then(async ({ generateAndSaveNicheRow }) => {
  const r = await generateAndSaveNicheRow('Dentists');
  console.log('warnings:', r?.warnings);
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
"
```
Expected: prints `warnings: [...]` (ideally empty). If `--experimental-strip-types` is unavailable, instead verify via the Task 3 route once wired.

- [ ] **Step 3: Confirm the row landed with a real shape (not kitchen fallback)**

Run:
```bash
cd /home/gabriel/LeadAwakerApp && node --env-file=.env -e "
const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  await c.query('SET search_path TO p2mxx34fvbf3ll6');
  const { rows } = await c.query(\`SELECT niche, advisor_terms_en::text, question_bank::text FROM \\\"Niche_Vocabulary\\\" WHERE niche='Dentists'\`);
  console.log(rows);
  await c.end();
})();
"
```
Expected: one row; `advisor_terms_en` contains dentist-specific terms; `question_bank` has dentist questions.

- [ ] **Step 4: Clean up the throwaway row**

```bash
cd /home/gabriel/LeadAwakerApp && node --env-file=.env -e "
const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  await c.query('SET search_path TO p2mxx34fvbf3ll6');
  await c.query(\`DELETE FROM \\\"Niche_Vocabulary\\\" WHERE niche='Dentists'\`);
  console.log('deleted');
  await c.end();
})();
"
```
Expected: `deleted`.

- [ ] **Step 5: Commit**

```bash
git commit --no-verify -o server/nicheGenerator.ts -m "Add niche row generator (Claude-first, persists terms+templates)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: `POST /api/niche-vocabulary/generate` route

**Files:**
- Modify: `server/routes/accounts.ts` (after the PUT at line ~335, before the DELETE at line ~337)

**Interfaces:**
- Consumes: `generateAndSaveNicheRow` (Task 2), `storage.listNicheNames` (existing).
- Produces: route `POST /api/niche-vocabulary/generate` → `{ niche: string, existed: boolean, warnings: string[] }`; 400 on empty niche, 502 on generation failure.

- [ ] **Step 1: Import the generator at the top of the file**

Add to the existing import block near the other server-local imports:
```typescript
import { generateAndSaveNicheRow } from "../nicheGenerator";
```

- [ ] **Step 2: Add the route**

Insert immediately before `app.delete("/api/niche-vocabulary/:niche", ...)` (currently line ~337):

```typescript
  // Generate a full niche row (terms + templates + packs) from just a name.
  // Agency-only. If the niche already exists, returns it untouched (existed:true).
  app.post("/api/niche-vocabulary/generate", requireAgency, wrapAsync(async (req, res) => {
    const rawNiche = typeof req.body?.niche === "string" ? req.body.niche.trim() : "";
    if (!rawNiche) return res.status(400).json({ message: "niche is required" });
    // Title Case so "dental clinic" and "Dental Clinic" don't create two rows.
    const niche = rawNiche.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
    if (niche === "__default__") return res.status(400).json({ message: "reserved niche name" });

    const existingNames = await storage.listNicheNames();
    if (existingNames.includes(niche)) {
      return res.json({ niche, existed: true, warnings: [] });
    }

    const result = await generateAndSaveNicheRow(niche);
    if (!result) return res.status(502).json({ message: "Niche generation failed — try again" });
    res.json({ niche, existed: false, warnings: result.warnings });
  }));
```

- [ ] **Step 3: Verify the route is wired (server auto-reloaded)**

Run:
```bash
pm2 logs leadawaker --lines 5 --nostream | tail -5
```
Expected: no startup error mentioning `nicheGenerator` or the new route. (Auth is session-based, so verify the actual generate happy-path via the UI in Task 6, or by temporarily testing the module directly as in Task 2.)

- [ ] **Step 4: Commit**

```bash
git commit --no-verify -o server/routes/accounts.ts -m "Add POST /api/niche-vocabulary/generate route

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Delete guard for in-use niches

**Files:**
- Modify: `server/storage/campaigns.ts` (add a query helper)
- Modify: `server/storage.ts` (barrel — only if the campaigns methods aren't already spread in; verify first)
- Modify: `server/routes/accounts.ts` (DELETE route, line ~337)

**Interfaces:**
- Produces: `storage.campaignsUsingNiche(niche: string): Promise<Array<{ id: number; name: string }>>` — campaigns whose `niche` column equals the given value.

- [ ] **Step 1: Add the storage helper**

In `server/storage/campaigns.ts`, add to the exported campaigns storage object (match the file's existing method style; it imports `db`, `campaigns`, `eq` from drizzle):

```typescript
  async campaignsUsingNiche(niche: string): Promise<Array<{ id: number; name: string }>> {
    const rows = await db
      .select({ id: campaigns.id, name: campaigns.name })
      .from(campaigns)
      .where(eq(campaigns.niche, niche));
    return rows.map((r) => ({ id: r.id, name: r.name ?? `#${r.id}` }));
  },
```

If `campaigns.niche` is not a column on the Drizzle table, use a raw query instead:
```typescript
  async campaignsUsingNiche(niche: string): Promise<Array<{ id: number; name: string }>> {
    const { rows } = await db.execute(sql`
      SELECT id, name FROM "p2mxx34fvbf3ll6"."Campaigns" WHERE niche = ${niche}
    `);
    return (rows as any[]).map((r) => ({ id: Number(r.id), name: r.name ?? `#${r.id}` }));
  },
```
(Verify which form applies by checking whether `campaigns.niche` exists in `shared/schema.ts` before writing this step's code. Import `sql` from `drizzle-orm` if using the raw form.)

- [ ] **Step 2: Confirm the barrel exposes it**

Run:
```bash
grep -n "campaignsUsingNiche\|...campaignsStorage\|campaignsStorage" server/storage.ts server/storage/campaigns.ts | head
```
Expected: the campaigns storage object is spread into the barrel `storage` (so the new method is automatically available). If methods are individually re-exported, add `campaignsUsingNiche` to that list.

- [ ] **Step 3: Replace the DELETE route body with the guard**

In `server/routes/accounts.ts`, replace the current DELETE handler (lines ~337-341):

```typescript
  app.delete("/api/niche-vocabulary/:niche", requireAgency, wrapAsync(async (req, res) => {
    const niche = req.params.niche.trim();
    if (niche === "__default__") {
      return res.status(400).json({ message: "the default niche cannot be deleted" });
    }
    const inUse = await storage.campaignsUsingNiche(niche);
    if (inUse.length > 0) {
      return res.status(409).json({
        message: "This niche is used by active campaigns.",
        campaigns: inUse,
      });
    }
    const ok = await storage.deleteNicheVocabulary(niche);
    if (!ok) return res.status(400).json({ message: "cannot delete this niche" });
    res.json({ ok: true });
  }));
```

- [ ] **Step 4: Verify the guard with a DB-backed check**

Run (finds a niche currently used by a campaign, confirms the query returns it):
```bash
cd /home/gabriel/LeadAwakerApp && node --env-file=.env -e "
const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  await c.query('SET search_path TO p2mxx34fvbf3ll6');
  const { rows } = await c.query('SELECT niche, count(*) FROM \\\"Campaigns\\\" WHERE niche IS NOT NULL GROUP BY niche ORDER BY count DESC LIMIT 5');
  console.log(rows);
  await c.end();
})();
"
```
Expected: a list of in-use niches. Deleting any of these via the UI (Task 6) must 409.

- [ ] **Step 5: Commit**

```bash
git commit --no-verify -o server/storage/campaigns.ts server/routes/accounts.ts -m "Guard niche delete against in-use campaigns (409)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Relocate the Generate button to the settings footer

**Files:**
- Create: `client/src/features/campaigns/components/settings/CampaignGenerateButton.tsx`
- Modify: `client/src/features/campaigns/components/detailView/DetailViewToolbar.tsx` (remove popover)
- Modify: `client/src/features/campaigns/components/settings/CampaignSettingsLayout.tsx` (footer + prop)
- Modify: `client/src/features/campaigns/components/CampaignStageEditor.tsx` (thread `onGenerated`)
- Modify: `client/src/features/campaigns/components/detailView/DetailViewBody.tsx` (thread `onGenerated`)
- Modify: `client/src/features/campaigns/components/detailView/CampaignDetailView.tsx` (pass `onRefresh` into body)

**Interfaces:**
- Produces: `<CampaignGenerateButton campaign={campaign} onGenerated={() => void} />` — self-contained flat footer button + popover; posts `/api/campaigns/:id/generate`, toasts filled/translated, calls `onGenerated`.
- `CampaignSettingsLayout`, `CampaignStageEditor`, `DetailViewBody` each gain an optional `onGenerated?: () => void`.

- [ ] **Step 1: Create the self-contained button (logic lifted from DetailViewToolbar, flat footer styling)**

```tsx
import { useState, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, RefreshCw } from "lucide-react";
import type { Campaign } from "@/types/models";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiUtils";
import { parseLangField, isFilled } from "@shared/langField";

const CONTEXT_FIELD_KEYS = [
  "description", "nicheQuestion", "kb",
  "campaignUsp", "aiStyleOverride", "whatLeadDid", "serviceName",
] as const;

function hasEmptyFields(campaign: any): boolean {
  return CONTEXT_FIELD_KEYS.some((k) => {
    const raw = campaign[k];
    if (!raw && raw !== 0) return true;
    const f = parseLangField(raw);
    const isMirrored = f.en && f.nl && f.en === f.nl;
    return isMirrored || (!isFilled(raw, "en") && !isFilled(raw, "nl"));
  });
}

export function CampaignGenerateButton({
  campaign,
  onGenerated,
}: {
  campaign: Campaign;
  onGenerated?: () => void;
}) {
  const { t } = useTranslation("campaigns");
  const { toast } = useToast();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [niche, setNiche] = useState("");
  const [generating, setGenerating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const needsNiche = useMemo(() => hasEmptyFields(campaign), [campaign]);

  const handleGenerate = async () => {
    if (generating) return;
    if (needsNiche && !niche.trim()) return;
    setGenerating(true);
    try {
      const id = (campaign as any).id || (campaign as any).Id;
      const body: Record<string, string> = {};
      if (niche.trim()) body.niche = niche.trim();
      const res = await apiFetch(`/api/campaigns/${id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).message || "Generation failed");
      }
      const data = await res.json();
      const filledFields: string[] = data.filledFields ?? [];
      const translatedFields: string[] = data.translatedFields ?? [];
      setPopoverOpen(false);
      setNiche("");
      onGenerated?.();
      if (!filledFields.length && !translatedFields.length) {
        toast({ title: t("toolbar.nothingToDo", "Nothing to do"), description: t("toolbar.allComplete", "All fields already have both languages.") });
      } else {
        const parts: string[] = [];
        if (filledFields.length) parts.push(`${t("toolbar.filled", "Filled")}: ${filledFields.join(", ")}`);
        if (translatedFields.length) parts.push(`${t("toolbar.translated", "Translated")}: ${translatedFields.join(", ")}`);
        toast({ title: t("toolbar.done", "Done"), description: parts.join(" · ") });
      }
    } catch (err: any) {
      toast({ title: t("toolbar.generateFailed", "Generation failed"), description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Popover
      open={popoverOpen}
      onOpenChange={(v) => {
        setPopoverOpen(v);
        if (v && needsNiche) setTimeout(() => inputRef.current?.focus(), 50);
      }}
    >
      <PopoverTrigger asChild>
        <button
          className="la-btn"
          style={{
            fontFamily: "Geist Mono, ui-monospace, monospace", fontSize: 10, letterSpacing: "0.14em",
            textTransform: "uppercase", gap: 8, display: "inline-flex", alignItems: "center",
            background: "var(--paper)", border: "none", boxShadow: "none", color: "var(--ink)", cursor: "pointer",
          }}
          title={t("toolbar.generate", "Generate / Translate")}
        >
          <Sparkles style={{ width: 14, height: 14, color: "var(--wine)" }} />
          {t("toolbar.generate", "Generate / Translate")}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-3">
        {needsNiche ? (
          <>
            <p className="text-[11px] text-muted-foreground mb-2">
              {t("toolbar.generateHint", "Type a niche — AI fills empty fields in EN + NL and translates any single-language fields.")}
            </p>
            <div className="flex gap-2">
              <input
                ref={inputRef}
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleGenerate(); }}
                placeholder={t("toolbar.nichePlaceholder", "e.g. dental clinic, solar, gym")}
                className="flex-1 h-8 rounded-md border border-black/[0.125] bg-background px-2.5 text-[12px] outline-none focus:border-brand-indigo transition-colors"
              />
              <button
                onClick={handleGenerate}
                disabled={!niche.trim() || generating}
                className="h-8 w-8 rounded-full bg-brand-indigo text-white disabled:opacity-50 hover:bg-brand-indigo/90 transition-colors flex items-center justify-center shrink-0"
                title={t("toolbar.generate", "Generate")}
              >
                {generating ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-[11px] text-muted-foreground mb-2">
              {t("toolbar.translateHint", "All fields are filled. Click to translate any single-language fields to add the missing language.")}
            </p>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="w-full h-8 rounded-md bg-brand-indigo text-white text-[12px] font-semibold disabled:opacity-50 hover:bg-brand-indigo/90 transition-colors flex items-center justify-center gap-1.5"
            >
              {generating ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              {t("toolbar.translate", "Translate missing languages")}
            </button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 2: Strip the Generate popover from DetailViewToolbar**

In `DetailViewToolbar.tsx`, delete the entire `{activeTab === "configurations" && ( <Popover>...</Popover> )}` block (lines ~115-176) and the now-unused helpers/state: `CONTEXT_FIELD_KEYS`, `hasEmptyFields`, `handleGenerate`, `popoverOpen`, `niche`, `generating`, `inputRef`, `needsNiche`, and the `Popover`/`Sparkles`/`parseLangField`/`isFilled`/`useMemo`/`useRef` imports if no longer referenced. Keep the `onBack` button and the `detail.saving` indicator. The component's returned JSX becomes just the back button + saving indicator wrapper.

- [ ] **Step 3: Add `onGenerated` to CampaignSettingsLayout and render the button in the footer**

In `CampaignSettingsLayout.tsx`: add `onGenerated?: () => void;` to `CampaignSettingsLayoutProps`, import the button (`import { CampaignGenerateButton } from "./CampaignGenerateButton";`), and replace the Prev-nav button (lines ~159-166) with:

```tsx
            <CampaignGenerateButton campaign={props.campaign} onGenerated={props.onGenerated} />
```

Leave the Launch button and Next button unchanged.

- [ ] **Step 4: Thread `onGenerated` through CampaignStageEditor**

In `CampaignStageEditor.tsx`: add `onGenerated?: () => void;` to `CampaignStageEditorProps`, destructure it, and pass `onGenerated={onGenerated}` to `<CampaignSettingsLayout>`.

- [ ] **Step 5: Thread `onGenerated` through DetailViewBody**

In `DetailViewBody.tsx`: add `onGenerated?: () => void;` to `DetailViewBodyProps`, destructure it, and pass `onGenerated={onGenerated}` on the desktop `<CampaignStageEditor>` (line ~124).

- [ ] **Step 6: Pass `onRefresh` down from CampaignDetailView**

In `CampaignDetailView.tsx`, on the `<DetailViewBody ... />` (line ~441), add:
```tsx
        onGenerated={onRefresh}
```
(Mobile `MobileCampaignDetailPanel` does not have an `onRefresh`; leave its `<CampaignStageEditor>` without `onGenerated` — the button still generates; the sheet reflects changes on next open. No change needed there.)

- [ ] **Step 7: Verify in the browser (playwright-cli)**

Log in (`leadawaker@gmail.com` / `Admin1234`), open a demo campaign's Configurations → any tab. Expected: footer left slot shows a flat "GENERATE / TRANSLATE" button (paper background, no border/shadow), no old wine icon button in the top toolbar. Click it → popover opens; on a campaign with empty fields it asks for a niche; generating fills fields and toasts. Check light + dark theme.

- [ ] **Step 8: Commit**

```bash
git commit --no-verify -o \
  client/src/features/campaigns/components/settings/CampaignGenerateButton.tsx \
  client/src/features/campaigns/components/detailView/DetailViewToolbar.tsx \
  client/src/features/campaigns/components/settings/CampaignSettingsLayout.tsx \
  client/src/features/campaigns/components/CampaignStageEditor.tsx \
  client/src/features/campaigns/components/detailView/DetailViewBody.tsx \
  client/src/features/campaigns/components/detailView/CampaignDetailView.tsx \
  -m "Relocate campaign Generate button to settings footer (flat style)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: NicheSelect — per-option delete + "+ New niche…" creator

**Files:**
- Create: `client/src/features/campaigns/components/settings/NicheSelect.tsx` (extracted from BehaviorSectionFields)
- Modify: `client/src/features/campaigns/components/settings/BehaviorSectionFields.tsx` (import the extracted component; pass `campaign` + `onNicheChange`)

**Interfaces:**
- Consumes: `POST /api/niche-vocabulary/generate` (Task 3), `DELETE /api/niche-vocabulary/:niche` (Task 4), `GET /api/niches`, `POST /api/campaigns/:id/generate`.
- Produces: `<NicheSelect value campaign onChange onNicheChange autoFocus />` where `onNicheChange` is the template auto-fill callback and `onChange` sets the draft.

- [ ] **Step 1: Extract NicheSelect into its own file with delete + create**

Create `NicheSelect.tsx`:

```tsx
import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, X, Plus, Sparkles } from "lucide-react";
import { Select, SelectTrigger, SelectContent, SelectItem } from "@/components/ui/select";
import { apiFetch } from "@/lib/apiUtils";
import { resolveNicheIcon } from "@/features/prompts/components/niche/nicheShared";
import { useToast } from "@/hooks/use-toast";

export function NicheSelect({
  value, campaign, onChange, onNicheChange, autoFocus,
}: {
  value: string;
  campaign: any;
  onChange: (v: string) => void;
  onNicheChange?: (niche: string) => void;
  autoFocus?: boolean;
}) {
  const { t } = useTranslation("campaigns");
  const { toast } = useToast();
  const [niches, setNiches] = useState<string[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [creating, setCreating] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [newNiche, setNewNiche] = useState("");

  const loadNiches = useCallback(() => {
    return apiFetch("/api/niches")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("fetch failed"))))
      .then((data: string[]) => {
        setNiches(Array.isArray(data) ? data : []);
        setStatus("ready");
        return data as string[];
      })
      .catch(() => {
        setNiches([]);
        setStatus("error");
        toast({ title: t("nicheLoadError"), variant: "destructive" });
        return [] as string[];
      });
  }, [t, toast]);

  useEffect(() => { loadNiches(); }, [loadNiches]);

  const applyNiche = useCallback(async (niche: string) => {
    onChange(niche);
    onNicheChange?.(niche);
    // Fill empty Business/AI fields bilingually via the existing endpoint.
    try {
      const id = campaign?.id || campaign?.Id;
      const res = await apiFetch(`/api/campaigns/${id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche }),
      });
      if (res.ok) {
        const data = await res.json();
        const filled: string[] = data.filledFields ?? [];
        const translated: string[] = data.translatedFields ?? [];
        if (filled.length || translated.length) {
          toast({ title: t("toolbar.done", "Done"), description: [...filled, ...translated].join(", ") });
        }
      }
    } catch { /* field fill is best-effort */ }
  }, [campaign, onChange, onNicheChange, t, toast]);

  const handleCreate = useCallback(async () => {
    const name = newNiche.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      const res = await apiFetch("/api/niche-vocabulary/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche: name }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).message || "Generation failed");
      }
      const data = await res.json();
      await loadNiches();
      setShowInput(false);
      setNewNiche("");
      if (data.warnings?.length) {
        toast({ title: t("niche.createdWithGaps", "Niche created"), description: t("niche.someFieldsEmpty", "Some fields came back empty and use defaults."), });
      } else {
        toast({ title: t("niche.created", "Niche created") });
      }
      await applyNiche(data.niche);
    } catch (err: any) {
      toast({ title: t("niche.createFailed", "Could not create niche"), description: err.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  }, [newNiche, creating, loadNiches, applyNiche, t, toast]);

  const handleDelete = useCallback(async (niche: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!window.confirm(t("niche.confirmDelete", { niche, defaultValue: `Delete niche "${niche}"?` }))) return;
    try {
      const res = await apiFetch(`/api/niche-vocabulary/${encodeURIComponent(niche)}`, { method: "DELETE" });
      if (res.status === 409) {
        const data = await res.json();
        const names = (data.campaigns ?? []).map((c: any) => c.name).join(", ");
        toast({ title: t("niche.inUse", "Niche in use"), description: names, variant: "destructive" });
        return;
      }
      if (!res.ok) throw new Error("delete failed");
      await loadNiches();
      toast({ title: t("niche.deleted", "Niche deleted") });
    } catch (err: any) {
      toast({ title: t("niche.deleteFailed", "Could not delete niche"), description: err.message, variant: "destructive" });
    }
  }, [loadNiches, t, toast]);

  const CurIcon = value ? resolveNicheIcon(value, false) : null;
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="la-input" autoFocus={autoFocus}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", gap: 8, boxSizing: "border-box", width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0, overflow: "hidden" }}>
          {status === "loading" && <Loader2 style={{ width: 14, height: 14, flexShrink: 0 }} className="animate-spin" />}
          {CurIcon && <CurIcon style={{ width: 14, height: 14, color: "var(--wine)", flexShrink: 0 }} />}
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value || t("selectNichePlaceholder")}</span>
        </div>
      </SelectTrigger>
      <SelectContent>
        {niches.map((niche) => {
          const Icon = resolveNicheIcon(niche, false);
          return (
            <SelectItem key={niche} value={niche} className="group">
              <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
                <Icon style={{ width: 14, height: 14, color: "var(--wine)", flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{niche}</span>
                <button
                  onClick={(e) => handleDelete(niche, e)}
                  className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity"
                  style={{ border: "none", background: "transparent", cursor: "pointer", padding: 2, display: "grid", placeItems: "center" }}
                  title={t("niche.delete", "Remove niche")}
                  aria-label={t("niche.delete", "Remove niche")}
                >
                  <X style={{ width: 13, height: 13, color: "var(--mute)" }} />
                </button>
              </div>
            </SelectItem>
          );
        })}

        {/* Inline create row — not a SelectItem so clicks don't select a value. */}
        <div style={{ borderTop: "1px solid var(--line)", marginTop: 4, paddingTop: 4 }}>
          {showInput ? (
            <div style={{ display: "flex", gap: 6, padding: "4px 6px" }} onKeyDown={(e) => e.stopPropagation()}>
              <input
                autoFocus
                value={newNiche}
                onChange={(e) => setNewNiche(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
                placeholder={t("niche.newPlaceholder", "e.g. Dentists")}
                className="flex-1 h-8 rounded-md border border-black/[0.125] bg-background px-2.5 text-[12px] outline-none focus:border-brand-indigo"
              />
              <button
                onClick={handleCreate}
                disabled={!newNiche.trim() || creating}
                className="h-8 px-2 rounded-md bg-brand-indigo text-white disabled:opacity-50 flex items-center gap-1 text-[11px] shrink-0"
                title={t("niche.create", "Create")}
              >
                {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                {creating ? t("niche.creating", "Creating…") : t("niche.create", "Create")}
              </button>
            </div>
          ) : (
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowInput(true); }}
              style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 8px", border: "none", background: "transparent", cursor: "pointer", color: "var(--wine)", fontSize: 13 }}
            >
              <Plus style={{ width: 14, height: 14 }} />
              {t("niche.new", "New niche…")}
            </button>
          )}
        </div>
      </SelectContent>
    </Select>
  );
}
```

- [ ] **Step 2: Wire BehaviorSectionFields to the extracted component**

In `BehaviorSectionFields.tsx`: delete the inline `NicheSelect` function (lines 20-72), add `import { NicheSelect } from "./NicheSelect";`, and update the usage (line ~112) to pass `campaign`:

```tsx
          <NicheSelect
            value={String(draft.niche ?? "")}
            campaign={campaign}
            onChange={(v) => {
              setDraft((d) => ({ ...d, niche: v }));
              onNicheChange?.(v);
            }}
            onNicheChange={onNicheChange}
            {...focusFor("niche")}
          />
```

Remove any now-unused imports from `BehaviorSectionFields.tsx` (`resolveNicheIcon`, `Loader2`, `Select*`, `apiFetch`, `useToast`) if nothing else in the file uses them (verify by grep before deleting).

- [ ] **Step 3: Verify create + delete in the browser (playwright-cli)**

On a demo campaign Behavior tab, open the niche dropdown. Expected: each option shows an x on hover; a "New niche…" row sits at the bottom. Click it → type "Dentists" → Create → spinner ~20-60s → "Dentists" appears selected, dropdown now lists it, Business/AI fields fill, toast shows filled fields. Reopen dropdown, hover "Dentists", click x → confirm → it disappears. Try deleting a niche used by a campaign → 409 toast naming the campaign.

- [ ] **Step 4: Clean up the test niche (if still present)**

```bash
cd /home/gabriel/LeadAwakerApp && node --env-file=.env -e "
const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect(); await c.query('SET search_path TO p2mxx34fvbf3ll6');
  await c.query(\`DELETE FROM \\\"Niche_Vocabulary\\\" WHERE niche='Dentists'\`);
  console.log('cleaned'); await c.end();
})();
"
```
Expected: `cleaned`.

- [ ] **Step 5: Commit**

```bash
git commit --no-verify -o \
  client/src/features/campaigns/components/settings/NicheSelect.tsx \
  client/src/features/campaigns/components/settings/BehaviorSectionFields.tsx \
  -m "Add niche creator + per-option delete to NicheSelect

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: i18n strings (en + nl)

**Files:**
- Modify: `client/src/locales/en/campaigns.json`
- Modify: `client/src/locales/nl/campaigns.json`

**Interfaces:**
- Consumes: the `t()` keys referenced in Tasks 5-6 (`niche.*`, plus existing `toolbar.*` and `selectNichePlaceholder`, `nicheLoadError`).

- [ ] **Step 1: Confirm which keys already exist**

Run:
```bash
grep -n "\"niche\"\|selectNichePlaceholder\|nicheLoadError\|\"toolbar\"" client/src/locales/en/campaigns.json | head
```
Expected: `toolbar`, `selectNichePlaceholder`, `nicheLoadError` already present (used by the old code). Only the new `niche.*` object needs adding.

- [ ] **Step 2: Add the `niche` block to `en/campaigns.json`**

Add this object at the top level (sibling of `toolbar`):
```json
  "niche": {
    "new": "New niche…",
    "newPlaceholder": "e.g. Dentists",
    "create": "Create",
    "creating": "Creating…",
    "created": "Niche created",
    "createdWithGaps": "Niche created",
    "someFieldsEmpty": "Some fields came back empty and use defaults.",
    "createFailed": "Could not create niche",
    "delete": "Remove niche",
    "confirmDelete": "Delete niche \"{{niche}}\"?",
    "deleted": "Niche deleted",
    "deleteFailed": "Could not delete niche",
    "inUse": "Niche in use"
  }
```

- [ ] **Step 3: Add the Dutch translations to `nl/campaigns.json`**

```json
  "niche": {
    "new": "Nieuwe niche…",
    "newPlaceholder": "bijv. Tandartsen",
    "create": "Aanmaken",
    "creating": "Bezig…",
    "created": "Niche aangemaakt",
    "createdWithGaps": "Niche aangemaakt",
    "someFieldsEmpty": "Sommige velden bleven leeg en gebruiken standaardwaarden.",
    "createFailed": "Niche aanmaken mislukt",
    "delete": "Niche verwijderen",
    "confirmDelete": "Niche \"{{niche}}\" verwijderen?",
    "deleted": "Niche verwijderd",
    "deleteFailed": "Niche verwijderen mislukt",
    "inUse": "Niche in gebruik"
  }
```

- [ ] **Step 4: Verify JSON validity**

Run:
```bash
cd /home/gabriel/LeadAwakerApp && node -e "JSON.parse(require('fs').readFileSync('client/src/locales/en/campaigns.json','utf8')); JSON.parse(require('fs').readFileSync('client/src/locales/nl/campaigns.json','utf8')); console.log('both valid')"
```
Expected: `both valid`.

- [ ] **Step 5: Commit**

```bash
git commit --no-verify -o client/src/locales/en/campaigns.json client/src/locales/nl/campaigns.json -m "Add niche-creator i18n strings (en+nl)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Post-implementation: seed the editable prompt (optional, one-time)

The generator falls back to `NICHE_ROW_GENERATOR_SYSTEM_FALLBACK` until a `Prompt_Library` row with `use_case = 'niche_row_generator'` exists. To make it editable from the Prompts UI, insert one row seeded from the constant:

```bash
cd /home/gabriel/LeadAwakerApp && node --env-file=.env -e "
const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect(); await c.query('SET search_path TO p2mxx34fvbf3ll6');
  // Paste NICHE_ROW_GENERATOR_SYSTEM_FALLBACK text as the prompt_text.
  console.log('Seed manually once the constant is finalized, or leave as fallback.');
  await c.end();
})();
"
```
Leaving it unseeded is fine — the fallback constant is authoritative until then.

## Self-Review notes

- **Spec coverage:** row generation (Task 2+3), delete guard (Task 4), NicheSelect x + create (Task 6), button relocation (Task 5), i18n (Task 7), Claude→OpenAI chain skipping Groq (Task 1). The `buildDraft` whitelist gotcha is already satisfied — `niche` is present at `useCampaignDetail.ts:297` — so no task is needed for it.
- **Out of scope (unchanged):** universal demo (campaign 60), pt localization, editing niches via Settings → Niche Words.
- **Type consistency:** `onGenerated?: () => void` used identically across CampaignGenerateButton, CampaignSettingsLayout, CampaignStageEditor, DetailViewBody; `generateAndSaveNicheRow` returns `{ warnings } | null` consumed by the route as `result.warnings`.
