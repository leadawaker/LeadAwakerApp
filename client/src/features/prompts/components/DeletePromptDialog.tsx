import { useState } from "react";
import { AlertTriangle } from "lucide-react";
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
import { getPromptId } from "../types";

interface DeletePromptDialogProps {
  open: boolean;
  onClose: () => void;
  prompt: any | null;
  onDeleted: (id: number) => void;
}

export function DeletePromptDialog({ open, onClose, prompt, onDeleted }: DeletePromptDialogProps) {
  const { toast } = useToast();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!prompt) return;
    setDeleting(true);
    try {
      const id = getPromptId(prompt);
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
      <DialogContent className="sm:max-w-sm" data-testid="dialog-delete-prompt">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertTriangle className="h-4 w-4" />
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
