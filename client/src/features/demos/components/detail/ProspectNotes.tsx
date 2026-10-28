import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { useTranslation } from "react-i18next";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { useUpdateProspect } from "../../api/demoProspectsApi";
import { createNotesSaver, type NotesSaver } from "../../notesSaver";
import type { ProspectRow } from "../../prospectRows";

/**
 * The prospect's notes, saved when the field loses focus (and only when the text changed).
 * Closing the panel with Escape never blurs the field, so unmounting saves what is pending too.
 * `saver` is handed up so the panel can wait for a save in flight, and stop further ones, around a delete.
 */
export function ProspectNotes({ row, saver }: { row: ProspectRow; saver: MutableRefObject<NotesSaver | null> }) {
  const { t } = useTranslation("demos");
  const update = useUpdateProspect();
  const [value, setValue] = useState(row.notes);

  // The saver outlives renders; it reaches the latest hook and translation through this ref.
  const live = useRef({ send: async (_text: string) => {}, onError: (_e: unknown) => {} });
  live.current = {
    send: async (text) => {
      await update.mutateAsync({ group: row.key, patch: { notes: text } });
    },
    onError: (e) => toast({ variant: "destructive", title: t("detail.saveFailed"), description: e instanceof Error ? e.message : undefined }),
  };
  const [own] = useState(() =>
    createNotesSaver(row.notes, { send: (text) => live.current.send(text), onError: (e) => live.current.onError(e) }),
  );
  saver.current = own;

  useEffect(
    () => () => {
      void own.save();
    },
    [own],
  );

  return (
    <Textarea
      value={value}
      rows={5}
      maxLength={4000}
      aria-label={t("detail.notes")}
      placeholder={t("detail.notesPlaceholder")}
      onChange={(e) => {
        setValue(e.target.value);
        own.set(e.target.value);
      }}
      onBlur={() => void own.save()}
    />
  );
}
