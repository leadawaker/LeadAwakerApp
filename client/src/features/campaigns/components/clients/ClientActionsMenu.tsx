import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MoreHorizontal, Copy, Trash2, ChevronLeft } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { IconBtn } from "@/components/ui/icon-btn";
import { DeleteClientError, useDemoClient, useDuplicateDemoClient, useDeleteDemoClient } from "../../api/demoClientsApi";
import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";
import "./clients.css";

export function ClientActionsMenu({
  niche,
  onDeleted,
  onDuplicated,
  variant = "topbar",
}: {
  niche: string;
  onDeleted: () => void;
  onDuplicated: (newNiche: string) => void;
  /** Where the trigger sits: a page topbar (square button) or the persona panel header (round, like its close button). */
  variant?: "topbar" | "panel";
}) {
  const { t } = useTranslation("campaigns");
  const { t: td } = useTranslation("demos");
  const { data: client } = useDemoClient(niche);
  const duplicate = useDuplicateDemoClient();
  const remove = useDeleteDemoClient();

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"menu" | "duplicate">("menu");
  const [newNiche, setNewNiche] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Set when the server answers 409 live_tokens: the dialog then warns and the
  // confirm button retries with force.
  const [liveCount, setLiveCount] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Curated niche packs are listed and editable but not deletable: real
  // campaigns read their word lists. Duplicating one is still fine (it always
  // creates a NEW, deletable row): only Delete is gated.
  // A live persona (specs/voice-tab) is read-only here: no duplicate, no delete.
  const isLive = client?.isLive ?? false;
  const canDelete = (client?.isDemoClient ?? false) && !isLive;

  const reset = () => {
    setStep("menu");
    setNewNiche("");
    setError(null);
  };

  const handleDuplicate = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newNiche.trim();
    if (!name) return;
    setError(null);
    duplicate.mutate(
      { niche, newNiche: name },
      {
        onSuccess: (data) => {
          setOpen(false);
          reset();
          onDuplicated(data.client.niche);
        },
        onError: (err: unknown) => {
          setError(err instanceof Error ? err.message : t("clients.duplicateFailed", "Could not duplicate this persona."));
        },
      },
    );
  };

  const closeDelete = () => {
    setConfirmDelete(false);
    setLiveCount(null);
    setDeleteError(null);
  };

  const handleDelete = () => {
    setDeleteError(null);
    remove.mutate({ niche, force: liveCount !== null }, {
      onSuccess: () => {
        closeDelete();
        onDeleted();
      },
      onError: (err: unknown) => {
        if (err instanceof DeleteClientError && err.code === "live_tokens") {
          setLiveCount(err.count);
          return;
        }
        setDeleteError(err instanceof Error ? err.message : td("personas.deleteFailed"));
      },
    });
  };

  return (
    <>
      <Popover
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) reset();
        }}
      >
        <PopoverTrigger asChild>
          {variant === "panel" ? (
            <IconBtn title={t("clients.moreActions", "More actions")} aria-label={t("clients.moreActions", "More actions")}>
              <MoreHorizontal className="h-4 w-4" />
            </IconBtn>
          ) : (
            <button className="la-btn la-btn--soft la-btn--icon dp-touch" title={t("clients.moreActions", "More actions")}>
              <MoreHorizontal className="h-4 w-4" />
            </button>
          )}
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 p-3">
          {step === "menu" && (
            <div className="space-y-1">
              {!isLive && (
                <button
                  onClick={() => {
                    setNewNiche(`${niche} copy`);
                    setStep("duplicate");
                  }}
                  className="dp-menu-item"
                >
                  <Copy className="h-3.5 w-3.5 shrink-0" />
                  {t("clients.duplicate", "Duplicate")}
                </button>
              )}
              {isLive && (
                <p style={{ padding: "8px 10px", fontSize: 12.5, lineHeight: 1.5, color: "var(--mute)", margin: 0 }}>{t("clients.live.menuNote")}</p>
              )}
              {canDelete && (
                <button
                  onClick={() => {
                    setOpen(false);
                    setConfirmDelete(true);
                  }}
                  className="dp-menu-item dp-menu-item--danger"
                >
                  <Trash2 className="h-3.5 w-3.5 shrink-0" />
                  {t("clients.delete", "Delete")}
                </button>
              )}
            </div>
          )}

          {step === "duplicate" && (
            <form onSubmit={handleDuplicate} className="space-y-3">
              <button
                type="button"
                onClick={reset}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft className="h-3 w-3" /> {t("clients.back", "Back")}
              </button>
              <div>
                <label className="dp-label" htmlFor="dp-duplicate-name">
                  {t("clients.duplicateNamePrompt", "Name for the new persona")}
                </label>
                <input
                  autoFocus
                  type="text"
                  value={newNiche}
                  onChange={(e) => setNewNiche(e.target.value)}
                  maxLength={300}
                  id="dp-duplicate-name"
                  className="la-input dp-input"
                />
              </div>
              {error && (
                <p className="dp-error" style={{ margin: 0 }}>{error}</p>
              )}
              <button
                type="submit"
                disabled={!newNiche.trim() || duplicate.isPending}
                className="la-btn la-btn--wine w-full disabled:opacity-50"
              >
                {duplicate.isPending ? t("clients.duplicating", "Duplicating…") : t("clients.duplicate", "Duplicate")}
              </button>
            </form>
          )}
        </PopoverContent>
      </Popover>

      {confirmDelete && (
        <ConfirmDeleteDialog
          niche={niche}
          liveCount={liveCount}
          error={deleteError}
          pending={remove.isPending}
          onCancel={closeDelete}
          onConfirm={handleDelete}
        />
      )}
    </>
  );
}
