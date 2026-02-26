/* ════════════════════════════════════════════════════════════════════════════
   DeleteTagDialog — confirmation dialog for deleting one or many tags
   ════════════════════════════════════════════════════════════════════════════ */

import { useState, useCallback } from "react";
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/* ── Props ──────────────────────────────────────────────────────────────── */

interface DeleteTagDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deletingTag: any | null;
  deletingBulk: boolean;
  selectedCount: number;
  onConfirm: () => Promise<void>;
}

/* ════════════════════════════════════════════════════════════════════════════
   Component
   ════════════════════════════════════════════════════════════════════════════ */

export function DeleteTagDialog({
  open,
  onOpenChange,
  deletingTag,
  deletingBulk,
  selectedCount,
  onConfirm,
}: DeleteTagDialogProps) {
  const [deleting, setDeleting] = useState(false);

  const handleConfirm = useCallback(async () => {
    setDeleting(true);
    try {
      await onConfirm();
    } catch {
      /* error is handled upstream */
    } finally {
      setDeleting(false);
    }
  }, [onConfirm]);

  /* ── Derived text ─────────────────────────────────────────────────────── */
  const isBulk = deletingBulk && selectedCount > 1;
  const title = isBulk ? "Delete Tags" : "Delete Tag";
  const message = isBulk ? (
    <>
      Are you sure you want to delete{" "}
      <span className="font-semibold">{selectedCount} tags</span>?
    </>
  ) : (
    <>
      Are you sure you want to delete the tag{" "}
      <span className="font-semibold">"{deletingTag?.name}"</span>?
    </>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-delete-tag" className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="py-2 space-y-3">
          <p
            className="text-sm text-foreground"
            data-testid="delete-dialog-message"
          >
            {message}
          </p>
          <p className="text-xs text-muted-foreground">
            This action cannot be undone. Leads that currently have{" "}
            {isBulk ? "these tags" : "this tag"} will not lose{" "}
            {isBulk ? "them" : "it"} — only the tag definition
            {isBulk ? "s" : ""} will be removed.
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            data-testid="button-cancel-delete-tag"
            onClick={() => onOpenChange(false)}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            data-testid="button-confirm-delete-tag"
            onClick={handleConfirm}
            disabled={deleting}
          >
            {deleting
              ? "Deleting..."
              : isBulk
                ? `Delete ${selectedCount} Tags`
                : "Delete Tag"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
