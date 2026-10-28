import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Trash2 } from "lucide-react";
import { RightPanel } from "@/components/crm/primitives/RightPanel";
import { toast } from "@/hooks/use-toast";
import { useDeleteProspect } from "../../api/demoProspectsApi";
import type { NotesSaver } from "../../notesSaver";
import { prospectCounts } from "../../prospectDetail";
import type { ProspectRow } from "../../prospectRows";
import { TOUCH_ROW } from "../../touchTargets";
import { DeleteConfirmDialog } from "../DeleteConfirmDialog";
import { ProspectLinksList } from "./ProspectLinksList";
import { ProspectNotes } from "./ProspectNotes";
import { ProspectSettingsForm } from "./ProspectSettingsForm";
import { SectionTitle } from "./SectionTitle";
import "../panelTouch.css";

const SECTION = "border-t pt-4";

/**
 * One prospect in the right-hand column: how their links did, the links themselves, their
 * settings (editable after the links went out), notes, and delete. Looked up by key in the
 * unfiltered rows, so a filter or search never closes it. Mount it with `key={rowKey}`: the
 * forms hold edits, which must not carry over from one prospect to the next.
 */
export function ProspectDetailPanel({ rowKey, rows, onClose }: { rowKey: string; rows: ProspectRow[]; onClose: () => void }) {
  const { t } = useTranslation("demos");
  const deleteProspect = useDeleteProspect();
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Covers the wait for the notes save as well as the DELETE itself.
  const [deleting, setDeleting] = useState(false);
  const notes = useRef<NotesSaver | null>(null);
  const row = rows.find((r) => r.key === rowKey);

  // The prospect is gone (deleted elsewhere, or by this panel): nothing is left to show.
  useEffect(() => {
    if (!row) onClose();
  }, [row, onClose]);
  if (!row) return null;

  const counts = prospectCounts(row);
  const subtitle = [row.companyName, row.clientNiche].filter(Boolean).join(" · ");

  const doDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    // A note still on its way would reach the server after the DELETE and recreate a legacy prospect's row,
    // so it lands first; the field then stops saving, since the prospect is about to go.
    await notes.current?.save();
    notes.current?.discard();
    try {
      await deleteProspect.mutateAsync({ group: row.key });
      setConfirmOpen(false);
      toast({ variant: "success", title: t("detail.deleted") });
      onClose();
    } catch (e) {
      setConfirmOpen(false);
      toast({ variant: "destructive", title: t("links.actionFailed"), description: e instanceof Error ? e.message : undefined });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <RightPanel
      title={row.firstName || t("detail.title")}
      subtitle={subtitle || undefined}
      onClose={onClose}
      footer={null}
      data-testid="prospect-detail-panel"
    >
      <p style={{ fontSize: 12.5, color: "var(--mute)" }}>{t("detail.counts", counts)}</p>

      <section className={SECTION} style={{ borderColor: "var(--line)" }}>
        <SectionTitle>{t("detail.links")}</SectionTitle>
        <ProspectLinksList row={row} />
      </section>

      <section className={SECTION} style={{ borderColor: "var(--line)" }}>
        <SectionTitle>{t("detail.settings")}</SectionTitle>
        {/* A visitor's own website demo keeps its settings (the server answers 409 public_demo); notes and delete stay. */}
        {row.publicDemo ? (
          <p style={{ fontSize: 12.5, color: "var(--mute)" }}>{t("detail.publicDemoNote")}</p>
        ) : (
          <ProspectSettingsForm row={row} />
        )}
      </section>

      <section className={SECTION} style={{ borderColor: "var(--line)" }}>
        <SectionTitle>{t("detail.notes")}</SectionTitle>
        <ProspectNotes row={row} saver={notes} />
      </section>

      <section className={SECTION} style={{ borderColor: "var(--line)" }}>
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          className={`la-btn la-btn--soft h-9 gap-1.5 px-4 text-sm ${TOUCH_ROW}`}
          // Inline: .la-btn sets its own colour, which a utility class cannot override.
          style={{ color: "hsl(var(--destructive))" }}
        >
          {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          {t("detail.deleteProspect")}
        </button>
      </section>

      <DeleteConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("detail.deleteTitle")}
        body={t("detail.deleteBody")}
        confirmLabel={t("detail.deleteProspect")}
        onConfirm={() => void doDelete()}
        pending={deleting}
      />
    </RightPanel>
  );
}
