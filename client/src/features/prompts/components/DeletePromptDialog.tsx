import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";
import { apiFetch } from "@/lib/apiUtils";
import { useToast } from "@/hooks/use-toast";
import { hapticDelete } from "@/lib/haptics";
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
  const { t } = useTranslation("prompts");
  const { toast } = useToast();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!prompt) return;
    hapticDelete();
    setDeleting(true);
    try {
      const id = getPromptId(prompt);
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
            {t("deleteDialog.title")}
          </DialogTitle>
          <DialogDescription>
            {t("deleteDialog.message")}{" "}
            <span className="font-semibold text-foreground">"{prompt?.name}"</span>?{" "}
            {t("deleteDialog.cannotUndo")}
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
