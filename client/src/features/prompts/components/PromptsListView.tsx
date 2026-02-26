import { useState, useEffect } from "react";
import {
  Plus,
  Search,
  SlidersHorizontal,
  List,
  Table2,
  Star,
  ArrowUpDown,
  Layers,
  Filter,
  X,
  Check,
  Save,
  Trash2,
  Pencil,
  Info,
  FileText,
  Terminal,
  Settings2,
  StickyNote,
  BarChart2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { IconBtn } from "@/components/ui/icon-btn";
import { DataEmptyState } from "@/components/crm/DataEmptyState";
import { apiFetch } from "@/lib/apiUtils";
import { useToast } from "@/hooks/use-toast";
import {
  getStatusBadgeClasses,
  getStatusLabel,
  getScoreColorClasses,
  getPromptId,
  MODEL_OPTIONS,
  PROMPT_SORT_LABELS,
  PROMPT_GROUP_LABELS,
  type PromptViewMode,
  type PromptSortOption,
  type PromptGroupOption,
  type PromptFormData,
} from "../types";

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function getPromptInitials(name: string): string {
  return (
    (name || "P")
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "P"
  );
}

function getPromptAvatarColor(status: string): { bg: string; text: string } {
  const norm = (status || "").toLowerCase().trim();
  if (norm === "active") return { bg: "#D1FAE5", text: "#065F46" };
  if (norm === "archived") return { bg: "#F4F4F5", text: "#52525B" };
  return { bg: "#E5E7EB", text: "#374151" };
}

function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffDays = Math.floor(diffMs / 86_400_000);
    if (diffDays === 0) {
      const h = Math.floor(diffMs / 3_600_000);
      return h === 0 ? "Just now" : `${h}h ago`;
    }
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return `${Math.floor(diffDays / 30)}mo ago`;
  } catch {
    return "";
  }
}

/* ── Shared sub-components ───────────────────────────────────────────────── */

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="icon-circle-lg border-2 border-border/25 text-muted-foreground flex items-center justify-center shrink-0">
        {icon}
      </div>
      <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
        {title}
      </h3>
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 border-b border-border/40 last:border-0">
      <span className="text-[11px] text-muted-foreground shrink-0 pt-0.5">{label}</span>
      <span
        className={cn(
          "text-[12px] text-foreground text-right break-words max-w-[60%]",
          mono && "font-mono text-[11px]",
        )}
      >
        {value ?? "—"}
      </span>
    </div>
  );
}

/* ── ViewPanel (read-only detail) ────────────────────────────────────────── */

