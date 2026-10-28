import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { useUpdateProspect } from "../../api/demoProspectsApi";
import type { ProspectRow } from "../../prospectRows";

/**
 * The prospect's notes, saved when the field loses focus (and only when the text changed).
 * Closing the panel with Escape never blurs the field, so unmounting saves what is pending too.
 */
export function ProspectNotes({ row }: { row: ProspectRow }) {
  const { t } = useTranslation("demos");
  const update = useUpdateProspect();
  const [value, setValue] = useState(row.notes);
  // The text the server holds, as far as this field knows: set when a save starts, undone if it fails.
  const saved = useRef(row.notes);
  const latest = useRef(value);
  latest.current = value;

  const save = async () => {
    const text = latest.current;
    if (text === saved.current) return;
    const before = saved.current;
    saved.current = text;
    try {
      await update.mutateAsync({ group: row.key, patch: { notes: text } });
    } catch (e) {
      saved.current = before;
      toast({ variant: "destructive", title: t("detail.saveFailed"), description: e instanceof Error ? e.message : undefined });
    }
  };

  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => () => void saveRef.current(), []);

  return (
    <Textarea
      value={value}
      rows={5}
      maxLength={4000}
      aria-label={t("detail.notes")}
      placeholder={t("detail.notesPlaceholder")}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => void save()}
    />
  );
}
