import { useMemo, useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { MODEL_OPTIONS } from "@/features/prompts/types";
import { CrmShell } from "@/components/crm/CrmShell";
import { useWorkspace } from "@/hooks/useWorkspace";
import { apiFetch } from "@/lib/apiUtils";
import { ApiErrorFallback } from "@/components/crm/ApiErrorFallback";
import { Button } from "@/components/ui/button";
import { IconBtn } from "@/components/ui/icon-btn";
import { SearchPill } from "@/components/ui/search-pill";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Plus,
  Pencil,
  Trash2,
  AlertTriangle,
  Star,
  ToggleLeft,
  ToggleRight,
  BookOpen,
  Bot,
  Clock,
  FileText,
  Thermometer,
  Hash,
  Settings,
  Paintbrush,
  ArrowLeft,
  Megaphone,
} from "lucide-react";
import { GradientTester, GradientControlPoints, DEFAULT_LAYERS, layerToStyle, type GradientLayer } from "@/components/ui/gradient-tester";
import { useToast } from "@/hooks/use-toast";
import { useTopbarActions } from "@/contexts/TopbarActionsContext";
import { useIsMobile } from "@/hooks/useIsMobile";
import { cn } from "@/lib/utils";

/** Returns Tailwind classes for the status badge based on status value */
function getStatusBadgeClasses(status: string | null | undefined): string {
  const normalized = (status || "").toLowerCase().trim();
  if (normalized === "active") {
    return "bg-emerald-500/15 text-emerald-600";
  }
  if (normalized === "archived") {
    return "bg-zinc-500/15 text-zinc-500";
  }
  return "bg-zinc-500/15 text-zinc-400";
}

function getStatusLabel(status: string | null | undefined): string {
  const normalized = (status || "").trim();
  return normalized || "Unknown";
}

/** Returns color classes for the performance score badge based on numeric value */
function getScoreColorClasses(score: string | null | undefined): string {
  const num = parseFloat(score || "");
  if (isNaN(num)) return "text-muted-foreground";
  if (num >= 8) return "text-emerald-600";
  if (num >= 6) return "text-amber-600";
  return "text-red-600";
}

// ─── Prompt Form Dialog ──────────────────────────────────────────────────