function ViewPanel({
  prompt,
  campaignMap,
  onToggleStatus,
  togglingId,
}: {
  prompt: any;
  campaignMap: Map<number, string>;
  onEdit: () => void;
  onToggleStatus: (prompt: any) => void;
  togglingId: boolean;
}) {
  const useCase = prompt.useCase || prompt.use_case;
  const updatedAt = prompt.updatedAt || prompt.updated_at;
  const promptText = prompt.promptText || prompt.prompt_text;
  const systemMessage = prompt.systemMessage || prompt.system_message;
  const notes = prompt.notes;
  const campaignId = prompt.campaignsId || prompt.Campaigns_id;
  const campaignName = campaignId
    ? (campaignMap.get(Number(campaignId)) ?? "Unknown")
    : "None";

  const score: number | null | undefined = prompt.performanceScore;
  const scoreBarColor =
    score == null
      ? "bg-border/60"
      : score >= 70
      ? "bg-green-500"
      : score >= 40
      ? "bg-yellow-400"
      : "bg-border/60";

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-5 [scrollbar-width:thin]">
      {/* ── Overview ──────────────────────────────────────────────────────── */}
      <section>
        <SectionHeader icon={<Info className="h-4 w-4" />} title="Overview" />
        <div className="rounded-xl border border-border/30 bg-card p-3">
          <InfoRow label="Use Case" value={useCase || "—"} />
          <InfoRow
            label="Status"
            value={
              <span className="inline-flex items-center gap-1.5">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    getStatusBadgeClasses(prompt.status),
                  )}
                >
                  {getStatusLabel(prompt.status)}
                </span>
                <button
                  onClick={() => onToggleStatus(prompt)}
                  disabled={togglingId}
                  className="text-[10px] font-medium text-muted-foreground hover:text-foreground underline ml-1 disabled:opacity-50 transition-colors"
                >
                  {(prompt.status || "").toLowerCase() === "active" ? "Archive" : "Activate"}
                </button>
              </span>
            }
          />
          <InfoRow label="Model" value={prompt.model || "—"} />
          {prompt.version && <InfoRow label="Version" value={`v${prompt.version}`} mono />}
          <InfoRow label="Updated" value={formatRelativeTime(updatedAt) || "—"} />
        </div>
      </section>

      {/* ── Prompt Content ────────────────────────────────────────────────── */}
      <section>
        <SectionHeader icon={<FileText className="h-4 w-4" />} title="Prompt Content" />
        <div className="rounded-xl bg-muted border border-border/20 px-3.5 py-3">
          <p className="text-[12px] text-foreground/90 leading-relaxed whitespace-pre-wrap break-words font-mono">
            {promptText || "—"}
          </p>
        </div>
      </section>

      {/* ── System Message (conditional) ──────────────────────────────────── */}
      {!!systemMessage && (
        <section>
          <SectionHeader icon={<Terminal className="h-4 w-4" />} title="System Message" />
          <div className="rounded-xl bg-muted/60 border border-border/20 px-3.5 py-3">
            <p className="text-[12px] text-foreground/90 leading-relaxed whitespace-pre-wrap break-words font-mono">
              {systemMessage}
            </p>
          </div>
        </section>
      )}

      {/* ── Configuration ─────────────────────────────────────────────────── */}
      <section>
        <SectionHeader icon={<Settings2 className="h-4 w-4" />} title="Configuration" />
        <div className="rounded-xl border border-border/30 bg-card p-3">
          <InfoRow label="Campaign" value={campaignName} />
          <InfoRow
            label="Temperature"
            value={prompt.temperature != null ? String(prompt.temperature) : "—"}
            mono
          />
          <InfoRow
            label="Max Tokens"
            value={prompt.maxTokens != null ? String(prompt.maxTokens) : "—"}
            mono
          />
        </div>
      </section>

      {/* ── Notes (conditional) ───────────────────────────────────────────── */}
      {!!notes && (
        <section>
          <SectionHeader icon={<StickyNote className="h-4 w-4" />} title="Notes" />
          <div className="rounded-xl bg-muted border border-border/20 px-3.5 py-3">
            <p className="text-[12px] text-foreground/90 leading-relaxed whitespace-pre-wrap break-words">
              {notes}
            </p>
          </div>
        </section>
      )}

      {/* ── Performance ───────────────────────────────────────────────────── */}
      <section>
        <SectionHeader icon={<BarChart2 className="h-4 w-4" />} title="Performance" />
        <div className="rounded-xl border border-border/30 bg-card p-3">
          {score != null ? (
            <div className="space-y-2">
              <div className="w-full h-1.5 rounded-full bg-border/50 overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-colors", scoreBarColor)}
                  style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
                />
              </div>
              <div className="flex items-center justify-end gap-1">
                <Star
                  className={cn("h-4 w-4 fill-current shrink-0", getScoreColorClasses(String(score)))}
                />
                <span
                  className={cn(
                    "text-[12px] font-semibold tabular-nums",
                    getScoreColorClasses(String(score)),
                  )}
                >
                  {score}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-[12px] text-muted-foreground py-1">No performance data yet</p>
          )}
        </div>
      </section>

      <div className="h-4" />
    </div>
  );
}

/* ── EditPanel ───────────────────────────────────────────────────────────── */

