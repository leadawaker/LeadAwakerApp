import i18n from "@/i18n";
// View mode
export type PromptViewMode = "list" | "table";
export const VIEW_MODE_KEY = "prompts-view-mode";

// Form data interface
export interface PromptFormData {
  name: string;
  promptText: string;
  systemMessage: string;
  model: string;
  temperature: string;
  maxTokens: string;
  status: string;
  useCase: string;
  notes: string;
  campaignsId: string;
}

export const EMPTY_FORM: PromptFormData = {
  name: "",
  promptText: "",
  systemMessage: "",
  model: "gpt-5.5",
  temperature: "0.7",
  maxTokens: "1000",
  status: "active",
  useCase: "",
  notes: "",
  campaignsId: "",
};

// Tier aliases: "terra-latest" etc. resolve to a real model id in the engine
// (automations tools/model_tiers.py), so a new release is a one-line change
// there. Keep MODEL_TIERS in step with that file; it is only used for labels.
export const MODEL_TIERS: Record<string, string> = {
  sol: "gpt-6.1-sol",
  terra: "gpt-6.1-terra",
  luna: "gpt-5.6-luna",
};
export const LATEST_MODEL_OPTIONS = ["terra-latest", "sol-latest", "luna-latest"];

/** Display text for a model value: "Terra (latest · gpt-6.1-terra)" for an alias, else the id. */
export function modelLabel(m: string): string {
  const tier = m.endsWith("-latest") ? m.slice(0, -"-latest".length) : "";
  if (!tier || !MODEL_TIERS[tier]) return m;
  return i18n.t("prompts:model.latest", { tier: tier[0].toUpperCase() + tier.slice(1), model: MODEL_TIERS[tier] });
}

/** Labels for every option in a model select, for EditSelect's `labels` prop. */
export function modelLabels(options: string[]): Record<string, string> {
  return Object.fromEntries(options.filter(Boolean).map((m) => [m, modelLabel(m)]));
}

// Order matters: the first entry is what a new campaign/prompt is nudged towards.
// terra-latest is the engine default (src/config.py). The 5.6+ families reject
// max_tokens and temperature, so only call sites that already send
// max_completion_tokens can use them.
export const MODEL_OPTIONS = [
  ...LATEST_MODEL_OPTIONS,
  "gpt-6.1-sol",
  "gpt-6.1-terra",
  "gpt-6-astra",
  "gpt-6-luna",
  "gpt-5.6-luna",
  "gpt-5.5",
  "gpt-5.4",
  "gpt-5.4-pro",
  "gpt-5.4-mini",
  "gpt-5.4-nano",
  "gpt-4.1",
  "gpt-4.1-mini",
  "gpt-4.1-nano",
  "deepseek-v4",
];

// Column definitions for table view
export type PromptColKey =
  | "name" | "campaign" | "model" | "status" | "score" | "useCase" | "version" | "updatedAt" | "actions";

export interface PromptColumnDef {
  key: PromptColKey;
  label: string;
  tKey?: string;
  width: number;
  defaultVisible?: boolean;
}

export const PROMPT_TABLE_COLUMNS: PromptColumnDef[] = [
  { key: "name",      label: "Name",         tKey: "columns.name",        width: 200, defaultVisible: true },
  { key: "campaign",  label: "Campaign",     tKey: "columns.campaign",    width: 160, defaultVisible: true },
  { key: "model",     label: "Model",        tKey: "columns.model",       width: 150, defaultVisible: true },
  { key: "status",    label: "Status",       tKey: "columns.status",      width: 100, defaultVisible: true },
  { key: "score",     label: "Score",        tKey: "columns.score",       width: 80,  defaultVisible: true },
  { key: "useCase",   label: "Use Case",     tKey: "columns.useCase",     width: 160, defaultVisible: false },
  { key: "version",   label: "Version",      tKey: "columns.version",     width: 70,  defaultVisible: false },
  { key: "updatedAt", label: "Last Updated", tKey: "columns.lastUpdated", width: 130, defaultVisible: true },
  { key: "actions",   label: "",                                           width: 90,  defaultVisible: true },
];

export const DEFAULT_VISIBLE_PROMPT_COLS: PromptColKey[] =
  PROMPT_TABLE_COLUMNS.filter((c) => c.defaultVisible !== false).map((c) => c.key);

// Sort options
export type PromptSortOption = "recent" | "name_asc" | "name_desc" | "score_desc" | "score_asc";

export const PROMPT_SORT_LABELS: Record<PromptSortOption, string> = {
  recent:     "Most Recent",
  name_asc:   "Name A → Z",
  name_desc:  "Name Z → A",
  score_desc: "Score ↓",
  score_asc:  "Score ↑",
};

// Group options
export type PromptGroupOption = "status" | "model" | "campaign" | "account" | "none";

export const PROMPT_GROUP_LABELS: Record<PromptGroupOption, string> = {
  status:   "Status",
  model:    "Model",
  campaign: "Campaign",
  account:  "Account",
  none:     "None",
};

// Helper: status badge classes (stone-gray system — no old green/gray borders)
export function getStatusBadgeClasses(status: string | null | undefined): string {
  const normalized = (status || "").toLowerCase().trim();
  if (normalized === "active") {
    return "bg-emerald-100/80 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
  }
  if (normalized === "archived") {
    return "bg-muted text-muted-foreground";
  }
  return "bg-muted text-muted-foreground/60";
}

export function getStatusLabel(status: string | null | undefined): string {
  const normalized = (status || "").trim();
  return normalized || "Unknown";
}

export function getScoreColorClasses(score: string | null | undefined): string {
  const num = parseFloat(score || "");
  if (isNaN(num)) return "text-muted-foreground";
  if (num >= 8) return "text-emerald-600 dark:text-emerald-400";
  if (num >= 6) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

// Helper: get prompt ID (handles id vs Id)
export function getPromptId(p: any): number {
  return p.id || p.Id;
}

/** The prompt's note, without the line the server writes on auto-created rows. */
export function promptNote(p: any): string {
  return String(p?.notes || "").replace(/^System prompt\s*[-\u2013\u2014]?\s*auto[- ]created.*$/im, "").trim();
}

export interface PromptVersion {
  id: number;
  promptsId: number;
  versionNumber: string;
  promptText: string | null;
  systemMessage: string | null;
  notes: string | null;
  label: string | null;
  savedAt: string;
  savedBy: string | null;
}

/**
 * A campaign's conversation prompt: the one a campaign talks with. Helper rows
 * that merely hang off a campaign (niche generator, recap, reschedule) are not.
 * Used for "served campaigns" names; the library tabs come from promptCategories.
 */
export function isCampaignPrompt(p: any): boolean {
  const campaignId = p?.campaignsId || p?.Campaigns_id;
  const useCase = String(p?.useCase ?? p?.use_case ?? "").toLowerCase().trim();
  return !!campaignId && useCase === "conversation";
}
