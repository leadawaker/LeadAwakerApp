import { useMemo, useState, useEffect, useCallback } from "react";
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
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTopbarActions } from "@/contexts/TopbarActionsContext";
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
}

const EMPTY_FORM: PromptFormData = {
  name: "",
  promptText: "",
  systemMessage: "",
  model: "gpt-4o",
  temperature: "0.7",
  maxTokens: "1000",
  status: "active",
  useCase: "",
  notes: "",
};

const MODEL_OPTIONS = [
  "gpt-4o",
  "gpt-4o-mini",
  "gpt-4-turbo",
  "gpt-3.5-turbo",
  "claude-3-5-sonnet-20241022",
  "claude-3-haiku-20240307",
];

interface PromptFormDialogProps {
  open: boolean;
  onClose: () => void;
  prompt: any | null; // null means create mode
  onSaved: (prompt: any) => void;
}

function PromptFormDialog({ open, onClose, prompt, onSaved }: PromptFormDialogProps) {
  const { toast } = useToast();
  const isEdit = prompt !== null;

  const [form, setForm] = useState<PromptFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<PromptFormData>>({});

  // Pre-populate fields when editing
  useEffect(() => {
    if (open) {
      if (isEdit && prompt) {
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
    if (!form.name.trim()) newErrors.name = "Name is required";
    if (!form.promptText.trim()) newErrors.promptText = "Prompt text is required";
    const temp = parseFloat(form.temperature);
    if (isNaN(temp) || temp < 0 || temp > 2) newErrors.temperature = "Must be 0\u20132";
    const tokens = parseInt(form.maxTokens, 10);
    if (isNaN(tokens) || tokens < 1) newErrors.maxTokens = "Must be a positive integer";
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
        title: isEdit ? "Prompt updated" : "Prompt created",
        description: isEdit
          ? `"${form.name}" was updated successfully.`
          : `"${form.name}" was created successfully.`,
      });
      onClose();
    } catch (err: any) {
      toast({
        title: isEdit ? "Failed to update prompt" : "Failed to create prompt",
        description: err.message || "Unknown error",
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
          <DialogTitle>{isEdit ? "Edit Prompt" : "Create Prompt"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Edit the prompt details below and save your changes."
              : "Fill in the fields below to create a new prompt."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Name */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground" htmlFor="prompt-name">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              id="prompt-name"
              className={`w-full h-10 rounded-lg border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30 ${errors.name ? "border-red-400" : "border-border"}`}
              placeholder="e.g. Lead Reactivation v1"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              data-testid="input-prompt-name"
            />
            {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
          </div>

          {/* Use Case */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground" htmlFor="prompt-use-case">
              Use Case
            </label>
            <input
              id="prompt-use-case"
              className="w-full h-10 rounded-lg border border-border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="e.g. WhatsApp lead reactivation"
              value={form.useCase}
              onChange={(e) => setField("useCase", e.target.value)}
              data-testid="input-prompt-use-case"
            />
          </div>

          {/* Prompt Text */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground" htmlFor="prompt-text">
              Prompt Text <span className="text-red-500">*</span>
            </label>
            <textarea
              id="prompt-text"
              className={`w-full min-h-[120px] rounded-lg border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-y ${errors.promptText ? "border-red-400" : "border-border"}`}
              placeholder="Enter the main prompt text\u2026"
              value={form.promptText}
              onChange={(e) => setField("promptText", e.target.value)}
              data-testid="textarea-prompt-text"
            />
            {errors.promptText && <p className="text-xs text-red-500">{errors.promptText}</p>}
          </div>

          {/* System Message */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground" htmlFor="prompt-system-message">
              System Message
            </label>
            <textarea
              id="prompt-system-message"
              className="w-full min-h-[80px] rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-y"
              placeholder="System instructions for the AI model (optional)\u2026"
              value={form.systemMessage}
              onChange={(e) => setField("systemMessage", e.target.value)}
              data-testid="textarea-system-message"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground" htmlFor="prompt-notes">
              Notes
            </label>
            <textarea
              id="prompt-notes"
              className="w-full min-h-[80px] rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-y"
              placeholder="Additional notes or context about this prompt (optional)\u2026"
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
                Model
              </label>
              <Select value={form.model} onValueChange={(v) => setField("model", v)}>
                <SelectTrigger
                  className="w-full h-10 rounded-lg bg-card"
                  data-testid="select-prompt-model"
                >
                  <SelectValue placeholder="Select model" />
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
                Status
              </label>
              <Select value={form.status} onValueChange={(v) => setField("status", v)}>
                <SelectTrigger
                  className="w-full h-10 rounded-lg bg-card"
                  data-testid="select-prompt-status"
                >
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row: Temperature + Max Tokens */}
          <div className="grid grid-cols-2 gap-4">
            {/* Temperature */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground" htmlFor="prompt-temperature">
                Temperature <span className="text-muted-foreground text-xs">(0\u20132)</span>
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
                Max Tokens
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
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving}
            data-testid="button-save-prompt"
          >
            {saving ? (isEdit ? "Saving\u2026" : "Creating\u2026") : (isEdit ? "Save Changes" : "Create Prompt")}
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
        title: "Prompt deleted",
        description: `"${prompt.name}" was deleted successfully.`,
      });
      onClose();
    } catch (err: any) {
      toast({
        title: "Failed to delete prompt",
        description: err.message || "Unknown error",
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
            Delete Prompt
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete{" "}
            <span className="font-semibold text-foreground">"{prompt?.name}"</span>?
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={deleting}
            data-testid="button-cancel-delete-prompt"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting}
            data-testid="button-confirm-delete-prompt"
          >
            {deleting ? "Deleting\u2026" : "Delete Prompt"}
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
  modelFilter,
  onModelFilterChange,
  availableModels,
}: {
  statusFilter: string;
  onStatusFilterChange: (v: string) => void;
  modelFilter: string;
  onModelFilterChange: (v: string) => void;
  availableModels: string[];
}) {
  const [open, setOpen] = useState(false);
  const isActive = statusFilter !== "all" || modelFilter !== "all";
  const filterCount = (statusFilter !== "all" ? 1 : 0) + (modelFilter !== "all" ? 1 : 0);

  return (
    <div className="relative">
      <IconBtn
        onClick={() => setOpen((o) => !o)}
        active={isActive}
        title="Filter settings"
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
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Status</span>
                <Select value={statusFilter} onValueChange={onStatusFilterChange}>
                  <SelectTrigger className="w-full h-8 rounded-lg bg-card text-[12px]">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Model</span>
                <Select value={modelFilter} onValueChange={onModelFilterChange}>
                  <SelectTrigger className="w-full h-8 rounded-lg bg-card text-[12px]">
                    <SelectValue placeholder="All Models" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Models</SelectItem>
                    {availableModels.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {isActive && (
                <button
                  onClick={() => {
                    onStatusFilterChange("all");
                    onModelFilterChange("all");
                  }}
                  className="w-full text-center text-[11px] text-primary font-medium hover:underline"
                >
                  Clear all filters
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
          {prompt.name || "Untitled"}
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

      {/* Row 3: score */}
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
}: {
  prompt: any;
  onEdit: () => void;
  onDelete: () => void;
  onToggleStatus: () => void;
  isToggling: boolean;
}) {
  const statusNorm = ((prompt.status || "") as string).toLowerCase().trim();
  const promptText = prompt.promptText || prompt.prompt_text || "";
  const systemMessage = prompt.systemMessage || prompt.system_message || "";
  const useCase = prompt.useCase || prompt.use_case || "";

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-4 py-2.5 border-b border-border/60 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Prompt Detail
        </span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-foreground/5 hover:bg-foreground/10 text-foreground border border-border/50 text-xs font-semibold transition-colors"
            data-testid="button-edit-selected-prompt"
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit
          </button>
          <button
            onClick={onDelete}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-foreground/5 hover:bg-red-50 text-foreground hover:text-red-600 border border-border/50 text-xs font-semibold transition-colors"
            data-testid="button-delete-selected-prompt"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {/* Name + status */}
        <div>
          <h2 className="text-lg font-bold text-foreground leading-tight">
            {prompt.name || "Untitled"}
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
              title={`Click to ${statusNorm === "active" ? "archive" : "activate"}`}
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
          {prompt.model && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground flex items-center gap-1">
                <Bot className="h-3 w-3" /> Model
              </span>
              <span className="font-mono font-medium">{prompt.model}</span>
            </div>
          )}
          {prompt.temperature != null && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground flex items-center gap-1">
                <Thermometer className="h-3 w-3" /> Temperature
              </span>
              <span className="font-mono font-medium">{prompt.temperature}</span>
            </div>
          )}
          {prompt.maxTokens != null && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground flex items-center gap-1">
                <Hash className="h-3 w-3" /> Max Tokens
              </span>
              <span className="font-mono font-medium">{prompt.maxTokens}</span>
            </div>
          )}
          {useCase && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground flex items-center gap-1">
                <FileText className="h-3 w-3" /> Use Case
              </span>
              <span className="font-medium truncate max-w-[200px]">{useCase}</span>
            </div>
          )}
          {(prompt.createdAt || prompt.created_at) && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" /> Created
              </span>
              <span className="font-mono text-[11px]">
                {new Date(prompt.createdAt || prompt.created_at).toLocaleDateString()}
              </span>
            </div>
          )}
          {(prompt.updatedAt || prompt.updated_at) && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" /> Updated
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
              Prompt Text
            </div>
            <p className="text-[12px] text-foreground/80 leading-relaxed whitespace-pre-wrap">{promptText}</p>
          </div>
        )}

        {/* System Message */}
        {systemMessage && (
          <div className="rounded-lg border border-border/40 bg-muted/20 px-2.5 py-2">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
              System Message
            </div>
            <p className="text-[12px] text-foreground/80 leading-relaxed whitespace-pre-wrap">{systemMessage}</p>
          </div>
        )}

        {/* Notes */}
        {prompt.notes && (
          <div className="rounded-lg border border-border/40 bg-muted/20 px-2.5 py-2">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
              Notes
            </div>
            <p className="text-[12px] text-foreground/80 leading-relaxed whitespace-pre-wrap">{prompt.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function PromptDetailEmpty() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
      <div className="w-14 h-14 rounded-2xl bg-muted/60 flex items-center justify-center">
        <BookOpen className="w-7 h-7 text-muted-foreground/40" />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground/70">Select a prompt</p>
        <p className="text-xs text-muted-foreground mt-1">Click any prompt on the left to view its details</p>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────

export default function PromptLibraryPage() {
  const { isAgencyView } = useWorkspace();
  const { toast } = useToast();
  const { clearTopbarActions } = useTopbarActions();

  const [q, setQ] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [modelFilter, setModelFilter] = useState<string>("all");
  const [promptLibraryData, setPromptLibraryData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [selectedPromptId, setSelectedPromptId] = useState<number | null>(null);

  // Create/Edit dialog
  const [formOpen, setFormOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<any | null>(null);

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingPrompt, setDeletingPrompt] = useState<any | null>(null);

  // Status toggle loading state (keyed by prompt id)
  const [togglingIds, setTogglingIds] = useState<Set<number>>(new Set());

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

  // Derive unique models from loaded prompts for the model filter dropdown
  const availableModels = useMemo(() => {
    const modelSet = new Set<string>();
    promptLibraryData.forEach((p: any) => {
      const m = p.model || "";
      if (m) modelSet.add(m);
    });
    return Array.from(modelSet).sort();
  }, [promptLibraryData]);

  const rows = useMemo(() => {
    return promptLibraryData.filter((p: any) => {
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
  }, [promptLibraryData, q, statusFilter, modelFilter]);

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
        title: "Status updated",
        description: `"${prompt.name}" is now ${newStatus}.`,
      });
    } catch (err: any) {
      // Revert optimistic update on error
      setPromptLibraryData((prev) =>
        prev.map((p) => (p.id || p.Id) === id ? { ...p, status: currentStatus } : p)
      );
      toast({
        title: "Failed to update status",
        description: err.message || "Unknown error",
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
        <div className="flex-1 min-h-0 flex gap-0 overflow-hidden">

          {/* ── LEFT PANEL ── list of prompts ────────────────────────── */}
          <div className="w-[340px] shrink-0 flex flex-col bg-muted rounded-lg overflow-hidden">

            {/* Title row — per section 16 */}
            <div className="px-3.5 pt-5 pb-1 flex items-center justify-between shrink-0">
              <h2 className="text-2xl font-semibold font-heading text-foreground leading-tight">
                Library
              </h2>
              <span className="text-[12px] font-medium text-muted-foreground tabular-nums">
                {rows.length}
              </span>
            </div>

            {/* Controls row */}
            <div className="px-3 pt-1.5 pb-3 shrink-0 flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none]">
              <div className="flex-1" />
              <IconBtn onClick={openCreate} title="Create prompt">
                <Plus className="h-4 w-4" />
              </IconBtn>
              <SearchPill
                value={q}
                onChange={setQ}
                open={searchOpen}
                onOpenChange={setSearchOpen}
                placeholder="Search prompts\u2026"
              />
              <SettingsDropdown
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
                modelFilter={modelFilter}
                onModelFilterChange={setModelFilter}
                availableModels={availableModels}
              />
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
                    {q || statusFilter !== "all" || modelFilter !== "all"
                      ? "No prompts match your filters"
                      : "No prompts yet"}
                  </p>
                  {!q && statusFilter === "all" && modelFilter === "all" && (
                    <button
                      onClick={openCreate}
                      className="mt-2 text-[12px] text-primary font-medium hover:underline"
                    >
                      Create your first prompt
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
                      onClick={() => setSelectedPromptId(pid)}
                    />
                  );
                })
              )}
            </div>
          </div>

          {/* ── RIGHT PANEL ── prompt details ────────────────────────── */}
          <div className="flex-1 min-w-0 flex flex-col rounded-lg ml-1.5 overflow-hidden relative">
            {/* ── Warm gradient bloom background (matching Invoices/Expenses) ── */}
            <div className="absolute inset-0 bg-[#F8F3EB]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.9)_0%,transparent_60%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,242,134,0.35)_0%,transparent_50%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(241,218,162,0.2)_0%,transparent_70%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(210,188,130,0.15)_0%,transparent_50%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(105,170,255,0.18)_0%,transparent_55%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_center,rgba(165,205,255,0.12)_0%,transparent_60%)]" />
            <div className="relative z-10 flex flex-col flex-1 min-h-0">
              {selectedPrompt ? (
                <PromptDetailPanel
                  prompt={selectedPrompt}
                  onEdit={() => openEdit(selectedPrompt)}
                  onDelete={() => openDelete(selectedPrompt)}
                  onToggleStatus={() => handleToggleStatus(selectedPrompt)}
                  isToggling={togglingIds.has(selectedPromptId!)}
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
    </CrmShell>
  );
}
