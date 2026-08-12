import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MoreHorizontal, Copy, Trash2, ChevronLeft } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useDemoClient, useDuplicateDemoClient, useDeleteDemoClient } from "../../api/demoClientsApi";

export function ClientActionsMenu({
  niche,
  onDeleted,
  onDuplicated,
}: {
  niche: string;
  onDeleted: () => void;
  onDuplicated: (newNiche: string) => void;
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
  // creates a NEW, deletable row) — only Delete is gated.
  const canDelete = client?.isDemoClient ?? false;

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
          setError(err instanceof Error ? err.message : t("clients.duplicateFailed", "Could not duplicate this Client."));
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
          <button className="la-btn la-btn--soft la-btn--icon" title={t("clients.moreActions", "More actions")}>
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 p-3">
          {step === "menu" && (
            <div className="space-y-1">
              <button
                onClick={() => {
                  setNewNiche(`${niche} copy`);
                  setStep("duplicate");
                }}
                className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] hover:bg-muted/50 transition-colors"
              >
                <Copy className="h-3.5 w-3.5 shrink-0" />
                {t("clients.duplicate", "Duplicate")}
              </button>
              {canDelete && (
                <button
                  onClick={() => {
                    setOpen(false);
                    setConfirmDelete(true);
                  }}
                  className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] text-red-600 hover:bg-red-50 transition-colors"
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
                <label className="block text-[12px] font-medium mb-1">
                  {t("clients.duplicateNamePrompt", "Name for the new Client")}
                </label>
                <input
                  autoFocus
                  type="text"
                  value={newNiche}
                  onChange={(e) => setNewNiche(e.target.value)}
                  maxLength={300}
                  className="w-full h-8 rounded-md border border-black/[0.125] bg-white px-2.5 text-[12px] outline-none focus:border-brand-indigo transition-colors"
                />
              </div>
              {error && (
                <div className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded-md px-2 py-1.5">
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={!newNiche.trim() || duplicate.isPending}
                className="w-full h-9 rounded-full bg-brand-indigo text-white font-medium text-[13px] hover:opacity-90 disabled:opacity-50 transition-opacity"
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
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={onCancel}
    >
      <div
        className="neu-raised"
        style={{ background: "var(--card)", padding: 26, borderRadius: "var(--r-card)", maxWidth: 380, margin: 16 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="serif" style={{ fontSize: 20, color: "var(--ink)", marginBottom: 8 }}>
          {t("clients.confirmDeleteTitle", "Delete this Client?")}
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
