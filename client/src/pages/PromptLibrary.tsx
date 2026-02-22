import { useMemo, useState, useEffect, useCallback } from "react";
import { CrmShell } from "@/components/crm/CrmShell";
import { useWorkspace } from "@/hooks/useWorkspace";
import { apiFetch } from "@/lib/apiUtils";
import { ApiErrorFallback } from "@/components/crm/ApiErrorFallback";
import { SkeletonCardGrid } from "@/components/ui/skeleton";
import { DataEmptyState } from "@/components/crm/DataEmptyState";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, AlertTriangle, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

/** Returns Tailwind classes for the status badge based on status value */
function getStatusBadgeClasses(status: string | null | undefined): string {
  const normalized = (status || "").toLowerCase().trim();
  if (normalized === "active") {
    return "bg-green-100 text-green-700 border border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800/50";
  }
  if (normalized === "archived") {
    return "bg-gray-100 text-gray-500 border border-gray-200 dark:bg-gray-800/50 dark:text-gray-400 dark:border-gray-700/50";
  }
  // Unknown / null status — show as gray
  return "bg-gray-100 text-gray-400 border border-gray-200 dark:bg-gray-800/30 dark:text-gray-500 dark:border-gray-700/30";
}

function getStatusLabel(status: string | null | undefined): string {
  const normalized = (status || "").trim();
  return normalized || "Unknown";
}

