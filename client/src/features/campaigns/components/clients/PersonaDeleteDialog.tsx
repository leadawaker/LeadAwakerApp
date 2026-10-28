import { useState } from "react";
import { useTranslation } from "react-i18next";
import { DeleteClientError, useDeleteDemoClient } from "../../api/demoClientsApi";
import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";

/**
 * Deleting a persona, from wherever the Delete button sits (the list row, or the
 * editor's "..." menu): the confirmation, the delete, and the retry with force when
 * the server answers 409 live_tokens (demo links still use the persona). The caller
 * decides whether Delete is offered at all (canDeletePersona) and renders this only
 * once the person has pressed it.
 */
export function PersonaDeleteDialog({ niche, onClose, onDeleted }: {
  niche: string;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { t: td } = useTranslation("demos");
  const remove = useDeleteDemoClient();
  // Set when the server answers 409 live_tokens: the dialog then warns and the
  // confirm button retries with force.
  const [liveCount, setLiveCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const confirm = () => {
    setError(null);
    remove.mutate({ niche, force: liveCount !== null }, {
      onSuccess: () => {
        onClose();
        onDeleted();
      },
      onError: (err: unknown) => {
        if (err instanceof DeleteClientError && err.code === "live_tokens") {
          setLiveCount(err.count);
          return;
        }
        setError(err instanceof Error ? err.message : td("personas.deleteFailed"));
      },
    });
  };

  return (
    <ConfirmDeleteDialog
      niche={niche}
      liveCount={liveCount}
      error={error}
      pending={remove.isPending}
      onCancel={onClose}
      onConfirm={confirm}
    />
  );
}