function EditPanel({
  prompt,
  onSaved,
  onDelete,
  onCancel,
  campaigns = [],
}: {
  prompt: any;
  onSaved: (saved: any) => void;
  onDelete: (prompt: any) => void;
  onCancel: () => void;
  campaigns?: { id: number; name: string }[];
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<PromptFormData>({
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
  });
  const [errors, setErrors] = useState<Partial<PromptFormData>>({});

  const promptId = getPromptId(prompt);

  useEffect(() => {
    setForm({
      name: prompt.name || "",
      promptText: prompt.promptText || prompt.prompt_text || "",
      systemMessage: prompt.systemMessage || prompt.system_message || "",
      model: prompt.model || "gpt-4o",
      temperature: prompt.temperature != null ? String(prompt.temperature) : "0.7",
      maxTokens: prompt.maxTokens != null ? String(prompt.maxTokens) : "1000",
      status: (prompt.status || "active").toLowerCase(),
      useCase: prompt.useCase || prompt.use_case || "",
      notes: prompt.notes || "",
      campaignsId:
        prompt.campaignsId != null
          ? String(prompt.campaignsId)
          : prompt.Campaigns_id != null
          ? String(prompt.Campaigns_id)
          : "",
    });
    setErrors({});
  }, [promptId]);

  function setField(field: keyof PromptFormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function validate(): boolean {
    const e: Partial<PromptFormData> = {};
    if (!form.name.trim()) e.name = "Required";
    if (!form.promptText.trim()) e.promptText = "Required";
    const temp = parseFloat(form.temperature);
    if (isNaN(temp) || temp < 0 || temp > 2) e.temperature = "0–2";
    const tokens = parseInt(form.maxTokens, 10);
    if (isNaN(tokens) || tokens < 1) e.maxTokens = "≥ 1";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        promptText: form.promptText.trim(),
        systemMessage: form.systemMessage.trim() || null,
        model: form.model || null,
        temperature: form.temperature,
        maxTokens: parseInt(form.maxTokens, 10),
        status: form.status || "active",
        useCase: form.useCase.trim() || null,
        notes: form.notes.trim() || null,
        campaignsId: form.campaignsId ? parseInt(form.campaignsId, 10) : null,
      };
      const res = await apiFetch(`/api/prompts/${promptId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || body?.error || `HTTP ${res.status}`);
      }
      const saved = await res.json();
      onSaved(saved);
      toast({ title: "Saved", description: `"${form.name}" updated.` });
    } catch (err: any) {
      toast({
        title: "Failed to save",
        description: err.message || "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    "w-full h-9 rounded-xl border bg-popover px-2.5 text-[12px] outline-none focus:ring-2 focus:ring-brand-indigo/30";
  const textareaCls =
    "w-full rounded-xl border bg-popover px-2.5 py-2 text-[12px] outline-none focus:ring-2 focus:ring-brand-indigo/30 resize-y";
  const selectCls =
    "w-full h-9 rounded-xl border bg-popover px-2.5 text-[12px] outline-none focus:ring-2 focus:ring-brand-indigo/30 appearance-none";
  const labelCls = "text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-0.5 block";

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Scrollable body */}
      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-5 [scrollbar-width:thin]">
        {/* Section 1: Identity */}
        <div className="rounded-xl border border-border/30 bg-card p-3">
          <SectionHeader icon={<Pencil className="h-4 w-4" />} title="Identity" />
          <div className="flex flex-col gap-3">
            <div>
              <label className={labelCls}>Name *</label>
              <input
                className={cn(inputCls, errors.name ? "border-red-400" : "border-border/30")}
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                placeholder="e.g. Re-engagement Opener"
              />
              {errors.name && (
                <p className="text-[10px] text-red-500 mt-0.5">{errors.name}</p>
              )}
            </div>
            <div>
              <label className={labelCls}>Use Case</label>
              <input
                className={cn(inputCls, "border-border/30")}
                value={form.useCase}
                onChange={(e) => setField("useCase", e.target.value)}
                placeholder="e.g. WhatsApp lead reactivation"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Prompt Content */}
        <div>
          <SectionHeader icon={<FileText className="h-4 w-4" />} title="Prompt Content" />
          <div>
            <label className={labelCls}>Prompt Text *</label>
            <textarea
              className={cn(
                textareaCls,
                "min-h-[200px]",
                errors.promptText ? "border-red-400" : "border-border/30",
              )}
              value={form.promptText}
              onChange={(e) => setField("promptText", e.target.value)}
              placeholder="Enter the main prompt text…"
            />
            {errors.promptText && (
              <p className="text-[10px] text-red-500 mt-0.5">{errors.promptText}</p>
            )}
          </div>
        </div>

        {/* Section 3: System Message */}
        <div>
          <SectionHeader icon={<Terminal className="h-4 w-4" />} title="System Message" />
          <div>
            <label className={labelCls}>System Message</label>
            <textarea
              className={cn(textareaCls, "min-h-[100px] border-border/30")}
              value={form.systemMessage}
              onChange={(e) => setField("systemMessage", e.target.value)}
              placeholder="Optional system-level instructions for the AI…"
            />
          </div>
        </div>

        {/* Section 4: Configuration */}
        <div className="rounded-xl border border-border/30 bg-card p-3">
          <SectionHeader icon={<Settings2 className="h-4 w-4" />} title="Configuration" />
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={labelCls}>Campaign</label>
              <select
                className={cn(selectCls, "border-border/30")}
                value={form.campaignsId}
                onChange={(e) => setField("campaignsId", e.target.value)}
              >
                <option value="">— None —</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Model</label>
              <select
                className={cn(selectCls, "border-border/30")}
                value={form.model}
                onChange={(e) => setField("model", e.target.value)}
              >
                {MODEL_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select
                className={cn(selectCls, "border-border/30")}
                value={form.status}
                onChange={(e) => setField("status", e.target.value)}
              >
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Temperature (0–2)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="2"
                className={cn(
                  inputCls,
                  errors.temperature ? "border-red-400" : "border-border/30",
                )}
                value={form.temperature}
                onChange={(e) => setField("temperature", e.target.value)}
              />
              {errors.temperature && (
                <p className="text-[10px] text-red-500 mt-0.5">{errors.temperature}</p>
              )}
            </div>
            <div>
              <label className={labelCls}>Max Tokens</label>
              <input
                type="number"
                min="1"
                className={cn(inputCls, errors.maxTokens ? "border-red-400" : "border-border/30")}
                value={form.maxTokens}
                onChange={(e) => setField("maxTokens", e.target.value)}
              />
              {errors.maxTokens && (
                <p className="text-[10px] text-red-500 mt-0.5">{errors.maxTokens}</p>
              )}
            </div>
          </div>
        </div>

        {/* Section 5: Notes */}
        <div>
          <SectionHeader icon={<StickyNote className="h-4 w-4" />} title="Notes" />
          <div>
            <label className={labelCls}>Notes</label>
            <textarea
              className={cn(textareaCls, "min-h-[80px] border-border/30")}
              value={form.notes}
              onChange={(e) => setField("notes", e.target.value)}
              placeholder="Internal notes about this prompt…"
            />
          </div>
        </div>

        <div className="h-2" />
      </div>

      {/* Sticky footer */}
      <div className="shrink-0 px-5 py-3.5 border-t border-border/20 flex items-center gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="h-9 px-4 rounded-xl bg-brand-indigo text-white text-[12px] font-semibold hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-1.5"
        >
          <Save className="h-4 w-4" />
          {saving ? "Saving…" : "Save Changes"}
        </button>
        <button
          onClick={onCancel}
          className="h-9 px-3 rounded-xl text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted inline-flex items-center gap-1.5"
        >
          Cancel
        </button>
        <button
          onClick={() => onDelete(prompt)}
          className="ml-auto h-9 px-3 rounded-xl text-[12px] font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 inline-flex items-center gap-1.5"
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </button>
      </div>
    </div>
  );
}

/* ── Left panel card ─────────────────────────────────────────────────────── */

function PromptListCard({
  prompt,
  isActive,
  onClick,
  campaignMap,
}: {
  prompt: any;
  isActive: boolean;
  onClick: () => void;
  campaignMap: Map<number, string>;
}) {
  const name = prompt.name || "Untitled";
  const initials = getPromptInitials(name);
  const avatarColor = getPromptAvatarColor(prompt.status);
  const cId = prompt.campaignsId || prompt.Campaigns_id;
  const campaignName = cId ? campaignMap.get(cId) : null;
  const updatedAt = prompt.updatedAt || prompt.updated_at;

  return (
    <div
      className={cn(
        "group mx-[3px] my-0.5 rounded-xl cursor-pointer",
        "transition-colors duration-150 ease-out",
        "hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]",
        isActive ? "bg-[#FFF1C8]" : "bg-[#F1F1F1] hover:bg-[#FAFAFA]",
      )}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
    >
      <div className="px-3 pt-3 pb-2.5 flex flex-col gap-1.5">
        {/* Top row: avatar + name + status badge */}
        <div className="flex items-start gap-2.5">
          <div
            className="h-10 w-10 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0"
            style={{ backgroundColor: avatarColor.bg, color: avatarColor.text }}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <div className="flex items-start justify-between gap-1.5">
              <p className="text-[14px] font-semibold font-heading leading-tight truncate text-foreground">
                {name}
              </p>
              <span
                className={cn(
                  "shrink-0 text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full mt-0.5 whitespace-nowrap",
                  getStatusBadgeClasses(prompt.status),
                )}
              >
                {getStatusLabel(prompt.status)}
              </span>
            </div>
            {/* Model + campaign */}
            <div className="flex items-center gap-1 mt-[3px] min-w-0">
              <span className="text-[11px] text-muted-foreground truncate">
                {prompt.model || "—"}
              </span>
              {campaignName && (
                <>
                  <span className="text-muted-foreground/30 shrink-0">·</span>
                  <span className="text-[11px] text-muted-foreground/60 truncate">
                    {campaignName}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Score + updated time */}
        {(prompt.performanceScore != null || updatedAt) && (
          <div className="flex items-center justify-between text-[10px] text-muted-foreground/50">
            {prompt.performanceScore != null ? (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 font-medium",
                  getScoreColorClasses(prompt.performanceScore),
                )}
              >
                <Star className="h-3 w-3 fill-current" />
                {prompt.performanceScore}
              </span>
            ) : (
              <span />
            )}
            {updatedAt && (
              <span className="tabular-nums">{formatRelativeTime(updatedAt)}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Group header ────────────────────────────────────────────────────────── */

function GroupHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="sticky top-0 z-20 bg-muted px-3 pt-1.5 pb-1.5">
      <div className="flex items-center">
        <div className="flex-1 h-px bg-foreground/15 mx-[8px]" />
        <span className="text-[10px] font-bold text-foreground/55 uppercase tracking-widest shrink-0">
          {label}
        </span>
        <span className="ml-1 text-[9px] text-muted-foreground/45 font-semibold shrink-0">
          {count}
        </span>
        <div className="flex-1 h-px bg-foreground/15 mx-[8px]" />
      </div>
    </div>
  );
}

/* ── Constants ───────────────────────────────────────────────────────────── */

const SORT_OPTIONS: PromptSortOption[] = [
  "recent",
  "name_asc",
  "name_desc",
  "score_desc",
  "score_asc",
];
const GROUP_OPTIONS: PromptGroupOption[] = ["none", "status", "model", "campaign"];
const STATUS_OPTIONS = ["all", "active", "archived"] as const;

/* ── Props ───────────────────────────────────────────────────────────────── */

interface PromptsListViewProps {
  prompts: any[];
  groupedRows: Map<string, any[]> | null;
  viewMode: PromptViewMode;
  onViewModeChange: (v: PromptViewMode) => void;
  q: string;
  onQChange: (v: string) => void;
  sortBy: PromptSortOption;
  onSortByChange: (s: PromptSortOption) => void;
  groupBy: PromptGroupOption;
  onGroupByChange: (g: PromptGroupOption) => void;
  statusFilter: string;
  onStatusFilterChange: (s: string) => void;
  modelFilter: string;
  onModelFilterChange: (m: string) => void;
  campaignFilter: string;
  onCampaignFilterChange: (c: string) => void;
  availableModels: string[];
  availableCampaigns: { id: number; name: string }[];
  isFilterActive: boolean;
  activeFilterCount: number;
  onClearAllFilters: () => void;
  togglingIds: Set<number>;
  onSaved: (saved: any) => void;
  onDelete: (prompt: any) => void;
  onToggleStatus: (prompt: any) => void;
  onOpenCreate: () => void;
  campaignMap: Map<number, string>;
  campaigns: { id: number; name: string }[];
}

/* ── Main component ──────────────────────────────────────────────────────── */

export function PromptsListView({
  prompts,
  groupedRows,
  viewMode,
  onViewModeChange,
  q,
  onQChange,
  sortBy,
  onSortByChange,
  groupBy,
  onGroupByChange,
  statusFilter,
  onStatusFilterChange,
  modelFilter,
  onModelFilterChange,
  campaignFilter,
  onCampaignFilterChange,
  availableModels,
  availableCampaigns,
  isFilterActive,
  activeFilterCount,
  onClearAllFilters,
  togglingIds,
  onSaved,
  onDelete,
  onToggleStatus,
  onOpenCreate,
  campaignMap,
  campaigns,
}: PromptsListViewProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<"view" | "edit">("view");

  // Auto-select first prompt on list change
  useEffect(() => {
    if (prompts.length > 0) {
      const firstId = getPromptId(prompts[0]);
      setSelectedId((prev) => {
        if (prev !== null && prompts.some((p) => getPromptId(p) === prev)) return prev;
        return firstId;
      });
    } else {
      setSelectedId(null);
    }
  }, [prompts]);

  // Reset panel to view mode whenever a different prompt is selected
  useEffect(() => {
    setPanelMode("view");
  }, [selectedId]);

  const selectedPrompt = prompts.find((p) => getPromptId(p) === selectedId) ?? null;

  const hasNonDefaultControls =
    sortBy !== "recent" || groupBy !== "none" || isFilterActive || !!q;

  // Build flat list: headers + cards interleaved
  const listItems: Array<
    | { kind: "header"; label: string; count: number }
    | { kind: "prompt"; prompt: any }
  > = (() => {
    if (!groupedRows) {
      return prompts.map((p) => ({ kind: "prompt" as const, prompt: p }));
    }
    const result: Array<
      | { kind: "header"; label: string; count: number }
      | { kind: "prompt"; prompt: any }
    > = [];
    groupedRows.forEach((group, label) => {
      result.push({ kind: "header", label, count: group.length });
      group.forEach((p) => result.push({ kind: "prompt", prompt: p }));
    });
    return result;
  })();

  const selectedAvatarColor = selectedPrompt
    ? getPromptAvatarColor(selectedPrompt.status)
    : { bg: "#E5E7EB", text: "#374151" };

  return (
    <div className="flex h-full gap-[3px]" data-testid="prompts-list-view">
      {/* ── LEFT PANEL ──────────────────────────────────────────────────── */}
      <div className="w-[340px] shrink-0 flex flex-col bg-muted rounded-lg overflow-hidden">
        {/* Header: title + count */}
        <div className="px-3.5 pt-5 pb-1 shrink-0 flex items-center justify-between">
          <h2 className="text-2xl font-semibold font-heading text-foreground leading-tight">
            Prompt Library
          </h2>
          <span className="text-[12px] font-medium text-muted-foreground tabular-nums">
            {prompts.length}
          </span>
        </div>

        {/* Controls row */}
        <div className="px-3 pt-1.5 pb-3 shrink-0 flex items-center justify-between gap-2">
          {/* View tabs */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => onViewModeChange("list")}
              className="inline-flex items-center gap-1.5 h-10 px-3 rounded-full bg-[#FFE35B] text-foreground text-[12px] font-semibold shrink-0"
            >
              <List className="h-4 w-4" />
              List
            </button>
            <button
              onClick={() => onViewModeChange("table")}
              title="Table"
              className="h-10 w-10 rounded-full border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors shrink-0"
            >
              <Table2 className="h-4 w-4" />
            </button>
          </div>

          {/* Right controls: + / Search / Settings */}
          <div className="flex items-center gap-1.5 shrink-0">
            <IconBtn title="New Prompt" onClick={onOpenCreate}>
              <Plus className="h-4 w-4" />
            </IconBtn>

            <Popover open={searchOpen} onOpenChange={setSearchOpen}>
              <PopoverTrigger asChild>
                <IconBtn active={!!q} title="Search">
                  <Search className="h-4 w-4" />
                </IconBtn>
              </PopoverTrigger>
              <PopoverContent
                side="bottom"
                align="end"
                className="w-56 p-2"
                onOpenAutoFocus={(e) => e.preventDefault()}
              >
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
                  <input
                    autoFocus
                    type="text"
                    placeholder="Search prompts…"
                    value={q}
                    onChange={(e) => onQChange(e.target.value)}
                    className="w-full pl-7 pr-7 py-1.5 text-[12px] rounded-md border border-border bg-popover placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-brand-indigo/50"
                  />
                  {q && (
                    <button
                      onClick={() => onQChange("")}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 h-4 w-4 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </PopoverContent>
            </Popover>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <IconBtn active={hasNonDefaultControls} title="Sort, Filter & Group">
                  <SlidersHorizontal className="h-4 w-4" />
                </IconBtn>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {/* Sort */}
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <ArrowUpDown className="h-3.5 w-3.5 mr-2" />
                    <span>Sort</span>
                    {sortBy !== "recent" && (
                      <span className="ml-auto text-[10px] text-brand-indigo font-semibold">
                        {PROMPT_SORT_LABELS[sortBy].split(" ")[0]}
                      </span>
                    )}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {SORT_OPTIONS.map((opt) => (
                      <DropdownMenuItem
                        key={opt}
                        onClick={() => onSortByChange(opt)}
                        className={cn(
                          "text-[12px]",
                          sortBy === opt && "font-semibold text-brand-indigo",
                        )}
                      >
                        {PROMPT_SORT_LABELS[opt]}
                        {sortBy === opt && <Check className="h-3 w-3 ml-auto" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                {/* Filter */}
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Filter className="h-3.5 w-3.5 mr-2" />
                    <span>Filter</span>
                    {isFilterActive && (
                      <span className="ml-auto text-[10px] text-brand-indigo font-semibold">
                        {activeFilterCount}
                      </span>
                    )}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-52 max-h-80 overflow-y-auto">
                    <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      Status
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {STATUS_OPTIONS.map((opt) => (
                      <DropdownMenuItem
                        key={opt}
                        onClick={(e) => {
                          e.preventDefault();
                          onStatusFilterChange(opt);
                        }}
                        className={cn(
                          "text-[12px] flex items-center justify-between",
                          statusFilter === opt && "font-semibold text-brand-indigo",
                        )}
                      >
                        {opt === "all"
                          ? "All Statuses"
                          : opt.charAt(0).toUpperCase() + opt.slice(1)}
                        {statusFilter === opt && <Check className="h-3 w-3" />}
                      </DropdownMenuItem>
                    ))}

                    {availableModels.length > 0 && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
                          Model
                        </DropdownMenuLabel>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.preventDefault();
                            onModelFilterChange("all");
                          }}
                          className={cn(
                            "text-[12px]",
                            modelFilter === "all" && "font-semibold text-brand-indigo",
                          )}
                        >
                          All Models
                          {modelFilter === "all" && <Check className="h-3 w-3 ml-auto" />}
                        </DropdownMenuItem>
                        {availableModels.map((m) => (
                          <DropdownMenuItem
                            key={m}
                            onClick={(e) => {
                              e.preventDefault();
                              onModelFilterChange(m);
                            }}
                            className={cn(
                              "text-[12px]",
                              modelFilter === m && "font-semibold text-brand-indigo",
                            )}
                          >
                            <span className="truncate flex-1">{m}</span>
                            {modelFilter === m && <Check className="h-3 w-3 ml-1 shrink-0" />}
                          </DropdownMenuItem>
                        ))}
                      </>
                    )}

                    {availableCampaigns.length > 0 && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
                          Campaign
                        </DropdownMenuLabel>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.preventDefault();
                            onCampaignFilterChange("");
                          }}
                          className={cn(
                            "text-[12px]",
                            !campaignFilter && "font-semibold text-brand-indigo",
                          )}
                        >
                          All Campaigns
                          {!campaignFilter && <Check className="h-3 w-3 ml-auto" />}
                        </DropdownMenuItem>
                        {availableCampaigns.map((c) => (
                          <DropdownMenuItem
                            key={c.id}
                            onClick={(e) => {
                              e.preventDefault();
                              onCampaignFilterChange(
                                campaignFilter === String(c.id) ? "" : String(c.id),
                              );
                            }}
                            className={cn(
                              "text-[12px]",
                              campaignFilter === String(c.id) &&
                                "font-semibold text-brand-indigo",
                            )}
                          >
                            <span className="truncate flex-1">{c.name}</span>
                            {campaignFilter === String(c.id) && (
                              <Check className="h-3 w-3 ml-1 shrink-0" />
                            )}
                          </DropdownMenuItem>
                        ))}
                      </>
                    )}

                    {isFilterActive && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={onClearAllFilters}
                          className="text-[12px] text-destructive"
                        >
                          Clear all filters
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                {/* Group */}
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Layers className="h-3.5 w-3.5 mr-2" />
                    <span>Group</span>
                    {groupBy !== "none" && (
                      <span className="ml-auto text-[10px] text-brand-indigo font-semibold">
                        {PROMPT_GROUP_LABELS[groupBy]}
                      </span>
                    )}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {GROUP_OPTIONS.map((opt) => (
                      <DropdownMenuItem
                        key={opt}
                        onClick={() => onGroupByChange(opt)}
                        className={cn(
                          "text-[12px]",
                          groupBy === opt && "font-semibold text-brand-indigo",
                        )}
                      >
                        {PROMPT_GROUP_LABELS[opt]}
                        {groupBy === opt && <Check className="h-3 w-3 ml-auto" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                {/* Reset all */}
                {hasNonDefaultControls && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => {
                        onSortByChange("recent");
                        onGroupByChange("none");
                        onClearAllFilters();
                        onQChange("");
                      }}
                      className="text-[12px] text-muted-foreground"
                    >
                      Reset all
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* ── Prompt list ── */}
        <div className="flex-1 min-h-0 overflow-y-auto [scrollbar-width:thin]">
          {prompts.length === 0 ? (
            <div className="flex items-center justify-center h-full p-6">
              <DataEmptyState variant={q || isFilterActive ? "search" : "prompts"} />
            </div>
          ) : (
            listItems.map((item) =>
              item.kind === "header" ? (
                <GroupHeader key={`h-${item.label}`} label={item.label} count={item.count} />
              ) : (
                <PromptListCard
                  key={getPromptId(item.prompt)}
                  prompt={item.prompt}
                  isActive={selectedId === getPromptId(item.prompt)}
                  onClick={() => setSelectedId(getPromptId(item.prompt))}
                  campaignMap={campaignMap}
                />
              ),
            )
          )}
        </div>
      </div>

      {/* ── RIGHT PANEL ──────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 flex flex-col bg-card rounded-lg overflow-hidden">
        {selectedPrompt ? (
          <>
            {/* Header */}
            <div className="px-5 pt-4 pb-3.5 border-b border-border/20 shrink-0 flex items-center gap-3">
              <div
                className="h-9 w-9 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0"
                style={{
                  backgroundColor: selectedAvatarColor.bg,
                  color: selectedAvatarColor.text,
                }}
              >
                {getPromptInitials(selectedPrompt.name || "")}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-[15px] font-semibold font-heading leading-tight truncate text-foreground">
                  {selectedPrompt.name || "Untitled Prompt"}
                </h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <span
                    className={cn(
                      "text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full",
                      getStatusBadgeClasses(selectedPrompt.status),
                    )}
                  >
                    {getStatusLabel(selectedPrompt.status)}
                  </span>
                  {selectedPrompt.model && (
                    <span className="text-[11px] text-muted-foreground">
                      {selectedPrompt.model}
                    </span>
                  )}
                  {selectedPrompt.version && (
                    <span className="text-[10px] font-mono text-muted-foreground/50">
                      v{selectedPrompt.version}
                    </span>
                  )}
                </div>
              </div>
              {/* Right side: score badge + mode toggle */}
              <div className="flex items-center gap-2 shrink-0">
                {selectedPrompt.performanceScore != null && (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 text-[11px] font-semibold shrink-0",
                      getScoreColorClasses(selectedPrompt.performanceScore),
                    )}
                  >
                    <Star className="h-3.5 w-3.5 fill-current shrink-0" />
                    {selectedPrompt.performanceScore}
                  </span>
                )}
                {panelMode === "view" ? (
                  <IconBtn title="Edit prompt" onClick={() => setPanelMode("edit")}>
                    <Pencil className="h-4 w-4" />
                  </IconBtn>
                ) : (
                  <IconBtn title="Cancel" onClick={() => setPanelMode("view")}>
                    <X className="h-4 w-4" />
                  </IconBtn>
                )}
              </div>
            </div>

            {/* Body: ViewPanel (read-only) or EditPanel (form) */}
            {panelMode === "view" ? (
              <ViewPanel
                prompt={selectedPrompt}
                campaignMap={campaignMap}
                onEdit={() => setPanelMode("edit")}
                onToggleStatus={onToggleStatus}
                togglingId={togglingIds.has(getPromptId(selectedPrompt))}
              />
            ) : (
              <EditPanel
                prompt={selectedPrompt}
                onSaved={(saved) => {
                  onSaved(saved);
                  setPanelMode("view");
                }}
                onDelete={onDelete}
                onCancel={() => setPanelMode("view")}
                campaigns={campaigns}
              />
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center p-8">
            <DataEmptyState variant="prompts" />
          </div>
        )}
      </div>
    </div>
  );
}
