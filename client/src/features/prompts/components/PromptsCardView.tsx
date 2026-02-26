import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Trash2,
  Star,
  ToggleLeft,
  ToggleRight,
  Save,
} from "lucide-react";
import { apiFetch } from "@/lib/apiUtils";
import { useToast } from "@/hooks/use-toast";
import { DataEmptyState } from "@/components/crm/DataEmptyState";
import {
  getStatusBadgeClasses,
  getStatusLabel,
  getScoreColorClasses,
  getPromptId,
  MODEL_OPTIONS,
  type PromptFormData,
} from "../types";

/* ════════════════════════════════════════════════════════════════════════════
   Inline edit panel — always shown below the selected card strip
   ════════════════════════════════════════════════════════════════════════════ */

function EditPanel({
  prompt,
  onSaved,
  onDelete,
  campaigns = [],
}: {
  prompt: any;
  onSaved: (saved: any) => void;
  onDelete: (prompt: any) => void;
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

  // Sync form when the selected prompt changes
  const promptId = getPromptId(prompt);
  useEffect(() => {
    setForm({
      name: prompt.name || "",
      promptText: prompt.promptText || prompt.prompt_text || "",
      systemMessage: prompt.systemMessage || prompt.system_message || "",
      model: prompt.model || "gpt-4o",
      temperature: prompt.temperature != null ? String(prompt.temperature) : "0.7",
      maxTokens: prompt.maxTokens != null ? String(prompt.maxTokens) : "1000",
      status: prompt.status || "active",
      useCase: prompt.useCase || prompt.use_case || "",
      notes: prompt.notes || "",
      campaignsId: prompt.campaignsId != null ? String(prompt.campaignsId) : (prompt.Campaigns_id != null ? String(prompt.Campaigns_id) : ""),
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
      toast({ title: "Failed to save", description: err.message || "Unknown error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    "w-full h-9 rounded-xl border bg-popover px-2.5 text-[12px] outline-none focus:ring-2 focus:ring-brand-indigo/30";
  const textareaCls =
    "w-full rounded-xl border bg-popover px-2.5 py-2 text-[12px] outline-none focus:ring-2 focus:ring-brand-indigo/30 resize-y";
  const selectCls =
    "w-full h-9 rounded-xl border bg-popover px-2.5 text-[12px] outline-none focus:ring-2 focus:ring-brand-indigo/30";
  const labelCls = "text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-0.5 block";

  return (
    <div className="space-y-4">
      {/* Top row: Name + Use Case side by side */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Name *</label>
          <input
            className={cn(inputCls, errors.name ? "border-red-400" : "border-border/30")}
            value={form.name}
            onChange={(e) => setField("name", e.target.value)}
            placeholder="Prompt name"
          />
          {errors.name && <p className="text-[10px] text-red-500 mt-0.5">{errors.name}</p>}
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

      {/* Prompt Text */}
      <div>
        <label className={labelCls}>Prompt Text *</label>
        <textarea
          className={cn(textareaCls, "min-h-[120px]", errors.promptText ? "border-red-400" : "border-border/30")}
          value={form.promptText}
          onChange={(e) => setField("promptText", e.target.value)}
          placeholder="Main prompt text…"
        />
        {errors.promptText && <p className="text-[10px] text-red-500 mt-0.5">{errors.promptText}</p>}
      </div>

      {/* System Message + Notes side by side */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>System Message</label>
          <textarea
            className={cn(textareaCls, "min-h-[80px] border-border/30")}
            value={form.systemMessage}
            onChange={(e) => setField("systemMessage", e.target.value)}
            placeholder="System instructions (optional)…"
          />
        </div>
        <div>
          <label className={labelCls}>Notes</label>
          <textarea
            className={cn(textareaCls, "min-h-[80px] border-border/30")}
            value={form.notes}
            onChange={(e) => setField("notes", e.target.value)}
            placeholder="Additional notes (optional)…"
          />
        </div>
      </div>

      {/* Bottom row: Campaign + Model + Status + Temperature + Max Tokens */}
      <div className="grid grid-cols-5 gap-3">
        <div>
          <label className={labelCls}>Campaign</label>
          <select
            className={cn(selectCls, "border-border/30")}
            value={form.campaignsId}
            onChange={(e) => setField("campaignsId", e.target.value)}
          >
            <option value="">— None —</option>
            {campaigns.map((c) => (
              <option key={c.id} value={String(c.id)}>{c.name}</option>
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
              <option key={m} value={m}>{m}</option>
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
            className={cn(inputCls, errors.temperature ? "border-red-400" : "border-border/30")}
            value={form.temperature}
            onChange={(e) => setField("temperature", e.target.value)}
          />
          {errors.temperature && <p className="text-[10px] text-red-500 mt-0.5">{errors.temperature}</p>}
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
          {errors.maxTokens && <p className="text-[10px] text-red-500 mt-0.5">{errors.maxTokens}</p>}
        </div>
      </div>

      {/* Action row */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={handleSave}
          disabled={saving}
          className="h-9 px-4 rounded-xl bg-brand-indigo text-white text-[12px] font-semibold hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-1.5"
        >
          <Save className="h-3.5 w-3.5" />
          {saving ? "Saving…" : "Save Changes"}
        </button>
        <button
          onClick={() => onDelete(prompt)}
          className="h-9 px-3 rounded-xl text-[12px] font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 inline-flex items-center gap-1.5"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   PromptsCardView — horizontal card strip + edit panel below
   ════════════════════════════════════════════════════════════════════════════ */

interface PromptsCardViewProps {
  prompts: any[];
  searchQuery: string;
  isFilterActive: boolean;
  togglingIds: Set<number>;
  onSaved: (prompt: any) => void;
  onDelete: (prompt: any) => void;
  onToggleStatus: (prompt: any) => void;
  campaignMap: Map<number, string>;
  campaigns: { id: number; name: string }[];
}

export function PromptsCardView({
  prompts,
  searchQuery,
  isFilterActive,
  togglingIds,
  onSaved,
  onDelete,
  onToggleStatus,
  campaignMap,
  campaigns,
}: PromptsCardViewProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  // Auto-select first prompt when list changes
  useEffect(() => {
    if (prompts.length > 0) {
      const firstId = getPromptId(prompts[0]);
      setSelectedId((prev) => {
        // Keep selection if it still exists in the filtered list
        if (prev !== null && prompts.some((p) => getPromptId(p) === prev)) return prev;
        return firstId;
      });
    } else {
      setSelectedId(null);
    }
  }, [prompts]);

  const selectedPrompt = prompts.find((p) => getPromptId(p) === selectedId) ?? null;

  /* ── Empty state ──────────────────────────────────────────────────────── */
  if (prompts.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <DataEmptyState
          variant={searchQuery || isFilterActive ? "search" : "prompts"}
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* ── Horizontal card strip ─────────────────────────────────────────── */}
      <div
        ref={stripRef}
        className="shrink-0 flex gap-2 px-4 pt-3 pb-2 overflow-x-auto [scrollbar-width:thin]"
      >
        {prompts.map((p: any) => {
          const promptId = getPromptId(p);
          const isSelected = selectedId === promptId;
          const isToggling = togglingIds.has(promptId);

          return (
            <button
              key={promptId}
              onClick={() => setSelectedId(promptId)}
              className={cn(
                "shrink-0 rounded-2xl px-4 py-3 text-left transition-all duration-150 min-w-[200px] max-w-[280px]",
                isSelected
                  ? "bg-[#FFF1C8] ring-2 ring-[#FFE35B]"
                  : "bg-card hover:bg-popover",
              )}
            >
              {/* Name */}
              <div className="font-semibold text-[13px] text-foreground leading-snug truncate">
                {p.name || <span className="text-muted-foreground italic">Untitled</span>}
              </div>

              {/* Campaign label */}
              {(() => {
                const cId = p.campaignsId || p.Campaigns_id;
                const cName = cId ? campaignMap.get(cId) : null;
                return cName ? (
                  <div className="mt-1 text-[10px] text-muted-foreground/60 truncate">{cName}</div>
                ) : null;
              })()}

              {/* Model + Score row */}
              <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                <span className="truncate">{p.model || "—"}</span>
                {p.performanceScore != null ? (
                  <span className={`inline-flex items-center gap-0.5 shrink-0 font-medium ${getScoreColorClasses(p.performanceScore)}`}>
                    <Star className="h-3 w-3 fill-current" />
                    {p.performanceScore}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-0.5 shrink-0 text-muted-foreground/40">
                    <Star className="h-3 w-3" />—
                  </span>
                )}
              </div>

              {/* Status badge */}
              <div className="mt-2 flex items-center justify-between">
                <span
                  onClick={(e) => { e.stopPropagation(); onToggleStatus(p); }}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium cursor-pointer hover:opacity-80 transition-opacity",
                    getStatusBadgeClasses(p.status),
                    isToggling && "opacity-50 cursor-not-allowed",
                  )}
                >
                  {isToggling ? (
                    <span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                  ) : (p.status || "").toLowerCase() === "active" ? (
                    <ToggleRight className="h-3 w-3" />
                  ) : (
                    <ToggleLeft className="h-3 w-3" />
                  )}
                  {getStatusLabel(p.status)}
                </span>

                {p.version && (
                  <span className="text-[10px] font-mono text-muted-foreground/50">
                    v{p.version}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Edit panel below ──────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
        <AnimatePresence mode="wait">
          {selectedPrompt && (
            <motion.div
              key={selectedId}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="rounded-2xl bg-popover p-5"
            >
              <EditPanel
                prompt={selectedPrompt}
                onSaved={onSaved}
                onDelete={onDelete}
                campaigns={campaigns}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
