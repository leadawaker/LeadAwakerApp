import { useTranslation } from "react-i18next";
import { useWorkspace } from "./useWorkspace";

/**
 * Returns the label + confirm copy a delete button should show based on the
 * current user's role.
 *
 * Owner: button reads "Delete", confirm copy warns about permanent deletion.
 * Admin/Operator/anyone-else: button reads "Archive", confirm copy explains
 *   that the row will be hidden but restorable.
 *
 * The actual DELETE request hits the same endpoint regardless — the server
 * decides whether to soft-archive (status='Archived') or hard-delete based
 * on the caller's role. Owner-only hard purge of an already-archived row
 * goes through POST /api/<entity>/:id/purge.
 */
export type DeleteEntity = "campaign" | "lead" | "prospect" | "account" | "task" | "item";

export function useDeleteAction(entity: DeleteEntity = "item") {
  const { t } = useTranslation("common");
  const { canHardDelete } = useWorkspace();

  const isHardDelete = canHardDelete;
  const label = isHardDelete
    ? t("deleteAction.delete")
    : t("deleteAction.archive");
  const confirmCopy = isHardDelete
    ? t("deleteAction.confirmDelete", { entity })
    : t("deleteAction.confirmArchive", { entity });

  return { label, confirmCopy, isHardDelete };
}
