/**
 * Shared utilities, constants, and color maps for the DataTable module.
 * Imported by DataTableRow, DataTableToolbar, DataTableColumnManager, and DataTable.
 */

export const initialsColors = [
  { text: "text-[#1a3a6f]", bg: "bg-[#1a3a6f]/10", dot: "bg-[#1a3a6f]", border: "border-[#1a3a6f]/20" },
  { text: "text-[#2d5aa8]", bg: "bg-[#2d5aa8]/10", dot: "bg-[#2d5aa8]", border: "border-[#2d5aa8]/20" },
  { text: "text-[#1E90FF]", bg: "bg-[#1E90FF]/10", dot: "bg-[#1E90FF]", border: "border-[#1E90FF]/20" },
  { text: "text-[#17A398]", bg: "bg-[#17A398]/10", dot: "bg-[#17A398]", border: "border-[#17A398]/20" },
  { text: "text-[#10b981]", bg: "bg-[#10b981]/10", dot: "bg-[#10b981]", border: "border-[#10b981]/20" },
  { text: "text-[#ca8a04]", bg: "bg-[#facc15]/20", dot: "bg-[#facc15]", border: "border-[#facc15]/30" },
];

export const normalizeCol = (col: string) =>
  col.toLowerCase().replace(/\s+/g, " ").trim();

export const getInitials = (name: string) => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2)
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name[0].toUpperCase();
};

export const getAccountColor = (id: number) => initialsColors[id % initialsColors.length];

export const statusColors: Record<string, { text: string; bg: string; border: string; dot: string }> = {
  Active: { text: "text-[#10b981]", bg: "bg-[#10b981]/10", border: "border-[#10b981]/20", dot: "bg-[#10b981]" },
  Paused: { text: "text-[#f59e0b]", bg: "bg-[#f59e0b]/10", border: "border-[#f59e0b]/20", dot: "bg-[#f59e0b]" },
  Completed: { text: "text-[#6b7280]", bg: "bg-[#6b7280]/10", border: "border-[#6b7280]/20", dot: "bg-[#6b7280]" },
  Finished: { text: "text-[#6b7280]", bg: "bg-[#6b7280]/10", border: "border-[#6b7280]/20", dot: "bg-[#6b7280]" },
  Draft: { text: "text-[#6b7280]", bg: "bg-[#6b7280]/10", border: "border-[#6b7280]/20", dot: "bg-[#6b7280]" },
  Inactive: { text: "text-[#ef4444]", bg: "bg-[#ef4444]/10", border: "border-[#ef4444]/20", dot: "bg-[#ef4444]" },
  Trial: { text: "text-[#1E90FF]", bg: "bg-[#1E90FF]/10", border: "border-[#1E90FF]/20", dot: "bg-[#1E90FF]" },
  Suspended: { text: "text-[#ef4444]", bg: "bg-[#ef4444]/10", border: "border-[#ef4444]/20", dot: "bg-[#ef4444]" },
  Unknown: { text: "text-muted-foreground", bg: "bg-muted/10", border: "border-border", dot: "bg-muted-foreground" },
};

