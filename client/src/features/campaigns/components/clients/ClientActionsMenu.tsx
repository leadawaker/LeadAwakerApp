import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MoreHorizontal, Copy, Trash2, ChevronLeft } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { IconBtn } from "@/components/ui/icon-btn";
import { useDemoClient, useDuplicateDemoClient, useDeleteDemoClient } from "../../api/demoClientsApi";
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
  const { data: client } = useDemoClient(niche);
  const duplicate = useDuplicateDemoClient();
  const remove = useDeleteDemoClient();

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"menu" | "duplicate">("menu");
  const [newNiche, setNewNiche] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

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

  const handleDelete = () => {
    remove.mutate(niche, {
      onSuccess: () => {
        setConfirmDelete(false);
        onDeleted();
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
            <button className="la-btn la-btn--soft la-btn--icon" title={t("clients.moreActions", "More actions")}>
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
        <ConfirmDelete
          niche={niche}
          pending={remove.isPending}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={handleDelete}
        />
      )}
    </>
  );
}

/** Destructive confirmation. Moved here from ClientEditor.tsx: deletion now
 *  triggers from this topbar menu, not from the editor's own header. */
function ConfirmDelete({
  niche,
  pending,
  onCancel,
  onConfirm,
}: {
  niche: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation("campaigns");
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onCancel}
    >
      <div
        className="neu-raised"
        style={{ background: "var(--card)", padding: 26, borderRadius: "var(--r-card)", maxWidth: 380, margin: 16 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="serif" style={{ fontSize: 20, color: "var(--ink)", marginBottom: 8 }}>
          {t("clients.confirmDeleteTitle", "Delete this persona?")}
        </div>
        <p style={{ fontSize: 13, color: "var(--mute)", lineHeight: 1.5, marginBottom: 18 }}>
          {t("clients.confirmDeleteBody", { niche })}
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="la-btn la-btn--soft" onClick={onCancel}>
            {t("clients.cancel", "Cancel")}
          </button>
          <button className="la-btn la-btn--wine" onClick={onConfirm} disabled={pending}>
            {pending ? t("clients.deleting", "Deleting...") : t("clients.delete", "Delete")}
          </button>
        </div>
      </div>
    </div>
  );
}
