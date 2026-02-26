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
  model: "gpt-4o",
  temperature: "0.7",
  maxTokens: "1000",
  status: "active",
  useCase: "",
  notes: "",
  campaignsId: "",
};

export const MODEL_OPTIONS = [
  "gpt-4o",
  "gpt-4o-mini",
  "gpt-4-turbo",
  "gpt-3.5-turbo",
  "claude-3-5-sonnet-20241022",
  "claude-3-haiku-20240307",
];

// Column definitions for table view
export type PromptColKey =
  | "name" | "campaign" | "model" | "status" | "score" | "useCase" | "version" | "updatedAt" | "actions";

export interface PromptColumnDef {
  key: PromptColKey;
  label: string;
  width: number;
  defaultVisible?: boolean;
}

export const PROMPT_TABLE_COLUMNS: PromptColumnDef[] = [
  { key: "name",      label: "Name",         width: 200, defaultVisible: true },
  { key: "campaign",  label: "Campaign",     width: 160, defaultVisible: true },
  { key: "model",     label: "Model",        width: 150, defaultVisible: true },
  { key: "status",    label: "Status",       width: 100, defaultVisible: true },
  { key: "score",     label: "Score",        width: 80,  defaultVisible: true },
  { key: "useCase",   label: "Use Case",     width: 160, defaultVisible: false },
  { key: "version",   label: "Version",      width: 70,  defaultVisible: false },
  { key: "updatedAt", label: "Last Updated", width: 130, defaultVisible: true },
  { key: "actions",   label: "",             width: 90,  defaultVisible: true },
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
export type PromptGroupOption = "status" | "model" | "campaign" | "none";

export const PROMPT_GROUP_LABELS: Record<PromptGroupOption, string> = {
  status:   "Status",
  model:    "Model",
  campaign: "Campaign",
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
