// ── Shared types and constants for the Prospects feature ─────────────────────

export interface ProspectRow {
  [key: string]: any;
  Id?: number;
  id?: number;
  name?: string;
  company?: string;
  niche?: string;
  country?: string;
  city?: string;
  website?: string;
  phone?: string;
  email?: string;
  linkedin?: string;
  contact_name?: string;
  contact_role?: string;
  contact_email?: string;
  contact_phone?: string;
  contact_linkedin?: string;
  company_linkedin?: string;
  contact2_name?: string;
  contact2_role?: string;
  contact2_email?: string;
  contact2_phone?: string;
  contact2_linkedin?: string;
  source?: string;
  status?: string;
  priority?: string;
  notes?: string;
  next_action?: string;
  action?: string;
  Accounts_id?: number;
  created_at?: string;
  updated_at?: string;
  photo_url?: string;
  headline?: string;
  connection_count?: number;
  follower_count?: number;
  top_post?: string;
  ai_summary?: string;
}

export interface NewProspectForm {
  name: string;
  company: string;
  niche: string;
  country: string;
  city: string;
  website: string;
  phone: string;
  email: string;
  linkedin: string;
  contact_name: string;
  contact_role: string;
  contact_email: string;
  contact_phone: string;
  contact_linkedin: string;
  company_linkedin: string;
  contact2_name: string;
  contact2_role: string;
  contact2_email: string;
  contact2_phone: string;
  contact2_linkedin: string;
  source: string;
  status: string;
  priority: string;
  notes: string;
  next_action: string;
}

export type ProspectViewMode = "list" | "table" | "pipeline" | "followups" | "templates";
export type ProspectGroupBy = "status" | "niche" | "country" | "priority" | "date_created" | "date_updated" | "none";
export type ProspectSortBy = "recent" | "name_asc" | "name_desc" | "priority";

export type VirtualListItem =
  | { kind: "header"; label: string; count: number }
  | { kind: "prospect"; prospect: ProspectRow };

// ── Status colors ─────────────────────────────────────────────────────────────

export const PROSPECT_STATUS_HEX: Record<string, string> = {
  New:              "#3B82F6",
  Contacted:        "#818CF8",
  Responded:        "#3ACBDF",
  "Call Booked":    "#31D35C",
  "Demo Given":     "#AED62E",
  "Proposal Sent":  "#F7BF0E",
  Lost:             "#DC2626",
  Archived:         "#64748B",
};

export const PRIORITY_HEX: Record<string, string> = {
  Urgent: "#EF4444", urgent: "#EF4444",
  High:   "#F97316", high:   "#F97316",
  Medium: "#F59E0B", medium: "#F59E0B",
  Low:    "#9CA3AF", low:    "#9CA3AF",
};

export const SIGNAL_FILLED: Record<string, number> = {
  low: 0, Low: 0, medium: 1, Medium: 1, high: 2, High: 2, urgent: 3, Urgent: 3,
};
export const SIGNAL_COLOR: Record<string, string> = {
  low: "#9CA3AF", Low: "#9CA3AF",
  medium: "#F59E0B", Medium: "#F59E0B",
  high: "#F97316", High: "#F97316",
  urgent: "#EF4444", Urgent: "#EF4444",
};

export const INLINE_STATUS_OPTIONS = ["New", "Contacted", "Responded", "Call Booked", "Demo Given", "Proposal Sent", "Lost", "Archived"];
export const INLINE_PRIORITY_OPTIONS = ["low", "medium", "high", "urgent"];

// ── Niche colors ──────────────────────────────────────────────────────────────

export const NICHE_COLORS: { hex: string; bg: string; text: string }[] = [
  { hex: "#6366F1", bg: "#EEF2FF", text: "#4338CA" },
  { hex: "#F59E0B", bg: "#FFFBEB", text: "#B45309" },
  { hex: "#10B981", bg: "#ECFDF5", text: "#047857" },
  { hex: "#EC4899", bg: "#FDF2F8", text: "#BE185D" },
  { hex: "#8B5CF6", bg: "#F5F3FF", text: "#6D28D9" },
  { hex: "#14B8A6", bg: "#F0FDFA", text: "#0F766E" },
  { hex: "#F97316", bg: "#FFF7ED", text: "#C2410C" },
  { hex: "#3B82F6", bg: "#EFF6FF", text: "#1D4ED8" },
  { hex: "#EF4444", bg: "#FEF2F2", text: "#B91C1C" },
  { hex: "#84CC16", bg: "#F7FEE7", text: "#4D7C0F" },
  { hex: "#06B6D4", bg: "#ECFEFF", text: "#0E7490" },
  { hex: "#A855F7", bg: "#FAF5FF", text: "#7E22CE" },
];
export const FALLBACK_NICHE_COLOR = { hex: "#94A3B8", bg: "#F1F5F9", text: "#475569" };

export function buildNicheColorMap(niches: string[]): Map<string, typeof NICHE_COLORS[number]> {
  const sorted = Array.from(new Set(niches.map((n) => n.toLowerCase()))).sort();
  const map = new Map<string, typeof NICHE_COLORS[number]>();
  sorted.forEach((n, i) => map.set(n, NICHE_COLORS[i % NICHE_COLORS.length]));
  return map;
}

// ── Group / Sort metadata ─────────────────────────────────────────────────────

export const GROUP_TKEYS: Record<ProspectGroupBy, string> = {
  status:       "group.status",
  niche:        "group.niche",
  country:      "group.country",
  priority:     "group.priority",
  date_created: "group.dateCreated",
  date_updated: "group.dateUpdated",
  none:         "group.none",
};

export const SORT_TKEYS: Record<ProspectSortBy, string> = {
  recent:    "sort.mostRecent",
  name_asc:  "sort.nameAZ",
  name_desc: "sort.nameZA",
  priority:  "sort.priority",
};

export const STATUS_GROUP_ORDER = ["New", "Contacted", "In Progress", "Converted", "Archived"];
export const STATUS_FILTER_OPTIONS = ["New", "Contacted", "In Progress", "Converted", "Archived"];
export const DATE_BUCKET_ORDER = ["Today", "Yesterday", "This Week", "This Month", "Last 3 Months", "Older", "Unknown"];

// ── View tab definitions ──────────────────────────────────────────────────────

import { List, Table2, Kanban, FileText } from "lucide-react";

export const VIEW_TABS_CONFIG: { id: ProspectViewMode; tKey: string; icon: typeof List }[] = [
  { id: "list",      tKey: "views.list",      icon: List   },
  { id: "table",     tKey: "views.table",     icon: Table2 },
  { id: "pipeline",  tKey: "views.pipeline",  icon: Kanban },
  { id: "templates", tKey: "views.templates", icon: FileText },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

export function getProspectId(p: ProspectRow): number {
  return p.Id ?? p.id ?? 0;
}

export function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "";
    const diffMs = Date.now() - date.getTime();
    const diffDays = Math.floor(diffMs / 86_400_000);
    if (diffDays === 0) {
      const h = Math.floor(diffMs / 3_600_000);
      return h === 0 ? "Just now" : `${h}h ago`;
    }
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return `${Math.floor(diffDays / 30)}mo ago`;
  } catch { return ""; }
}

export function getDateBucket(dateStr: string | null | undefined): string {
  if (!dateStr) return "Unknown";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "Unknown";
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return "This Week";
  if (diffDays < 30) return "This Month";
  if (diffDays < 90) return "Last 3 Months";
  return "Older";
}
