import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff } from "lucide-react";
import "./PromptFormDialog.css";
import { apiFetch } from "@/lib/apiUtils";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { EMPTY_FORM, type PromptFormData, type PromptVersion, getPromptId } from "../types";
import { resolveVariables, type CampaignForPreview, type LeadForPreview } from "../utils/resolveVariables";

interface PromptFormDialogProps {
  open: boolean;
  onClose: () => void;
  prompt: any | null;
  onSaved: (prompt: any) => void;
  campaigns?: CampaignForPreview[];
}

function formatVersionDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" });
}

function formatVersionDateTime(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" }) +
    " " +
    d.toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" })
  );
}

export function PromptFormDialog({ open, onClose, prompt, onSaved, campaigns = [] }: PromptFormDialogProps) {
  const { toast } = useToast();
  const { t } = useTranslation("prompts");
  const isEdit = prompt !== null;

  const [form, setForm] = useState<PromptFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<PromptFormData>>({});
  const initialized = useRef(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Refs for uncontrolled textareas (preserves browser Ctrl+Z undo history)
  const promptTextRef = useRef<string>("");
  const systemMessageRef = useRef<string>("");
  const notesRef = useRef<string>("");
  const promptTextareaRef = useRef<HTMLTextAreaElement>(null);
  const systemMessageTextareaRef = useRef<HTMLTextAreaElement>(null);
  const notesTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Preview state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [sampleLead, setSampleLead] = useState<LeadForPreview | null>(null);
  const [previewTick, setPreviewTick] = useState(0);

  // Version history state
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [savingVersion, setSavingVersion] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState("");
  const [versionDropdownOpen, setVersionDropdownOpen] = useState(false);
  const versionDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      if (isEdit && prompt) {
        const promptTextVal = prompt.promptText || prompt.prompt_text || "";
        const systemMessageVal = prompt.systemMessage || prompt.system_message || "";
        const notesVal = prompt.notes || "";
        setForm({
          name: prompt.name || "",
          promptText: promptTextVal,
          systemMessage: systemMessageVal,
          model: prompt.model || "gpt-5.1",
          temperature: prompt.temperature != null ? String(prompt.temperature) : "0.7",
          maxTokens: prompt.maxTokens != null ? String(prompt.maxTokens) : "1000",
          status: prompt.status || "active",
          useCase: prompt.useCase || prompt.use_case || "",
          notes: notesVal,
          campaignsId: prompt.campaignsId != null ? String(prompt.campaignsId) : (prompt.Campaigns_id != null ? String(prompt.Campaigns_id) : ""),
        });
        promptTextRef.current = promptTextVal;
        systemMessageRef.current = systemMessageVal;
        notesRef.current = notesVal;

        // Fetch version history
        setVersions([]);
        setSelectedVersion("");
        setVersionsLoading(true);
        apiFetch(`/api/prompts/${getPromptId(prompt)}/versions`)
          .then((r) => r.json())
          .then((data) => setVersions(data))
          .catch(() => {})
          .finally(() => setVersionsLoading(false));
      } else {
        setForm(EMPTY_FORM);
        promptTextRef.current = "";
        systemMessageRef.current = "";
        notesRef.current = "";
        setVersions([]);
        setSelectedVersion("");
      }
      setErrors({});
      initialized.current = false;
      const timer = setTimeout(() => { initialized.current = true; }, 150);
      return () => clearTimeout(timer);
    }
  }, [open, prompt, isEdit]);

  // Close version dropdown on outside click
  useEffect(() => {
    if (!versionDropdownOpen) return;
    function handleOutside(e: MouseEvent) {
      if (versionDropdownRef.current && !versionDropdownRef.current.contains(e.target as Node)) {
        setVersionDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [versionDropdownOpen]);

  // Fetch a sample lead when preview opens and a campaign is selected
  useEffect(() => {
    if (!previewOpen || !form.campaignsId) {
      setSampleLead(null);
      return;
    }
    apiFetch(`/api/leads?campaignId=${form.campaignsId}&limit=1`)
      .then((r) => r.json())
      .then((data: any[]) => {
        const lead = Array.isArray(data) ? data[0] : null;
        setSampleLead(lead ? {
          firstName: lead.firstName ?? lead.first_name ?? null,
          lastName: lead.lastName ?? lead.last_name ?? null,
          phone: lead.phone ?? null,
          email: lead.email ?? null,
          whatHasTheLeadDone: lead.whatHasTheLeadDone ?? lead.what_has_the_lead_done ?? null,
        } : null);
      })
      .catch(() => setSampleLead(null));
  }, [previewOpen, form.campaignsId]);

  function scheduleAutoSave() {
    if (!isEdit || !initialized.current) return;
    clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      handleSubmit(true);
    }, 800);
  }

  // Auto-save on structured field changes (name, status, campaign, etc.)
  useEffect(() => {
    if (!isEdit || !initialized.current) return;
    scheduleAutoSave();
    return () => clearTimeout(autoSaveTimerRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  function setField(field: keyof PromptFormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function validate(): boolean {
    const newErrors: Partial<PromptFormData> = {};
    if (!form.name.trim()) newErrors.name = t("form.nameRequired");
    if (!promptTextRef.current.trim()) newErrors.promptText = t("form.promptTextRequired");
    const temp = parseFloat(form.temperature);
    if (isNaN(temp) || temp < 0 || temp > 2) newErrors.temperature = t("form.temperatureError");
    const tokens = parseInt(form.maxTokens, 10);
    if (isNaN(tokens) || tokens < 1) newErrors.maxTokens = t("form.maxTokensError");
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(silent = false) {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        promptText: promptTextRef.current.trim(),
        systemMessage: systemMessageRef.current.trim() || null,
        model: form.model || null,
        temperature: form.temperature,
        maxTokens: parseInt(form.maxTokens, 10),
        status: form.status || "active",
        useCase: form.useCase.trim() || null,
        notes: notesRef.current.trim() || null,
        campaignsId: form.campaignsId ? parseInt(form.campaignsId, 10) : null,
      };

      let res: Response;
      if (isEdit) {
        res = await apiFetch(`/api/prompts/${getPromptId(prompt)}`, {
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
      if (!silent) {
        toast({
          title: isEdit ? t("toast.updated") : t("toast.created"),
          description: isEdit
            ? t("toast.updatedDescription", { name: form.name })
            : t("toast.createdDescription", { name: form.name }),
        });
        onClose();
      }
    } catch (err: any) {
      toast({
        title: isEdit ? t("toast.updateFailed") : t("toast.createFailed"),
        description: err.message || "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function saveVersion(bumpType: "minor" | "major") {
    if (!isEdit || !prompt) return;
    setSavingVersion(true);
    try {
      const res = await apiFetch(`/api/prompts/${getPromptId(prompt)}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bumpType,
          promptText: promptTextRef.current.trim(),
          systemMessage: systemMessageRef.current.trim() || null,
          notes: notesRef.current.trim() || null,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      const newVersion: PromptVersion = await res.json();
      setVersions((prev) => [newVersion, ...prev]);
      toast({ title: t("versions.saved"), description: `v${newVersion.versionNumber}` });
    } catch {
      toast({ title: t("versions.saveFailed"), variant: "destructive" });
    } finally {
      setSavingVersion(false);
    }
  }

  function loadVersion(versionNumber: string) {
    if (!versionNumber) return;
    const v = versions.find((ver) => ver.versionNumber === versionNumber);
    if (!v) return;
    setSelectedVersion(versionNumber);
    promptTextRef.current = v.promptText || "";
    systemMessageRef.current = v.systemMessage || "";
    notesRef.current = v.notes || "";
    if (promptTextareaRef.current) promptTextareaRef.current.value = v.promptText || "";
    if (systemMessageTextareaRef.current) systemMessageTextareaRef.current.value = v.systemMessage || "";
    if (notesTextareaRef.current) notesTextareaRef.current.value = v.notes || "";
    toast({ title: t("versions.loaded"), description: `v${versionNumber}` });
  }

  // INPUT STYLING — stone-gray system:
  // Use: border-border/30 bg-card/60 rounded-xl focus:ring-2 focus:ring-brand-indigo/30
  // Error state: border-red-400
  const inputBase = "w-full h-10 rounded-xl border bg-card/60 px-3 text-sm outline-none focus:ring-2 focus:ring-brand-indigo/30";
  const textareaBase = "w-full rounded-xl border bg-card/60 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-indigo/30 resize-y";
  const selectBase = "w-full h-10 rounded-xl border bg-card/60 px-3 text-sm outline-none focus:ring-2 focus:ring-brand-indigo/30";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !saving) onClose(); }}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        data-testid={isEdit ? "dialog-edit-prompt" : "dialog-create-prompt"}
      >
        <DialogHeader>
          <DialogTitle className="font-heading">
            {isEdit ? t("form.editTitle") : t("form.createTitle")}
          </DialogTitle>
          <DialogDescription>
            {isEdit ? t("form.editDescription") : t("form.createDescription")}
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
              className={`${inputBase} ${errors.name ? "border-red-400" : "border-border/30"}`}
              placeholder={t("form.namePlaceholder")}
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              data-testid="input-prompt-name"
            />
            {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
          </div>

          {/* Use Case + Campaign row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground" htmlFor="prompt-use-case">
                {t("form.useCase")}
              </label>
              <input
                id="prompt-use-case"
                className={`${inputBase} border-border/30`}
                placeholder={t("form.useCasePlaceholder")}
                value={form.useCase}
                onChange={(e) => setField("useCase", e.target.value)}
                data-testid="input-prompt-use-case"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground" htmlFor="prompt-campaign">
                {t("labels.campaign")}
              </label>
              <select
                id="prompt-campaign"
                className={`${selectBase} border-border/30`}
                value={form.campaignsId}
                onChange={(e) => setField("campaignsId", e.target.value)}
                data-testid="select-prompt-campaign"
              >
                <option value="">{t("form.noneOption")}</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={String(c.id)}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Version toolbar — edit mode only */}
          {isEdit && (
            <div className="flex items-center gap-2 py-1.5 border-y border-border/20">
              {/* Custom version dropdown */}
              <div ref={versionDropdownRef} className="relative">
                <button
                  type="button"
                  className="h-8 min-w-[200px] rounded-lg border border-border/30 bg-card/60 px-2 text-xs outline-none focus:ring-1 focus:ring-brand-indigo/30 flex items-center justify-between gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={versionsLoading || versions.length === 0}
                  onClick={() => setVersionDropdownOpen((o) => !o)}
                >
                  <span className="truncate">
                    {versionsLoading
                      ? t("versions.loading")
                      : versions.length === 0
                      ? t("versions.noVersions")
                      : selectedVersion
                      ? (() => {
                          const v = versions.find((v) => v.versionNumber === selectedVersion);
                          return v ? `v${v.versionNumber} — ${formatVersionDateTime(v.savedAt)}` : t("versions.selectVersion");
                        })()
                      : t("versions.selectVersion")}
                  </span>
                  <svg className="w-3 h-3 shrink-0 opacity-50" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M2 4l4 4 4-4" />
                  </svg>
                </button>
                {versionDropdownOpen && versions.length > 0 && (
                  <div className="absolute left-0 top-full mt-1 z-50 min-w-[240px] max-w-[340px] rounded-xl border border-border/30 bg-card shadow-lg overflow-hidden">
                    {versions.map((v) => (
                      <div
                        key={v.id}
                        className={`group px-3 py-2 cursor-pointer transition-colors ${
                          selectedVersion === v.versionNumber
                            ? "bg-brand-indigo/10 text-brand-indigo"
                            : "hover:bg-muted/50"
                        }`}
                        onClick={() => {
                          loadVersion(v.versionNumber);
                          setVersionDropdownOpen(false);
                        }}
                      >
                        <div className="text-xs font-medium">
                          v{v.versionNumber} — {formatVersionDateTime(v.savedAt)}
                        </div>
                        {v.notes && (
                          <div className="mt-1 text-[11px] text-muted-foreground leading-snug whitespace-pre-wrap hidden group-hover:block">
                            {v.notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex-1" />
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs px-3"
                onClick={() => saveVersion("minor")}
                disabled={savingVersion}
              >
                {savingVersion ? t("versions.saving") : t("versions.saveVersion")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs px-3"
                onClick={() => saveVersion("major")}
                disabled={savingVersion}
                title={t("versions.majorVersionHint")}
              >
                {t("versions.majorVersion")}
              </Button>
            </div>
          )}

          {/* Prompt Text */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground" htmlFor="prompt-text">
                {t("form.promptText")} <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => setPreviewOpen((p) => !p)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {previewOpen ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {previewOpen ? "Hide preview" : "Preview"}
              </button>
            </div>
            <textarea
              ref={promptTextareaRef}
              id="prompt-text"
              className={`${textareaBase} min-h-[120px] ${errors.promptText ? "border-red-400" : "border-border/30"}`}
              placeholder={t("form.promptTextPlaceholder")}
              defaultValue={form.promptText}
              onChange={(e) => {
                promptTextRef.current = e.target.value;
                setErrors((prev) => ({ ...prev, promptText: undefined }));
                scheduleAutoSave();
              }}
              onInput={() => { if (previewOpen) setPreviewTick((t) => t + 1); }}
              data-testid="textarea-prompt-text"
            />
            {errors.promptText && <p className="text-xs text-red-500">{errors.promptText}</p>}
            {previewOpen && (() => {
              const selectedCampaign = campaigns.find((c) => String(c.id) === form.campaignsId) ?? null;
              void previewTick; // trigger re-render on typing
              const text = promptTextRef.current ?? "";
              const { resolved, missing } = resolveVariables(text, selectedCampaign, sampleLead);

              // Split text by variables and render with proper React elements
              const renderHighlighted = () => {
                const parts = resolved.split(/(\{\w+\})/);
                return (
                  <>
                    {parts.filter(p => p).map((part, idx) => {
                      if (/^\{\w+\}$/.test(part)) {
                        return <mark key={idx} className="prompt-variable">{part}</mark>;
                      }
                      return <>{part}</>;
                    })}
                  </>
                );
              };

              const leadLabel = sampleLead?.firstName
                ? `${sampleLead.firstName}${sampleLead.lastName ? " " + sampleLead.lastName : ""}`
                : form.campaignsId
                ? "no leads in campaign"
                : "no campaign selected";
              return (
                <div className="mt-1.5 rounded-xl border border-border/30 bg-muted/30 p-3 text-sm">
                  <div className="flex items-center justify-between mb-2 text-xs text-muted-foreground">
                    <span>Preview · <span className="italic">{leadLabel}</span></span>
                    {missing.length > 0 && (
                      <span className="text-amber-600 dark:text-amber-400">
                        {missing.length} unresolved variable{missing.length > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  {text.trim() ? (
                    <div className="whitespace-pre-wrap leading-relaxed text-foreground">
                      {renderHighlighted()}
                    </div>
                  ) : (
                    <p className="text-muted-foreground italic">Nothing to preview yet.</p>
                  )}
                </div>
              );
            })()}
          </div>

          {/* System Message */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground" htmlFor="prompt-system-message">
              {t("form.systemMessage")}
            </label>
            <textarea
              ref={systemMessageTextareaRef}
              id="prompt-system-message"
              className={`${textareaBase} min-h-[80px] border-border/30`}
              placeholder={t("form.systemMessagePlaceholder")}
              defaultValue={form.systemMessage}
              onChange={(e) => {
                systemMessageRef.current = e.target.value;
                scheduleAutoSave();
              }}
              data-testid="textarea-system-message"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground" htmlFor="prompt-notes">
              {t("form.notes")}
            </label>
            <textarea
              ref={notesTextareaRef}
              id="prompt-notes"
              className={`${textareaBase} min-h-[80px] border-border/30`}
              placeholder={t("form.notesPlaceholder")}
              defaultValue={form.notes}
              onChange={(e) => {
                notesRef.current = e.target.value;
                scheduleAutoSave();
              }}
              data-testid="textarea-prompt-notes"
            />
          </div>

          {/* Row: Model + Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground" htmlFor="prompt-model">
                {t("labels.model")}
              </label>
              <div
                id="prompt-model"
                className={`${selectBase} border-border/30 opacity-60 cursor-default`}
                data-testid="select-prompt-model"
              >
                {(() => {
                  const c = campaigns?.find((c) => String(c.id) === form.campaignsId);
                  return c?.aiModel || t("form.noCampaignModel");
                })()}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground" htmlFor="prompt-status">
                {t("labels.status")}
              </label>
              <select
                id="prompt-status"
                className={`${selectBase} border-border/30`}
                value={form.status}
                onChange={(e) => setField("status", e.target.value)}
                data-testid="select-prompt-status"
              >
                <option value="active">{t("status.active")}</option>
                <option value="archived">{t("status.archived")}</option>
              </select>
            </div>
          </div>

          {/* Row: Temperature + Max Tokens */}
          <div className="grid grid-cols-2 gap-4">
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
                className={`${inputBase} ${errors.temperature ? "border-red-400" : "border-border/30"}`}
                value={form.temperature}
                onChange={(e) => setField("temperature", e.target.value)}
                data-testid="input-prompt-temperature"
              />
              {errors.temperature && <p className="text-xs text-red-500">{errors.temperature}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground" htmlFor="prompt-max-tokens">
                {t("form.maxTokens")}
              </label>
              <input
                id="prompt-max-tokens"
                type="number"
                min="1"
                className={`${inputBase} ${errors.maxTokens ? "border-red-400" : "border-border/30"}`}
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
            onClick={() => handleSubmit()}
            disabled={saving}
            data-testid="button-save-prompt"
          >
            {saving
              ? (isEdit ? t("actions.saving") : t("actions.creating"))
              : (isEdit ? t("actions.saveChanges") : t("actions.createPrompt"))}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
