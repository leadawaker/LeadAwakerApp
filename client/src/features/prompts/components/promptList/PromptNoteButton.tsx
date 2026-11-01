// The prompt's note: a small info icon beside the status pill, filled when a
// note exists. Its popover views, edits and clears the note; each change goes
// to the editor's autosave (Prompt_Library.notes through PUT /api/prompts/:id).
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function PromptNoteButton({ note, onChange }: { note: string; onChange: (value: string) => void }) {
  const { t } = useTranslation("prompts");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(note);

  // A saved note or a loaded version shows here, but never under someone typing.
  useEffect(() => { if (!open) setDraft(note); }, [note, open]);

  const update = (value: string) => { setDraft(value); onChange(value); };
  const hasNote = draft.trim().length > 0;
  const label = t(hasNote ? "note.view" : "note.add");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="shrink-0 flex items-center justify-center"
          style={{ width: 22, height: 22, border: "none", background: "transparent", cursor: "pointer", borderRadius: "var(--r-pill)", padding: 0 }}
          title={label}
          aria-label={label}
        >
          {hasNote
            ? <Info size={16} fill="var(--wine)" color="var(--on-wine)" />
            : <Info size={15} color="var(--mute-2)" />}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-3">
        <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
          <p style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)" }}>{t("note.title")}</p>
          {hasNote && (
            <button type="button" className="la-btn la-btn--plain" style={{ height: 22, padding: "0 4px", fontSize: 11.5 }} onClick={() => update("")}>
              {t("note.clear")}
            </button>
          )}
        </div>
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => update(e.target.value)}
          placeholder={t("form.notesPlaceholderAlt")}
          rows={5}
          className="w-full px-2.5 py-2 text-[12.5px] outline-none resize-y"
          style={{ background: "var(--bone)", boxShadow: "var(--sh-inset-crisp)", borderRadius: "var(--r-flush)", color: "var(--ink)" }}
        />
        <p style={{ fontSize: 11, color: "var(--mute)", marginTop: 6 }}>{t("note.hint")}</p>
      </PopoverContent>
    </Popover>
  );
}
