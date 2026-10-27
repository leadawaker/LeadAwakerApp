import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * Destructive confirmation for deleting a persona. Two bodies: the plain one,
 * and, once the server has answered 409 live_tokens, the warning that `liveCount`
 * demo links still use the persona, whose confirm button reads "Delete anyway"
 * and retries with force. The confirm is a plain button (not the dialog's Action)
 * so a failed delete leaves the dialog open to show the error.
 */
export function ConfirmDeleteDialog({ niche, liveCount, error, pending, onCancel, onConfirm }: {
  niche: string;
  /** Null until the server reports live links. */
  liveCount: number | null;
  error: string | null;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation("campaigns");
  const { t: td } = useTranslation("demos");
  const warned = liveCount !== null;

  return (
    <AlertDialog open onOpenChange={(open) => { if (!open && !pending) onCancel(); }}>
      <AlertDialogContent data-testid="persona-delete-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>{t("clients.confirmDeleteTitle", "Delete this persona?")}</AlertDialogTitle>
          <AlertDialogDescription>
            {warned ? td("personas.deleteLiveWarning", { count: liveCount ?? 0 }) : t("clients.confirmDeleteBody", { niche })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p className="dp-error" role="alert" style={{ margin: 0 }}>{error}</p>}
        <AlertDialogFooter className="max-md:gap-2">
          <AlertDialogPrimitive.Cancel asChild>
            <button type="button" className="la-btn la-btn--soft dp-touch" disabled={pending}>
              {t("clients.cancel", "Cancel")}
            </button>
          </AlertDialogPrimitive.Cancel>
          <button type="button" className="la-btn la-btn--wine dp-touch" onClick={onConfirm} disabled={pending}>
            {pending
              ? t("clients.deleting", "Deleting...")
              : warned ? td("personas.deleteAnyway") : t("clients.delete", "Delete")}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