/** Returns color classes for the performance score badge based on numeric value */
function getScoreColorClasses(score: string | null | undefined): string {
  const num = parseFloat(score || "");
  if (isNaN(num)) return "text-muted-foreground";
  if (num >= 8) return "text-emerald-600 dark:text-emerald-400";
  if (num >= 6) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
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
    if (isNaN(temp) || temp < 0 || temp > 2) newErrors.temperature = "Must be 0–2";
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
              className={`w-full h-10 rounded-lg border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 ${errors.name ? "border-red-400" : "border-border"}`}
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
              className="w-full h-10 rounded-lg border border-border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
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
              className={`w-full min-h-[120px] rounded-lg border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 resize-y ${errors.promptText ? "border-red-400" : "border-border"}`}
              placeholder="Enter the main prompt text…"
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
              className="w-full min-h-[80px] rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 resize-y"
              placeholder="System instructions for the AI model (optional)…"
              value={form.systemMessage}
              onChange={(e) => setField("systemMessage", e.target.value)}
              data-testid="textarea-system-message"
            />
          </div>

          {/* Row: Model + Status */}
          <div className="grid grid-cols-2 gap-4">
            {/* Model */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground" htmlFor="prompt-model">
                Model
              </label>
              <select
                id="prompt-model"
                className="w-full h-10 rounded-lg border border-border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                value={form.model}
                onChange={(e) => setField("model", e.target.value)}
                data-testid="select-prompt-model"
              >
                {MODEL_OPTIONS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground" htmlFor="prompt-status">
                Status
              </label>
              <select
                id="prompt-status"
                className="w-full h-10 rounded-lg border border-border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                value={form.status}
                onChange={(e) => setField("status", e.target.value)}
                data-testid="select-prompt-status"
              >
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          {/* Row: Temperature + Max Tokens */}
          <div className="grid grid-cols-2 gap-4">
            {/* Temperature */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground" htmlFor="prompt-temperature">
                Temperature <span className="text-muted-foreground text-xs">(0–2)</span>
              </label>
              <input
                id="prompt-temperature"
                type="number"
                step="0.1"
                min="0"
                max="2"
                className={`w-full h-10 rounded-lg border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 ${errors.temperature ? "border-red-400" : "border-border"}`}
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
                className={`w-full h-10 rounded-lg border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 ${errors.maxTokens ? "border-red-400" : "border-border"}`}
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
            {saving ? (isEdit ? "Saving…" : "Creating…") : (isEdit ? "Save Changes" : "Create Prompt")}
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
          <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
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
            {deleting ? "Deleting…" : "Delete Prompt"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────

export default function PromptLibraryPage() {
  const { isAgencyView } = useWorkspace();
  const [q, setQ] = useState("");
  const [promptLibraryData, setPromptLibraryData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Create/Edit dialog
  const [formOpen, setFormOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<any | null>(null);

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingPrompt, setDeletingPrompt] = useState<any | null>(null);

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

  const rows = useMemo(() => {
    return promptLibraryData
      .filter((p: any) => (q ? (p.name || "").toLowerCase().includes(q.toLowerCase()) : true));
  }, [promptLibraryData, q]);

  function openCreate() {
    setEditingPrompt(null);
    setFormOpen(true);
  }

  function openEdit(prompt: any, e: React.MouseEvent) {
    e.stopPropagation();
    setEditingPrompt(prompt);
    setFormOpen(true);
  }

  function openDelete(prompt: any, e: React.MouseEvent) {
    e.stopPropagation();
    setDeletingPrompt(prompt);
    setDeleteOpen(true);
  }

  function handleSaved(saved: any) {
    setPromptLibraryData((prev) => {
      const id = saved.id || saved.Id;
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
  }

  function handleDeleted(id: number) {
    setPromptLibraryData((prev) => prev.filter((p) => (p.id || p.Id) !== id));
  }

  return (
    <CrmShell>
      <div className="py-4 h-full flex flex-col" data-testid="page-prompt-library">
        {/* Toolbar */}
        <div className="flex items-center gap-2 mb-6" data-testid="bar-prompts">
          <input
            className="h-10 w-[320px] max-w-full rounded-xl border border-border bg-card px-4 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            placeholder="Search prompts…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            data-testid="input-prompt-search"
          />
          <div className="ml-auto">
            <Button
              size="sm"
              onClick={openCreate}
              data-testid="button-create-prompt"
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Create Prompt
            </Button>
          </div>
        </div>

        {error && promptLibraryData.length === 0 && !loading ? (
          <ApiErrorFallback
            error={error}
            onRetry={fetchPrompts}
            isRetrying={loading}
          />
        ) : loading ? (
          <SkeletonCardGrid count={6} columns="grid-cols-1 md:grid-cols-2 xl:grid-cols-3" className="flex-1" />
        ) : (
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-2 content-start" data-testid="grid-prompts">
            {rows.length === 0 && (
              <div className="col-span-full">
                <DataEmptyState variant={q ? "search" : "prompts"} />
              </div>
            )}
            {rows.map((p: any) => {
              const promptId = p.id || p.Id;
              return (
                <div
                  key={promptId}
                  className="group rounded-2xl border border-border bg-card p-4 h-fit shadow-sm hover:shadow-md transition-shadow"
                  data-testid={`card-prompt-${promptId}`}
                >
                  {/* Header row: name + status badge + action buttons */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold text-foreground leading-snug" data-testid={`text-prompt-name-${promptId}`}>
                      {p.name || <span className="text-muted-foreground italic">Untitled</span>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Edit button */}
                      <button
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted"
                        onClick={(e) => openEdit(p, e)}
                        title="Edit prompt"
                        data-testid={`button-edit-prompt-${promptId}`}
                      >
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                      </button>
                      {/* Delete button */}
                      <button
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                        onClick={(e) => openDelete(p, e)}
                        title="Delete prompt"
                        data-testid={`button-delete-prompt-${promptId}`}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-red-500" />
                      </button>
                      {/* Status badge */}
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${getStatusBadgeClasses(p.status)}`}
                        data-testid={`badge-prompt-status-${promptId}`}
                      >
                        {getStatusLabel(p.status)}
                      </span>
                    </div>
                  </div>

                  {/* Use case */}
                  <div className="mt-1 text-xs text-muted-foreground" data-testid={`text-prompt-usecase-${promptId}`}>
                    {p.useCase || p.use_case || ""}
                  </div>

                  {/* Version + model + score row */}
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      {/* Version number */}
                      {p.version && (
                        <span
                          className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-mono font-medium text-foreground"
                          data-testid={`text-prompt-version-${promptId}`}
                        >
                          v{p.version}
                        </span>
                      )}
                      {/* Model */}
                      {p.model && (
                        <span className="font-medium" data-testid={`text-prompt-model-${promptId}`}>
                          {p.model}
                        </span>
                      )}
                    </div>
                    {/* Performance score */}
                    {p.performanceScore != null ? (
                      <span
                        className={`inline-flex items-center gap-1 font-medium ${getScoreColorClasses(p.performanceScore)}`}
                        title="Performance score"
                        data-testid={`text-prompt-score-${promptId}`}
                      >
                        <Star className="h-3 w-3 fill-current" />
                        {p.performanceScore}
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 text-muted-foreground/50"
                        title="No performance score yet"
                        data-testid={`text-prompt-score-empty-${promptId}`}
                      >
                        <Star className="h-3 w-3" />
                        <span className="text-[10px]">—</span>
                      </span>
                    )}
                  </div>

                  {/* Prompt text preview */}
                  {(p.promptText || p.prompt_text) && (
                    <div className="mt-2 text-xs text-muted-foreground line-clamp-2 border-t border-border/50 pt-2" data-testid={`text-prompt-preview-${promptId}`}>
                      {p.promptText || p.prompt_text}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
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