interface PromptFormData {
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

const EMPTY_FORM: PromptFormData = {
  name: "",
  promptText: "",
  systemMessage: "",
  model: "gpt-5.1",
  temperature: "0.7",
  maxTokens: "1000",
  status: "active",
  useCase: "",
  notes: "",
  campaignsId: "",
};


interface PromptFormDialogProps {
  open: boolean;
  onClose: () => void;
  prompt: any | null; // null means create mode
  onSaved: (prompt: any) => void;
}

function PromptFormDialog({ open, onClose, prompt, onSaved }: PromptFormDialogProps) {
  const { t } = useTranslation("prompts");
  const { toast } = useToast();
  const isEdit = prompt !== null;

  const [form, setForm] = useState<PromptFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<PromptFormData>>({});
  const [availableCampaigns, setAvailableCampaigns] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    apiFetch("/api/campaigns")
      .then((r) => r.ok ? r.json() : [])
      .then((data: any[]) => {
        if (Array.isArray(data)) {
          setAvailableCampaigns(data.map((c: any) => ({ id: c.id || c.Id, name: String(c.name || "Campaign") })).filter((c) => c.id));
        }
      })
      .catch(() => {});
  }, []);

  // Pre-populate fields when editing
  useEffect(() => {
    if (open) {
      if (isEdit && prompt) {
        setForm({
          name: prompt.name || "",
          promptText: prompt.promptText || prompt.prompt_text || "",
          systemMessage: prompt.systemMessage || prompt.system_message || "",
          model: prompt.model || "gpt-5.1",
          temperature: prompt.temperature != null ? String(prompt.temperature) : "0.7",
          maxTokens: prompt.maxTokens != null ? String(prompt.maxTokens) : "1000",
          status: prompt.status || "active",
          useCase: prompt.useCase || prompt.use_case || "",
          notes: prompt.notes || "",
          campaignsId: String(prompt.campaignsId || prompt.Campaigns_id || prompt.campaigns_id || ""),
        });
      } else {
        setForm(EMPTY_FORM);
      }
      setErrors({});
    }
  }, [open, prompt, isEdit]);

  function setField(field: keyof PromptFormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function validate(): boolean {
    const newErrors: Partial<PromptFormData> = {};
    if (!form.name.trim()) newErrors.name = t("form.nameRequired");
    if (!form.promptText.trim()) newErrors.promptText = t("form.promptTextRequired");
    const temp = parseFloat(form.temperature);
    if (isNaN(temp) || temp < 0 || temp > 2) newErrors.temperature = t("form.temperatureError");
    const tokens = parseInt(form.maxTokens, 10);
    if (isNaN(tokens) || tokens < 1) newErrors.maxTokens = t("form.maxTokensError");
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit() {
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
        campaignsId: form.campaignsId ? Number(form.campaignsId) : null,
      };

      let res: Response;
      if (isEdit) {
        res = await apiFetch(`/api/prompts/${prompt.id || prompt.Id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await apiFetch("/api/prompts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.message || errBody?.errors?.[0]?.message || errBody?.error || `HTTP ${res.status}`);
      }

      const saved = await res.json();
      onSaved(saved);
      toast({
        title: isEdit ? t("toast.updated") : t("toast.created"),
        description: isEdit
          ? t("toast.updatedDescription", { name: form.name })
          : t("toast.createdDescription", { name: form.name }),
      });
      onClose();
    } catch (err: any) {
      toast({
        title: isEdit ? t("toast.updateFailed") : t("toast.createFailed"),
        description: err.message || t("status.unknown"),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !saving) onClose(); }}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        data-testid={isEdit ? "dialog-edit-prompt" : "dialog-create-prompt"}
      >
        <DialogHeader>
          <DialogTitle>{isEdit ? t("form.editTitle") : t("form.createTitle")}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? t("form.editDescription")
              : t("form.createDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Name */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground" htmlFor="prompt-name">
              {t("form.name")} <span className="text-red-500">*</span>
            </label>
            <input
              id="prompt-name"
              className={`w-full h-10 rounded-lg border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30 ${errors.name ? "border-red-400" : "border-border"}`}
              placeholder={t("form.namePlaceholder")}
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              data-testid="input-prompt-name"
            />
            {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
          </div>

          {/* Use Case */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground" htmlFor="prompt-use-case">
              {t("form.useCase")}
            </label>
            <input
              id="prompt-use-case"
              className="w-full h-10 rounded-lg border border-border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              placeholder={t("form.useCasePlaceholder")}
              value={form.useCase}
              onChange={(e) => setField("useCase", e.target.value)}
              data-testid="input-prompt-use-case"
            />
          </div>

          {/* Campaign */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground" htmlFor="prompt-campaign">
              {t("form.campaign")}
            </label>
            <select
              id="prompt-campaign"
              className="w-full h-10 rounded-lg border border-border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              value={form.campaignsId}
              onChange={(e) => setField("campaignsId", e.target.value)}
              data-testid="select-prompt-campaign"
            >
              <option value="">{t("form.noCampaign")}</option>
              {availableCampaigns.map((c) => (
                <option key={c.id} value={String(c.id)}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Prompt Text */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground" htmlFor="prompt-text">
              {t("form.promptText")} <span className="text-red-500">*</span>
            </label>
            <textarea
              id="prompt-text"
              className={`w-full min-h-[120px] rounded-lg border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-y ${errors.promptText ? "border-red-400" : "border-border"}`}
              placeholder={t("form.promptTextPlaceholder")}
              value={form.promptText}
              onChange={(e) => setField("promptText", e.target.value)}
              data-testid="textarea-prompt-text"
            />
            {errors.promptText && <p className="text-xs text-red-500">{errors.promptText}</p>}
          </div>

          {/* System Message */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground" htmlFor="prompt-system-message">
              {t("form.systemMessage")}
            </label>
            <textarea
              id="prompt-system-message"
              className="w-full min-h-[80px] rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-y"
              placeholder={t("form.systemMessagePlaceholder")}
              value={form.systemMessage}
              onChange={(e) => setField("systemMessage", e.target.value)}
              data-testid="textarea-system-message"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground" htmlFor="prompt-notes">
              {t("form.notes")}
            </label>
            <textarea
              id="prompt-notes"
              className="w-full min-h-[80px] rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-y"
              placeholder={t("form.notesPlaceholder")}
              value={form.notes}
              onChange={(e) => setField("notes", e.target.value)}
              data-testid="textarea-prompt-notes"
            />
          </div>

          {/* Row: Model + Status */}
          <div className="grid grid-cols-2 gap-4">
            {/* Model */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground" htmlFor="prompt-model">
                {t("detail.model")}
              </label>
              <Select value={form.model} onValueChange={(v) => setField("model", v)}>
                <SelectTrigger
                  className="w-full h-10 rounded-lg bg-card"
                  data-testid="select-prompt-model"
                >
                  <SelectValue placeholder={t("form.selectModel")} />
                </SelectTrigger>
                <SelectContent>
                  {MODEL_OPTIONS.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground" htmlFor="prompt-status">
                {t("labels.status")}
              </label>
              <Select value={form.status} onValueChange={(v) => setField("status", v)}>
                <SelectTrigger
                  className="w-full h-10 rounded-lg bg-card"
                  data-testid="select-prompt-status"
                >
                  <SelectValue placeholder={t("form.selectStatus")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{t("status.active")}</SelectItem>
                  <SelectItem value="archived">{t("status.archived")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row: Temperature + Max Tokens */}
          <div className="grid grid-cols-2 gap-4">
            {/* Temperature */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground" htmlFor="prompt-temperature">
                {t("form.temperature")} <span className="text-muted-foreground text-xs">{t("form.temperatureRange")}</span>
              </label>
              <input
                id="prompt-temperature"
                type="number"
                step="0.1"
                min="0"
                max="2"
                className={`w-full h-10 rounded-lg border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30 ${errors.temperature ? "border-red-400" : "border-border"}`}
                value={form.temperature}
                onChange={(e) => setField("temperature", e.target.value)}
                data-testid="input-prompt-temperature"
              />
              {errors.temperature && <p className="text-xs text-red-500">{errors.temperature}</p>}
            </div>

            {/* Max Tokens */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground" htmlFor="prompt-max-tokens">
                {t("form.maxTokens")}
              </label>
              <input
                id="prompt-max-tokens"
                type="number"
                min="1"
                className={`w-full h-10 rounded-lg border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30 ${errors.maxTokens ? "border-red-400" : "border-border"}`}
                value={form.maxTokens}
                onChange={(e) => setField("maxTokens", e.target.value)}
                data-testid="input-prompt-max-tokens"
              />
              {errors.maxTokens && <p className="text-xs text-red-500">{errors.maxTokens}</p>}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={saving}
            data-testid="button-cancel-prompt"
          >
            {t("actions.cancel")}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving}
            data-testid="button-save-prompt"
          >
            {saving ? (isEdit ? t("actions.saving") : t("actions.creating")) : (isEdit ? t("actions.saveChanges") : t("actions.createPrompt"))}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Delete Confirmation Dialog ──────────────────────────────────────────

interface DeletePromptDialogProps {
  open: boolean;
  onClose: () => void;
  prompt: any | null;
  onDeleted: (id: number) => void;
}

function DeletePromptDialog({ open, onClose, prompt, onDeleted }: DeletePromptDialogProps) {
  const { t } = useTranslation("prompts");
  const { toast } = useToast();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!prompt) return;
    setDeleting(true);
    try {
      const id = prompt.id || prompt.Id;
      const res = await apiFetch(`/api/prompts/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onDeleted(id);
      toast({
        title: t("toast.deleted"),
        description: t("toast.deletedDescription", { name: prompt.name }),
      });
      onClose();
    } catch (err: any) {
      toast({
        title: t("toast.deleteFailed"),
        description: err.message || t("status.unknown"),
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !deleting) onClose(); }}>
      <DialogContent className="max-w-md" data-testid="dialog-delete-prompt">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            {t("deleteDialog.title")}
          </DialogTitle>
          <DialogDescription>
            {t("deleteDialog.message")}{" "}
            <span className="font-semibold text-foreground">"{prompt?.name}"</span>?
            {" "}{t("deleteDialog.cannotUndo")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={deleting}
            data-testid="button-cancel-delete-prompt"
          >
            {t("actions.cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting}
            data-testid="button-confirm-delete-prompt"
          >
            {deleting ? t("deleteDialog.deleting") : t("deleteDialog.deletePrompt")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Settings Dropdown ───────────────────────────────────────────────────

function SettingsDropdown({
  statusFilter,
  onStatusFilterChange,
  campaignFilter,
  onCampaignFilterChange,
  availableCampaigns,
}: {
  statusFilter: string;
  onStatusFilterChange: (v: string) => void;
  campaignFilter: string;
  onCampaignFilterChange: (v: string) => void;
  availableCampaigns: Array<{ id: string; name: string }>;
}) {
  const { t } = useTranslation("prompts");
  const [open, setOpen] = useState(false);
  const isActive = statusFilter !== "all" || campaignFilter !== "all";
  const filterCount = (statusFilter !== "all" ? 1 : 0) + (campaignFilter !== "all" ? 1 : 0);

  return (
    <div className="relative">
      <IconBtn
        onClick={() => setOpen((o) => !o)}
        active={isActive}
        title={t("toolbar.filterSettings")}
      >
        <Settings className="h-4 w-4" />
      </IconBtn>
      {isActive && (
        <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-brand-indigo text-[8px] font-bold text-white flex items-center justify-center pointer-events-none">
          {filterCount}
        </span>
      )}
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1.5 z-50 w-[220px] bg-white rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] ring-1 ring-black/[0.06] border border-border/30 overflow-hidden">
            <div className="p-2.5 space-y-3">
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t("labels.status")}</span>
                <Select value={statusFilter} onValueChange={onStatusFilterChange}>
                  <SelectTrigger className="w-full h-8 rounded-lg bg-card text-[12px]">
                    <SelectValue placeholder={t("toolbar.allStatuses")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("toolbar.allStatuses")}</SelectItem>
                    <SelectItem value="active">{t("status.active")}</SelectItem>
                    <SelectItem value="archived">{t("status.archived")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t("detail.campaign")}</span>
                <Select value={campaignFilter} onValueChange={onCampaignFilterChange}>
                  <SelectTrigger className="w-full h-8 rounded-lg bg-card text-[12px]">
                    <SelectValue placeholder={t("toolbar.allCampaigns", "All campaigns")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("toolbar.allCampaigns", "All campaigns")}</SelectItem>
                    <SelectItem value="none">{t("toolbar.assistantPrompts", "Assistant prompts")}</SelectItem>
                    {availableCampaigns.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {isActive && (
                <button
                  onClick={() => {
                    onStatusFilterChange("all");
                    onCampaignFilterChange("all");
                  }}
                  className="w-full text-center text-[11px] text-primary font-medium hover:underline"
                >
                  {t("toolbar.clearAllFilters")}
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Prompt Card for left panel ──────────────────────────────────────────

function PromptCard({
  prompt,
  selected,
  onClick,
}: {
  prompt: any;
  selected: boolean;
  onClick: () => void;
}) {
  const { t } = useTranslation("prompts");
  const statusNorm = ((prompt.status || "") as string).toLowerCase().trim();

  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-xl px-3 py-2.5 cursor-pointer transition-colors",
        selected
          ? "bg-highlight-selected"
          : "bg-card hover:bg-card-hover"
      )}
      data-testid={`card-prompt-${prompt.id || prompt.Id}`}
    >
      {/* Row 1: name + status */}
      <div className="flex items-start justify-between gap-2">
        <span className="text-[13px] font-semibold text-foreground leading-snug truncate flex-1">
          {prompt.name || t("labels.untitled")}
        </span>
        <span className={cn(
          "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold shrink-0",
          getStatusBadgeClasses(prompt.status)
        )}>
          <span className={cn(
            "w-1.5 h-1.5 rounded-full",
            statusNorm === "active" ? "bg-emerald-500" : "bg-zinc-400"
          )} />
          {getStatusLabel(prompt.status)}
        </span>
      </div>

      {/* Row 2: model + use case */}
      <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
        {prompt.model && (
          <span className="font-mono truncate">{prompt.model}</span>
        )}
        {prompt.model && (prompt.useCase || prompt.use_case) && (
          <span className="text-border">&middot;</span>
        )}
        {(prompt.useCase || prompt.use_case) && (
          <span className="truncate">{prompt.useCase || prompt.use_case}</span>
        )}
      </div>

      {/* Row 3: text preview */}
      {(prompt.promptText || prompt.prompt_text) && (
        <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2 leading-snug">
          {(prompt.promptText || prompt.prompt_text).slice(0, 120)}
        </p>
      )}

      {/* Row 4: score */}
      {prompt.performanceScore != null && (
        <div className="mt-1 flex items-center gap-1">
          <Star className={cn("h-3 w-3 fill-current", getScoreColorClasses(prompt.performanceScore))} />
          <span className={cn("text-[11px] font-medium tabular-nums", getScoreColorClasses(prompt.performanceScore))}>
            {prompt.performanceScore}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Right Panel Detail View ─────────────────────────────────────────────

function PromptDetailPanel({
  prompt,
  onEdit,
  onDelete,
  onToggleStatus,
  isToggling,
  gradientTesterOpen,
  onToggleGradientTester,
  isAgencyView,
  availableCampaigns,
  onCampaignChange,
}: {
  prompt: any;
  onEdit: () => void;
  onDelete: () => void;
  onToggleStatus: () => void;
  isToggling: boolean;
  gradientTesterOpen: boolean;
  onToggleGradientTester: () => void;
  isAgencyView: boolean;
  availableCampaigns: Array<{ id: string; name: string }>;
  onCampaignChange: (promptId: number, campaignsId: number | null) => void;
}) {
  const { t } = useTranslation("prompts");
  const [, navigate] = useLocation();
  const [editingCampaign, setEditingCampaign] = useState(false);
  const statusNorm = ((prompt.status || "") as string).toLowerCase().trim();
  const promptText = prompt.promptText || prompt.prompt_text || "";
  const systemMessage = prompt.systemMessage || prompt.system_message || "";
  const useCase = prompt.useCase || prompt.use_case || "";
  const campaignName = prompt.campaign_name || prompt.Campaign_name || prompt.campaignName || "";

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-4 py-2.5 border-b border-border/60 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {t("detail.promptDetail")}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onToggleGradientTester}
            className={`inline-flex items-center justify-center h-9 w-9 rounded-full text-[12px] font-medium border transition-colors ${gradientTesterOpen ? "bg-indigo-100 text-indigo-600 border-indigo-200" : "border-black/[0.125] bg-transparent text-foreground hover:bg-muted/50"}`}
            title={t("detail.gradientTester")}
          >
            <Paintbrush className="h-4 w-4" />
          </button>
          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-foreground/5 hover:bg-foreground/10 text-foreground border border-border/50 text-xs font-semibold transition-colors"
            data-testid="button-edit-selected-prompt"
          >
            <Pencil className="w-3.5 h-3.5" />
            {t("actions.edit")}
          </button>
          <button
            onClick={onDelete}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-foreground/5 hover:bg-red-50 text-foreground hover:text-red-600 border border-border/50 text-xs font-semibold transition-colors"
            data-testid="button-delete-selected-prompt"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {t("actions.delete")}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {/* Name + status */}
        <div>
          <h2 className="text-lg font-bold text-foreground leading-tight">
            {prompt.name || t("labels.untitled")}
          </h2>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <button
              onClick={onToggleStatus}
              disabled={isToggling}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold cursor-pointer hover:opacity-80 transition-opacity",
                getStatusBadgeClasses(prompt.status),
                isToggling && "opacity-50 cursor-not-allowed"
              )}
              title={statusNorm === "active" ? t("detail.clickToArchive") : t("detail.clickToActivate")}
            >
              {isToggling ? (
                <span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
              ) : statusNorm === "active" ? (
                <ToggleRight className="h-3 w-3" />
              ) : (
                <ToggleLeft className="h-3 w-3" />
              )}
              {getStatusLabel(prompt.status)}
            </button>
            {prompt.version && (
              <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-mono font-medium text-foreground">
                v{prompt.version}
              </span>
            )}
            {prompt.performanceScore != null && (
              <span className={cn("inline-flex items-center gap-1 font-medium text-[12px]", getScoreColorClasses(prompt.performanceScore))}>
                <Star className="h-3.5 w-3.5 fill-current" />
                {prompt.performanceScore}
              </span>
            )}
          </div>
        </div>

        {/* Key fields */}
        <div className="rounded-lg border border-border/40 bg-muted/20 px-2.5 py-2 space-y-1.5 text-[12px]">
          {useCase && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground flex items-center gap-1">
                <FileText className="h-3 w-3" /> {t("detail.useCase")}
              </span>
              <span className="font-medium truncate max-w-[200px]">{useCase}</span>
            </div>
          )}
          {/* Campaign row */}
          <div className="flex items-center justify-between gap-2 group">
            <span className="text-muted-foreground flex items-center gap-1 shrink-0">
              <Megaphone className="h-3 w-3" /> {t("detail.campaign")}
            </span>
            <div className="flex items-center gap-1 min-w-0">
              {/* Pencil icon — triggers inline campaign select */}
              {!editingCampaign && (
                <button
                  type="button"
                  className="p-0.5 rounded hover:bg-muted shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setEditingCampaign(true)}
                  title={t("detail.changeCampaign", "Change campaign")}
                >
                  <Pencil className="w-3 h-3" />
                </button>
              )}
              {editingCampaign ? (
                <select
                  value={String(prompt.campaignsId || prompt.Campaigns_id || "")}
                  onChange={(e) => {
                    const val = e.target.value;
                    onCampaignChange(prompt.id || prompt.Id, val ? Number(val) : null);
                    setEditingCampaign(false);
                  }}
                  onBlur={() => setEditingCampaign(false)}
                  autoFocus
                  className="text-xs rounded border border-input bg-background px-2 py-1 max-w-[180px]"
                >
                  <option value="">{t("form.noCampaign", "— No campaign linked")}</option>
                  {availableCampaigns.map((c) => (
                    <option key={c.id} value={String(c.id)}>{c.name}</option>
                  ))}
                </select>
              ) : campaignName ? (
                <button
                  type="button"
                  className="text-xs px-2 py-0.5 rounded-full bg-muted hover:bg-muted/80 text-foreground transition-colors truncate max-w-[180px]"
                  onClick={() => navigate(isAgencyView ? "/agency/campaigns" : "/subaccount/campaigns")}
                  title={t("detail.openCampaign", "Open campaigns page")}
                >
                  {campaignName}
                </button>
              ) : (
                <span className="text-xs text-muted-foreground italic">{t("form.noCampaign", "— No campaign linked")}</span>
              )}
            </div>
          </div>
          {(prompt.createdAt || prompt.created_at) && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" /> {t("detail.created")}
              </span>
              <span className="font-mono text-[11px]">
                {new Date(prompt.createdAt || prompt.created_at).toLocaleDateString()}
              </span>
            </div>
          )}
          {(prompt.updatedAt || prompt.updated_at) && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" /> {t("detail.updated")}
              </span>
              <span className="font-mono text-[11px]">
                {new Date(prompt.updatedAt || prompt.updated_at).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>

        {/* Prompt Text */}
        {promptText && (
          <div className="rounded-lg border border-border/40 bg-muted/20 px-2.5 py-2">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
              {t("detail.promptText")}
            </div>
            <p className="text-[12px] text-foreground/80 leading-relaxed whitespace-pre-wrap">{promptText}</p>
          </div>
        )}

        {/* System Message */}
        {systemMessage && (
          <div className="rounded-lg border border-border/40 bg-muted/20 px-2.5 py-2">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
              {t("detail.systemMessage")}
            </div>
            <p className="text-[12px] text-foreground/80 leading-relaxed whitespace-pre-wrap">{systemMessage}</p>
          </div>
        )}

        {/* Notes */}
        {prompt.notes && (
          <div className="rounded-lg border border-border/40 bg-muted/20 px-2.5 py-2">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
              {t("detail.notes")}
            </div>
            <p className="text-[12px] text-foreground/80 leading-relaxed whitespace-pre-wrap">{prompt.notes}</p>
          </div>
        )}

        {/* Model / Temperature / Max Tokens */}
        {(prompt.model || prompt.temperature != null || prompt.maxTokens != null) && (
          <div className="rounded-lg border border-border/40 bg-muted/20 px-2.5 py-2 space-y-1.5 text-[12px]">
            {prompt.model && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Bot className="h-3 w-3" /> {t("detail.model")}
                </span>
                <span className="font-mono font-medium">{prompt.model}</span>
              </div>
            )}
            {prompt.temperature != null && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Thermometer className="h-3 w-3" /> {t("detail.temperature")}
                </span>
                <span className="font-mono font-medium">{prompt.temperature}</span>
              </div>
            )}
            {prompt.maxTokens != null && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Hash className="h-3 w-3" /> {t("detail.maxTokens")}
                </span>
                <span className="font-mono font-medium">{prompt.maxTokens}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PromptDetailEmpty() {
  const { t } = useTranslation("prompts");
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
      <div className="w-14 h-14 rounded-2xl bg-muted/60 flex items-center justify-center">
        <BookOpen className="w-7 h-7 text-muted-foreground/40" />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground/70">{t("empty.selectPrompt")}</p>
        <p className="text-xs text-muted-foreground mt-1">{t("empty.selectPromptDesc")}</p>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────

export default function PromptLibraryPage() {
  const { t } = useTranslation("prompts");
  const { isAgencyView } = useWorkspace();
  const { toast } = useToast();
  const { clearTopbarActions } = useTopbarActions();
  const isMobile = useIsMobile(768);

  const [q, setQ] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [modelFilter, setModelFilter] = useState<string>("all");
  const [campaignFilter, setCampaignFilter] = useState<string>("all");
  const [promptLibraryData, setPromptLibraryData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [selectedPromptId, setSelectedPromptId] = useState<number | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  // Create/Edit dialog
  const [formOpen, setFormOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<any | null>(null);

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingPrompt, setDeletingPrompt] = useState<any | null>(null);

  // Status toggle loading state (keyed by prompt id)
  const [togglingIds, setTogglingIds] = useState<Set<number>>(new Set());

  // Gradient tester state
  const GRADIENT_KEY = "la:gradient:prompts";
  const [savedGradient, setSavedGradient] = useState<GradientLayer[] | null>(() => {
    try { const raw = localStorage.getItem(GRADIENT_KEY); return raw ? JSON.parse(raw) as GradientLayer[] : null; } catch { return null; }
  });
  const [gradientTesterOpen, setGradientTesterOpen] = useState(false);
  const [gradientLayers, setGradientLayers] = useState<GradientLayer[]>(DEFAULT_LAYERS);
  const [gradientDragMode, setGradientDragMode] = useState(false);

  const updateGradientLayer = useCallback((id: number, patch: Partial<GradientLayer>) => {
    if (id === -1) { setGradientLayers(prev => [...prev, patch as GradientLayer]); return; }
    if ((patch as any).id === -999) { setGradientLayers(prev => prev.filter(l => l.id !== id)); return; }
    setGradientLayers(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));
  }, []);

  const resetGradientLayers = useCallback(() => {
    setGradientLayers(DEFAULT_LAYERS);
    setGradientDragMode(false);
  }, []);

  const handleApplyGradient = useCallback(() => {
    localStorage.setItem(GRADIENT_KEY, JSON.stringify(gradientLayers));
    setSavedGradient(gradientLayers);
    setGradientTesterOpen(false);
  }, [gradientLayers]);
  const toggleGradientTester = useCallback(() => {
    setGradientTesterOpen(prev => {
      if (!prev && savedGradient) setGradientLayers(savedGradient);
      return !prev;
    });
  }, [savedGradient]);

  // Clear topbar actions (tabs are inline)
  useEffect(() => {
    clearTopbarActions();
  }, [clearTopbarActions]);

  const fetchPrompts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/prompts");
      if (!res.ok) throw new Error(`${res.status}: Failed to fetch prompts`);
      const data = await res.json();
      setPromptLibraryData(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch prompts:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [isAgencyView]);

  useEffect(() => {
    fetchPrompts();
  }, [fetchPrompts]);

  // Auto-select prompt from cross-page navigation (e.g. clicking linked prompt in campaign config)
  useEffect(() => {
    if (promptLibraryData.length === 0) return;
    const storedId = localStorage.getItem("prompt-library-initial-id");
    if (storedId) {
      localStorage.removeItem("prompt-library-initial-id");
      const id = Number(storedId);
      const found = promptLibraryData.find((p: any) => (p.id || p.Id) === id);
      if (found) setSelectedPromptId(id);
    }
  }, [promptLibraryData]); // re-run each time prompts loads (first non-empty load will trigger)

  // Derive unique campaigns from loaded prompts for the campaign filter dropdown
  const availableCampaignsForFilter = useMemo(() => {
    const seen = new Set<string>();
    const list: Array<{ id: string; name: string }> = [];
    for (const p of promptLibraryData) {
      const cid = String(p.campaignsId || p.Campaigns_id || "");
      const cname = p.campaign_name || p.Campaign_name || p.campaignName || "";
      if (cid && !seen.has(cid)) {
        seen.add(cid);
        list.push({ id: cid, name: cname || `Campaign ${cid}` });
      }
    }
    return list;
  }, [promptLibraryData]);

  const rows = useMemo(() => {
    let filtered = promptLibraryData.filter((p: any) => {
      // Name search filter
      if (q && !(p.name || "").toLowerCase().includes(q.toLowerCase())) return false;
      // Status filter
      if (statusFilter !== "all") {
        const pStatus = (p.status || "").toLowerCase().trim();
        if (pStatus !== statusFilter) return false;
      }
      // Model filter
      if (modelFilter !== "all") {
        const pModel = (p.model || "").trim();
        if (pModel !== modelFilter) return false;
      }
      return true;
    });
    // Campaign filter
    if (campaignFilter === "none") {
      filtered = filtered.filter((p: any) => !p.campaignsId && !p.Campaigns_id);
    } else if (campaignFilter !== "all") {
      filtered = filtered.filter((p: any) =>
        String(p.campaignsId || p.Campaigns_id || "") === campaignFilter
      );
    }
    return filtered;
  }, [promptLibraryData, q, statusFilter, modelFilter, campaignFilter]);

  // Selected prompt object
  const selectedPrompt = useMemo(() => {
    if (selectedPromptId == null) return null;
    return promptLibraryData.find((p) => (p.id || p.Id) === selectedPromptId) ?? null;
  }, [promptLibraryData, selectedPromptId]);

  function openCreate() {
    setEditingPrompt(null);
    setFormOpen(true);
  }

  function openEdit(prompt: any) {
    setEditingPrompt(prompt);
    setFormOpen(true);
  }

  function openDelete(prompt: any) {
    setDeletingPrompt(prompt);
    setDeleteOpen(true);
  }

  function handleSaved(saved: any) {
    const id = saved.id || saved.Id;
    setPromptLibraryData((prev) => {
      const idx = prev.findIndex((p) => (p.id || p.Id) === id);
      if (idx >= 0) {
        // Update existing
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      // New prompt
      return [saved, ...prev];
    });
    // Auto-select the saved prompt
    setSelectedPromptId(id);
  }

  function handleDeleted(id: number) {
    setPromptLibraryData((prev) => prev.filter((p) => (p.id || p.Id) !== id));
    if (selectedPromptId === id) setSelectedPromptId(null);
  }

  async function handleCampaignChange(promptId: number, campaignsId: number | null) {
    // Optimistic update
    setPromptLibraryData((prev) =>
      prev.map((p) => (p.id || p.Id) === promptId ? { ...p, campaignsId: campaignsId ?? undefined } : p)
    );
    try {
      const res = await apiFetch(`/api/prompts/${promptId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignsId }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.message || `HTTP ${res.status}`);
      }
      const updated = await res.json();
      setPromptLibraryData((prev) =>
        prev.map((p) => (p.id || p.Id) === promptId ? updated : p)
      );
    } catch (err: any) {
      // Revert on error by refetching
      fetchPrompts();
      toast({
        title: t("toast.updateFailed"),
        description: err.message || t("status.unknown"),
        variant: "destructive",
      });
    }
  }

  async function handleToggleStatus(prompt: any) {
    const id = prompt.id || prompt.Id;
    const currentStatus = (prompt.status || "").toLowerCase().trim();
    const newStatus = currentStatus === "active" ? "archived" : "active";

    // Prevent double-click while toggling
    if (togglingIds.has(id)) return;

    // Optimistic update
    setTogglingIds((prev) => new Set(prev).add(id));
    setPromptLibraryData((prev) =>
      prev.map((p) => (p.id || p.Id) === id ? { ...p, status: newStatus } : p)
    );

    try {
      const res = await apiFetch(`/api/prompts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.message || `HTTP ${res.status}`);
      }
      const updated = await res.json();
      // Sync with server response
      setPromptLibraryData((prev) =>
        prev.map((p) => (p.id || p.Id) === id ? updated : p)
      );
      toast({
        title: t("toast.statusUpdated"),
        description: t("toast.statusUpdatedDescription", { name: prompt.name, status: newStatus }),
      });
    } catch (err: any) {
      // Revert optimistic update on error
      setPromptLibraryData((prev) =>
        prev.map((p) => (p.id || p.Id) === id ? { ...p, status: currentStatus } : p)
      );
      toast({
        title: t("toast.statusFailed"),
        description: err.message || t("status.unknown"),
        variant: "destructive",
      });
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  return (
    <CrmShell>
      <div className="flex flex-col h-full" data-testid="page-prompt-library">
        <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-0 overflow-y-auto md:overflow-hidden">

          {/* ── LEFT PANEL ── list of prompts ────────────────────────── */}
          <div className="w-full md:w-[340px] shrink-0 flex flex-col bg-muted rounded-lg overflow-hidden">

            {/* Title + controls (single row) */}
            <div className="pl-[17px] pr-3.5 pt-10 pb-3 shrink-0 flex items-center">
              <div className="flex items-center justify-between w-[309px] shrink-0">
                <h2 className="text-2xl font-semibold font-heading text-foreground leading-tight">
                  {t("page.library")}
                </h2>
                <div className="flex items-center gap-1.5">
                  <IconBtn onClick={openCreate} title={t("toolbar.createPrompt")}>
                    <Plus className="h-4 w-4" />
                  </IconBtn>
                  <SearchPill
                    value={q}
                    onChange={setQ}
                    open={searchOpen}
                    onOpenChange={setSearchOpen}
                    placeholder={t("toolbar.searchPlaceholder")}
                  />
                  <SettingsDropdown
                    statusFilter={statusFilter}
                    onStatusFilterChange={setStatusFilter}
                    campaignFilter={campaignFilter}
                    onCampaignFilterChange={setCampaignFilter}
                    availableCampaigns={availableCampaignsForFilter}
                  />
                </div>
              </div>
            </div>

            {/* Prompt list */}
            <div className="flex-1 min-h-0 overflow-y-auto p-[3px] space-y-[3px]">
              {error && promptLibraryData.length === 0 && !loading ? (
                <div className="px-2">
                  <ApiErrorFallback
                    error={error}
                    onRetry={fetchPrompts}
                    isRetrying={loading}
                  />
                </div>
              ) : loading ? (
                <div className="space-y-[3px]">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="h-16 bg-card rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : rows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                  <BookOpen className="h-8 w-8 text-muted-foreground/30 mb-2" />
                  <p className="text-sm font-medium text-muted-foreground">
                    {q || statusFilter !== "all" || campaignFilter !== "all"
                      ? t("empty.noPromptsMatch")
                      : t("empty.noPromptsYet")}
                  </p>
                  {!q && statusFilter === "all" && campaignFilter === "all" && (
                    <button
                      onClick={openCreate}
                      className="mt-2 text-[12px] text-primary font-medium hover:underline"
                    >
                      {t("empty.createFirstPrompt")}
                    </button>
                  )}
                </div>
              ) : (
                rows.map((p: any) => {
                  const pid = p.id || p.Id;
                  return (
                    <PromptCard
                      key={pid}
                      prompt={p}
                      selected={selectedPromptId === pid}
                      onClick={() => {
                        setSelectedPromptId(pid);
                        if (isMobile) setMobileDetailOpen(true);
                      }}
                    />
                  );
                })
              )}
            </div>
          </div>

          {/* ── RIGHT PANEL ── prompt details ─────────────────────────── */}
          <div className="flex flex-1 min-w-0 flex-col rounded-lg md:ml-1.5 overflow-hidden relative">
            {/* ── Warm gradient bloom background (matching Invoices/Expenses) ── */}
            {gradientTesterOpen ? (
              <>
                {gradientLayers.map(layer => {
                  const style = layerToStyle(layer);
                  if (!style) return null;
                  return <div key={layer.id} className="absolute inset-0" style={style} />;
                })}
                {gradientDragMode && (
                  <GradientControlPoints layers={gradientLayers} onUpdateLayer={updateGradientLayer} />
                )}
              </>
            ) : savedGradient ? (
              <>
                {savedGradient.map((layer: GradientLayer) => {
                  const style = layerToStyle(layer);
                  return style ? <div key={layer.id} className="absolute inset-0" style={style} /> : null;
                })}
              </>
            ) : (
              <>
                <div className="absolute inset-0 bg-[#F8F3EB]" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.9)_0%,transparent_60%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,242,134,0.35)_0%,transparent_50%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(241,218,162,0.2)_0%,transparent_70%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(210,188,130,0.15)_0%,transparent_50%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(105,170,255,0.18)_0%,transparent_55%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_center,rgba(165,205,255,0.12)_0%,transparent_60%)]" />
              </>
            )}
            <div className="relative z-10 flex flex-col flex-1 min-h-0">
              {selectedPrompt ? (
                <PromptDetailPanel
                  prompt={selectedPrompt}
                  onEdit={() => openEdit(selectedPrompt)}
                  onDelete={() => openDelete(selectedPrompt)}
                  onToggleStatus={() => handleToggleStatus(selectedPrompt)}
                  isToggling={togglingIds.has(selectedPromptId!)}
                  gradientTesterOpen={gradientTesterOpen}
                  onToggleGradientTester={toggleGradientTester}
                  isAgencyView={isAgencyView}
                  availableCampaigns={availableCampaignsForFilter}
                  onCampaignChange={handleCampaignChange}
                />
              ) : (
                <PromptDetailEmpty />
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Create / Edit Dialog */}
      <PromptFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        prompt={editingPrompt}
        onSaved={handleSaved}
      />

      {/* Delete Confirmation Dialog */}
      <DeletePromptDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        prompt={deletingPrompt}
        onDeleted={handleDeleted}
      />

      {/* Gradient Tester */}
      <GradientTester
        open={gradientTesterOpen}
        onClose={() => setGradientTesterOpen(false)}
        layers={gradientLayers}
        onUpdateLayer={updateGradientLayer}
        onResetLayers={resetGradientLayers}
        dragMode={gradientDragMode}
        onToggleDragMode={() => setGradientDragMode(prev => !prev)}
        onApply={handleApplyGradient}
      />

      {/* ── Mobile full-screen prompt detail panel (portal) ── */}
      {mobileDetailOpen && selectedPrompt && createPortal(
        <div
          className="fixed inset-0 z-[200] bg-background flex flex-col animate-in slide-in-from-right duration-250 ease-out md:hidden"
          data-testid="mobile-prompt-detail"
        >
          {/* Sticky back header */}
          <div
            className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-border/60 bg-background/95"
            style={{ paddingTop: "max(12px, env(safe-area-inset-top, 12px))" }}
          >
            <button
              onClick={() => setMobileDetailOpen(false)}
              className="flex items-center justify-center h-9 w-9 rounded-full bg-muted hover:bg-muted/80 text-foreground transition-colors"
              aria-label={t("actions.cancel")}
              data-testid="btn-mobile-prompt-back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <span className="text-[15px] font-semibold text-foreground truncate flex-1">
              {selectedPrompt.name || t("labels.untitled")}
            </span>
          </div>

          {/* Detail content */}
          <div className="flex-1 min-h-0 overflow-hidden relative">
            <div className="absolute inset-0 bg-[#F8F3EB]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.9)_0%,transparent_60%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,242,134,0.35)_0%,transparent_50%)]" />
            <div className="relative z-10 h-full overflow-y-auto">
              <PromptDetailPanel
                prompt={selectedPrompt}
                onEdit={() => {
                  setMobileDetailOpen(false);
                  openEdit(selectedPrompt);
                }}
                onDelete={() => {
                  setMobileDetailOpen(false);
                  openDelete(selectedPrompt);
                }}
                onToggleStatus={() => handleToggleStatus(selectedPrompt)}
                isToggling={togglingIds.has(selectedPromptId!)}
                gradientTesterOpen={false}
                onToggleGradientTester={() => {}}
                isAgencyView={isAgencyView}
                availableCampaigns={availableCampaignsForFilter}
                onCampaignChange={handleCampaignChange}
              />
            </div>
          </div>
        </div>,
        document.body,
      )}
    </CrmShell>
  );
}