export const timezoneColors: Record<string, { text: string; bg: string; border: string }> = {
  UTC: { text: "text-[#64748b] dark:text-[#94a3b8]", bg: "bg-[#64748b]/10", border: "border-[#64748b]/20" },
  "Europe/London": { text: "text-[#2563eb] dark:text-[#60a5fa]", bg: "bg-[#2563eb]/10", border: "border-[#2563eb]/20" },
  "Europe/Paris": { text: "text-[#4f46e5] dark:text-[#818cf8]", bg: "bg-[#4f46e5]/10", border: "border-[#4f46e5]/20" },
  "Europe/Berlin": { text: "text-[#7c3aed] dark:text-[#a78bfa]", bg: "bg-[#7c3aed]/10", border: "border-[#7c3aed]/20" },
  "Europe/Amsterdam": { text: "text-[#ea580c] dark:text-[#fb923c]", bg: "bg-[#ea580c]/10", border: "border-[#ea580c]/20" },
  "America/New_York": { text: "text-[#059669] dark:text-[#34d399]", bg: "bg-[#059669]/10", border: "border-[#059669]/20" },
  "America/Los_Angeles": { text: "text-[#e11d48] dark:text-[#fb7185]", bg: "bg-[#e11d48]/10", border: "border-[#e11d48]/20" },
  "America/Sao_Paulo": { text: "text-[#16a34a] dark:text-[#4ade80]", bg: "bg-[#16a34a]/10", border: "border-[#16a34a]/20" },
  "Asia/Tokyo": { text: "text-[#dc2626] dark:text-[#f87171]", bg: "bg-[#dc2626]/10", border: "border-[#dc2626]/20" },
  "Asia/Dubai": { text: "text-[#d97706] dark:text-[#fbbf24]", bg: "bg-[#d97706]/10", border: "border-[#d97706]/20" },
};

export const conversionColors: Record<string, { text: string; bg: string; border: string; dot: string }> = {
  "New": { text: "text-[#1a3a6f]", bg: "bg-[#1a3a6f]/10", border: "border-[#1a3a6f]/20", dot: "bg-[#1a3a6f]" },
  "Contacted": { text: "text-[#2d5aa8]", bg: "bg-[#2d5aa8]/10", border: "border-[#2d5aa8]/20", dot: "bg-[#2d5aa8]" },
  "Responded": { text: "text-[#1E90FF]", bg: "bg-[#1E90FF]/10", border: "border-[#1E90FF]/20", dot: "bg-[#1E90FF]" },
  "Multiple Responses": { text: "text-[#17A398]", bg: "bg-[#17A398]/10", border: "border-[#17A398]/20", dot: "bg-[#17A398]" },
  "Qualified": { text: "text-[#10b981]", bg: "bg-[#10b981]/10", border: "border-[#10b981]/20", dot: "bg-[#10b981]" },
  "Booked": { text: "text-brand-yellow", bg: "bg-brand-yellow/20", border: "border-brand-yellow/30", dot: "bg-brand-yellow" },
  "DND": { text: "text-[#ef4444]", bg: "bg-[#ef4444]/10", border: "border-[#ef4444]/20", dot: "bg-[#ef4444]" },
  "Lost": { text: "text-[#be185d] dark:text-[#f9a8d4]", bg: "bg-[#be185d]/10", border: "border-[#be185d]/20", dot: "bg-[#ec4899]" },
};

export const automationStatusColors: Record<string, { text: string; bg: string; border: string; dot: string }> = {
  completed: { text: "text-[#059669] dark:text-[#34d399]", bg: "bg-[#059669]/10", border: "border-[#059669]/20", dot: "bg-[#10b981]" },
  queued: { text: "text-[#2563eb] dark:text-[#60a5fa]", bg: "bg-[#2563eb]/10", border: "border-[#2563eb]/20", dot: "bg-[#3b82f6]" },
  active: { text: "text-[#4f46e5] dark:text-[#818cf8]", bg: "bg-[#4f46e5]/10", border: "border-[#4f46e5]/20", dot: "bg-[#6366f1]" },
  paused: { text: "text-[#d97706] dark:text-[#fbbf24]", bg: "bg-[#d97706]/10", border: "border-[#d97706]/20", dot: "bg-[#f59e0b]" },
  dnd: { text: "text-[#e11d48] dark:text-[#fb7185]", bg: "bg-[#e11d48]/10", border: "border-[#e11d48]/20", dot: "bg-[#f43f5e]" },
  error: { text: "text-[#dc2626] dark:text-[#f87171]", bg: "bg-[#dc2626]/10", border: "border-[#dc2626]/20", dot: "bg-[#ef4444]" },
};

