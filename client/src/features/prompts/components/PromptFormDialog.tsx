import { useState, useEffect } from "react";
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
import { MODEL_OPTIONS, EMPTY_FORM, type PromptFormData, getPromptId } from "../types";

interface PromptFormDialogProps {
  open: boolean;
  onClose: () => void;
  prompt: any | null;
  onSaved: (prompt: any) => void;
  campaigns?: { id: number; name: string }[];
}

export function PromptFormDialog({ open, onClose, prompt, onSaved, campaigns = [] }: PromptFormDialogProps) {
  const { toast } = useToast();
  const isEdit = prompt !== null;

  const [form, setForm] = useState<PromptFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<PromptFormData>>({});

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
          campaignsId: prompt.campaignsId != null ? String(prompt.campaignsId) : (prompt.Campaigns_id != null ? String(prompt.Campaigns_id) : ""),
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
        notes: form.notes.trim() || null,
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

  // INPUT STYLING — stone-gray system:
  // Use: border-border/30 bg-card/60 rounded-xl focus:ring-2 focus:ring-brand-blue/30
  // Error state: border-red-400
  const inputBase = "w-full h-10 rounded-xl border bg-card/60 px-3 text-sm outline-none focus:ring-2 focus:ring-brand-blue/30";
  const textareaBase = "w-full rounded-xl border bg-card/60 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-blue/30 resize-y";
  const selectBase = "w-full h-10 rounded-xl border bg-card/60 px-3 text-sm outline-none focus:ring-2 focus:ring-brand-blue/30";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !saving) onClose(); }}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        data-testid={isEdit ? "dialog-edit-prompt" : "dialog-create-prompt"}
      >
        <DialogHeader>
          <DialogTitle className="font-heading">{isEdit ? "Edit Prompt" : "Create Prompt"}</DialogTitle>
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
              className={`${inputBase} ${errors.name ? "border-red-400" : "border-border/30"}`}
              placeholder="e.g. Lead Reactivation v1"
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
                Use Case
              </label>
              <input
                id="prompt-use-case"
                className={`${inputBase} border-border/30`}
                placeholder="e.g. WhatsApp lead reactivation"
                value={form.useCase}
                onChange={(e) => setField("useCase", e.target.value)}
                data-testid="input-prompt-use-case"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground" htmlFor="prompt-campaign">
                Campaign
              </label>
              <select
                id="prompt-campaign"
                className={`${selectBase} border-border/30`}
                value={form.campaignsId}
                onChange={(e) => setField("campaignsId", e.target.value)}
                data-testid="select-prompt-campaign"
              >
                <option value="">— None —</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={String(c.id)}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Prompt Text */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground" htmlFor="prompt-text">
              Prompt Text <span className="text-red-500">*</span>
            </label>
            <textarea
              id="prompt-text"
              className={`${textareaBase} min-h-[120px] ${errors.promptText ? "border-red-400" : "border-border/30"}`}
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
              className={`${textareaBase} min-h-[80px] border-border/30`}
              placeholder="System instructions for the AI model (optional)…"
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
              className={`${textareaBase} min-h-[80px] border-border/30`}
              placeholder="Additional notes or context about this prompt (optional)…"
              value={form.notes}
              onChange={(e) => setField("notes", e.target.value)}
              data-testid="textarea-prompt-notes"
            />
          </div>

          {/* Row: Model + Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground" htmlFor="prompt-model">
                Model
              </label>
              <select
                id="prompt-model"
                className={`${selectBase} border-border/30`}
                value={form.model}
                onChange={(e) => setField("model", e.target.value)}
                data-testid="select-prompt-model"
              >
                {MODEL_OPTIONS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground" htmlFor="prompt-status">
                Status
              </label>
              <select
                id="prompt-status"
                className={`${selectBase} border-border/30`}
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
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground" htmlFor="prompt-temperature">
                Temperature <span className="text-muted-foreground text-xs">(0-2)</span>
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
                Max Tokens
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
