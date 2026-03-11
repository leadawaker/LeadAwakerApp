/* ════════════════════════════════════════════════════════════════════════════
   DeleteTagDialog — confirmation dialog for deleting one or many tags
   ════════════════════════════════════════════════════════════════════════════ */

import { useState, useCallback } from "react";
import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation("tags");
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
  const title = isBulk
    ? t("deleteDialog.titleBulk")
    : t("deleteDialog.titleSingle");
  const message = isBulk ? (
    <>
      {t("deleteDialog.messageBulkPrefix")}{" "}
      <span className="font-semibold">
        {t("deleteDialog.tagsCount", { count: selectedCount })}
      </span>
      ?
    </>
  ) : (
    <>
      {t("deleteDialog.messageSinglePrefix")}{" "}
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
            {isBulk
              ? t("deleteDialog.warningBulk")
              : t("deleteDialog.warningSingle")}
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            data-testid="button-cancel-delete-tag"
            onClick={() => onOpenChange(false)}
            disabled={deleting}
          >
            {t("deleteDialog.cancel")}
          </Button>
          <Button
            variant="destructive"
            data-testid="button-confirm-delete-tag"
            onClick={handleConfirm}
            disabled={deleting}
          >
            {deleting
              ? t("deleteDialog.deleting")
              : isBulk
                ? t("deleteDialog.deleteBulk", { count: selectedCount })
                : t("deleteDialog.deleteSingle")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
