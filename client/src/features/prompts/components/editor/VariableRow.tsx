// One variable in the Variables panel: its name, what it means, what it resolves
// to in the picked context, and for an editable one where an edit saves. An
// editable value sits in a well; a read-only one is plain text with its origin.
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Loader2, AlertCircle, ExternalLink } from "lucide-react";
import { sourceOptions, type VarSource } from "../../utils/variableRegistry";
import { readStored, writeVariable, type WriteResult, type WriteTarget } from "../../utils/variableWrites";

type SaveState = { state: "idle" } | { state: "saving" } | { state: "saved" } | { state: "failed"; message: string };

const wellStyle = {
  background: "var(--bone)", boxShadow: "var(--sh-inset-super-crisp)", borderRadius: "var(--r-flush)",
  color: "var(--ink)", fontSize: 12, lineHeight: 1.45,
} as const;

export function VariableRow({
  name, description, value, source, editable, savesTo, readOnlyNote, remark, link, justSaved, target, onSaved, onInsert, onOpenPopup, editSignal,
}: {
  name: string;
  /** Plain-language meaning, or null when the registry has none. */
  description: string | null;
  /** What it resolves to in the picked context. */
  value: string;
  source: VarSource | undefined;
  editable: boolean;
  /** "Saves to campaign: X", when editable. */
  savesTo: string | null;
  /** Where a read-only value comes from. */
  readOnlyNote: string | null;
  /** A remark on this render, whichever kind of row it is. */
  remark?: string | null;
  /** Its proper editor, when writing from here would skip that editor's logic. */
  link?: { href: string; label: string } | null;
  /** Its pop-up editor just saved. */
  justSaved?: boolean;
  target: WriteTarget;
  onSaved: (result: WriteResult) => void;
  onInsert: (name: string) => void;
  onOpenPopup?: (value: Extract<VarSource, { kind: "voicePopup" }>["value"], name: string, rect: DOMRect) => void;
  /** Changes when its value was clicked in the preview: open the editor here. */
  editSignal?: number;
}) {
  const { t } = useTranslation("prompts");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [save, setSave] = useState<SaveState>({ state: "idle" });
  const fieldRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);

  const rowRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { if (editing) fieldRef.current?.focus(); }, [editing]);

  useEffect(() => {
    if (!editSignal || !rowRef.current) return;
    rowRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
    openEditor(rowRef.current.getBoundingClientRect());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editSignal]);

  const options = source ? sourceOptions(source) : undefined;
  const long = (source?.kind === "campaign" || source?.kind === "clientText" || source?.kind === "voiceLine")
    ? source.input === "long" : source?.kind === "nichePack";

  function startEdit(e: React.MouseEvent) {
    openEditor(e.currentTarget.getBoundingClientRect());
  }

  function openEditor(rect: DOMRect) {
    if (!source || !editable) return;
    if (source.kind === "voicePopup") {
      onOpenPopup?.(source.value, name, rect);
      return;
    }
    setDraft(readStored(source, target));
    setSave({ state: "idle" });
    setEditing(true);
  }

  async function commit(next: string) {
    if (!source) return;
    setSave({ state: "saving" });
    let result: WriteResult;
    try {
      result = await writeVariable(source, target, next);
    } catch (err: any) {
      result = { ok: false, reason: "http", message: err?.message };
    }
    if (result.ok) {
      onSaved(result);
      setEditing(false);
      setSave({ state: "saved" });
    } else {
      setSave({ state: "failed", message: t(`vars.reason.${result.reason}`, { message: result.message ?? "" }) });
    }
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.stopPropagation(); setEditing(false); setSave({ state: "idle" }); }
    if (e.key === "Enter" && (!long || e.ctrlKey || e.metaKey)) { e.preventDefault(); void commit(draft); }
  };

  return (
    <div ref={rowRef} style={{ padding: "9px 12px", borderTop: "1px solid var(--line)" }}>
      <button
        type="button"
        onClick={() => onInsert(name)}
        title={t("vars.insert", { name })}
        style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 600, color: "var(--wine)", background: "transparent", border: "none", padding: 0, cursor: "pointer", wordBreak: "break-all", textAlign: "left" }}
      >
        {`{${name}}`}
      </button>
      <p style={{ fontSize: 11.5, lineHeight: 1.4, color: description ? "var(--mute)" : "var(--mute-2)", fontStyle: description ? undefined : "italic", margin: "1px 0 5px" }}>
        {description ?? t("vars.noDescription")}
      </p>

      {editing ? (
        <div className="flex flex-col gap-1.5">
          {options ? (
            <select
              style={{ ...wellStyle, padding: "5px 6px", border: "none" }}
              className="outline-none cursor-pointer"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              aria-label={name}
            >
              {!options.includes(draft) && <option value={draft}>{draft || t("vars.empty")}</option>}
              {options.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : long ? (
            <textarea
              ref={(el) => { fieldRef.current = el; }}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKey}
              rows={5}
              className="w-full outline-none resize-y"
              style={{ ...wellStyle, padding: "5px 7px" }}
              aria-label={name}
            />
          ) : (
            <input
              ref={(el) => { fieldRef.current = el; }}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKey}
              className="w-full outline-none"
              style={{ ...wellStyle, padding: "5px 7px" }}
              aria-label={name}
            />
          )}
          <div className="flex items-center gap-1.5">
            <button type="button" className="la-btn la-btn--wine" style={{ height: 24, padding: "0 10px", fontSize: 11.5 }} disabled={save.state === "saving"} onClick={() => void commit(draft)}>
              {t("vars.save")}
            </button>
            <button type="button" className="la-btn la-btn--soft" style={{ height: 24, padding: "0 10px", fontSize: 11.5 }} onClick={() => { setEditing(false); setSave({ state: "idle" }); }}>
              {t("vars.cancel")}
            </button>
          </div>
        </div>
      ) : editable ? (
        <button
          type="button"
          onClick={(e) => startEdit(e)}
          title={t("vars.edit")}
          className="w-full text-left [scrollbar-width:thin]"
          style={{ ...wellStyle, display: "block", border: "none", padding: "5px 7px", cursor: "text", whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 92, overflowY: "auto" }}
        >
          {value || <span style={{ color: "var(--mute-2)", fontStyle: "italic" }}>{t("vars.empty")}</span>}
        </button>
      ) : (
        <div className="[scrollbar-width:thin]" style={{ fontSize: 12, lineHeight: 1.45, color: "var(--ink-soft)", whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 92, overflowY: "auto" }}>
          {value || <span style={{ color: "var(--mute-2)", fontStyle: "italic" }}>{t("vars.empty")}</span>}
        </div>
      )}

      {editable && savesTo && (
        <p style={{ fontSize: 10.5, lineHeight: 1.35, color: "var(--mute-2)", marginTop: 4 }}>{savesTo}</p>
      )}
      {!editable && readOnlyNote && (
        <p style={{ fontSize: 10.5, lineHeight: 1.35, color: "var(--mute-2)", marginTop: 3 }}>{readOnlyNote}</p>
      )}
      {remark && (
        <p style={{ fontSize: 10.5, lineHeight: 1.35, color: "var(--warn)", marginTop: 3 }}>{remark}</p>
      )}
      {link && (
        <a
          href={link.href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1"
          style={{ fontSize: 10.5, fontWeight: 600, color: "var(--wine)", marginTop: 3 }}
        >
          {link.label} <ExternalLink size={10} />
        </a>
      )}
      {save.state === "saving" && (
        <p className="flex items-center gap-1" style={{ fontSize: 10.5, color: "var(--mute)", marginTop: 3 }}>
          <Loader2 size={11} className="animate-spin" /> {t("vars.saving")}
        </p>
      )}
      {(save.state === "saved" || (justSaved && save.state === "idle")) && (
        <p className="flex items-center gap-1" style={{ fontSize: 10.5, color: "var(--good)", marginTop: 3 }}>
          <Check size={11} /> {t("vars.saved")}
        </p>
      )}
      {save.state === "failed" && (
        <p className="flex items-start gap-1" style={{ fontSize: 10.5, color: "var(--destructive)", marginTop: 3 }}>
          <AlertCircle size={11} className="shrink-0" style={{ marginTop: 1 }} /> {t("vars.failed", { reason: save.message })}
        </p>
      )}
    </div>
  );
}