export const DATE_COLS = new Set([
  "created time",
  "last modified time",
  "createdat",
  "updatedat",
  "created_at",
  "updated_at",
  "next_action_at",
  "first_message_sent_at",
  "bump_1_sent_at",
  "bump_2_sent_at",
  "bump_3_sent_at",
  "last_message_sent_at",
  "booking_confirmed_at",
]);

export const TIME_COLS = new Set(["business_hours_open", "business_hours_closed"]);

export const ROLLUP_COLS_ORDER = [
  "Leads",
  "Campaigns",
  "Automation Logs",
  "Prompt Libraries",
  "Users",
  "Interactions",
  "Tags",
];

export const AUTOMATION_MATCH = [
  "automation",
  "ai",
  "prompt",
  "assistant",
  "model",
  "max messages",
  "max_messages",
  "workflow",
  "trigger",
  "automation logs",
  "prompt libraries",
];

export const ALWAYS_VISIBLE_MATCH = [
  "id",
  "account id",
  "image",
  "acc",
  "name",
  "company name",
  "email",
  "phone",
  "last modified time",
  "updatedat",
  "updated_at",
];

export const TWILIO_SENSITIVE_FIELDS = [
  "twilio_account_sid",
  "twilio_auth_token",
  "twilio_messaging_service_sid",
];

export const TWILIO_PHONE_FIELDS = ["twilio_default_from_number"];

export const isTwilioField = (col: string) =>
  TWILIO_SENSITIVE_FIELDS.includes(col) || TWILIO_PHONE_FIELDS.includes(col);

export const isDateCol = (col: string) => DATE_COLS.has(normalizeCol(col));
export const isTimeCol = (col: string) => TIME_COLS.has(normalizeCol(col));
export const isRollupCol = (col: string) =>
  ROLLUP_COLS_ORDER.some((c) => normalizeCol(c) === normalizeCol(col));

export const matchesAny = (col: string, list: string[]) => {
  const n = normalizeCol(col);
  return list.some((item) => n === normalizeCol(item));
};

export const includesAny = (col: string, list: string[]) => {
  const n = normalizeCol(col);
  return list.some((item) => n.includes(normalizeCol(item)));
};

export const maskTwilioValue = (value: string): string => {
  if (!value) return "—";
  const str = String(value);
  if (str.length <= 4) return "••••";
  if (str.length <= 8) return "••••" + str.slice(-4);
  const prefix = str.slice(0, 4);
  const suffix = str.slice(-4);
  const dots = "•".repeat(Math.min(str.length - 8, 12));
  return `${prefix}${dots}${suffix}`;
};

export const formatDateTimeParts = (value: any) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;

  const day = String(d.getDate()).padStart(2, "0");
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const mon = months[d.getMonth()];
  const yr = String(d.getFullYear()).slice(-2);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return { date: `${day}/${mon}/${yr}`, time: `${hh}:${mm}`, d };
};

export const formatDateTime = (value: any) => {
  const parts = formatDateTimeParts(value);
  if (!parts) return value ? String(value) : "-";
  return `${parts.date}   ${parts.time}`;
};

export const formatHHmm = (value: any) => {
  if (!value) return "-";
  if (typeof value === "string" && value.includes(":")) {
    const parts = value.split(":");
    return `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}`;
  }
  const d = new Date(value);
  if (!Number.isNaN(d.getTime())) {
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  return String(value);
};

export const formatHeaderTitle = (col: string) => {
  if (col === "name") return "Campaign Name";
  if (col === "Account ID" || col === "account_id") return "Account ID";
  if (col === "campaign_id") return "Campaign ID";
  if (col === "full_name") return "Full Name";
  if (col === "conversion_status") return "Conversion";
  if (col === "twilio_account_sid") return "Twilio Account SID";
  if (col === "twilio_auth_token") return "Twilio Auth Token";
  if (col === "twilio_messaging_service_sid") return "Messaging Service SID";
  if (col === "twilio_default_from_number") return "Default From Number";
  return col
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};
