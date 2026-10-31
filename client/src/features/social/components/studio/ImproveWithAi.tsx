// "Improve with AI" inside the script panel: notes (typed or dictated), one pass of the model on the text
// in the editor, and a version switcher. Every pass is a version, the Original is the saved text, and
// nothing is written to the script until Save in the panel. Unsaved versions live in localStorage per
// script: closing the panel or a refresh offers them back with a restore banner (no confirm dialogs).
import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Loader2, Mic, Sparkles, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconBtn } from "@/components/ui/icon-btn";
import { SocialApiError } from "../../api/socialApi";
import { improveScript, type ScriptView } from "../../api/studioApi";
import { hasUnsaved } from "../../lib/scriptVersions";
import { studioErrorKey } from "../../lib/studio";
import { useScriptVersions } from "../../lib/useScriptVersions";
import { useTopicRecorder } from "../../lib/useTopicRecorder";

const NOTES_MAX = 4_000;
const labelStyle: React.CSSProperties = { fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--mute-2)", display: "block" };
const hintStyle: React.CSSProperties = { fontSize: 11.5, color: "var(--mute)" };
const errStyle: React.CSSProperties = { margin: 0, fontSize: 12, color: "hsl(var(--destructive))" };

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

interface Props {
  accountId: number;
  script: ScriptView;
  title: string;
  body: string;
  setTitle: (v: string) => void;
  setBody: (v: string) => void;
  versions: ReturnType<typeof useScriptVersions>;
  /** Another action of the panel is running (save, send). */
  disabled: boolean;
}

export function ImproveWithAi({ accountId, script, title, body, setTitle, setBody, versions, disabled }: Props) {
  const { t } = useTranslation("social");
  const [notes, setNotes] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const bodyRef = useRef(body);
  bodyRef.current = body;
  const rec = useTopicRecorder(accountId, (heard) => setNotes((prev) => (prev.trim() ? `${prev.trim()}\n${heard}` : heard).slice(0, NOTES_MAX)));

  const improve = useMutation({
    mutationFn: (input: { title: string; body: string; notes: string }) => improveScript(accountId, script.id, input),
    // In the options (not mutate()), so an answer landing after the panel closed still becomes a version.
    onSuccess: (result, input) => {
      // Text typed while the model was writing is kept as an edit version, not overwritten.
      versions.improved(bodyRef.current, result, input.notes);
      setBody(result.body);
      setNotes("");
    },
  });

  useEffect(() => {
    if (!improve.isPending) return;
    setElapsed(0);
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [improve.isPending]);

  const { state, shown, restorable } = versions;
  const many = hasUnsaved(state);
  const busy = disabled || improve.isPending || rec.state !== "idle";
  const pick = (i: number) => { versions.select(body, i); setBody(state.versions[i].body); };
  const aiTitle = shown.kind === "ai" && shown.title && shown.title !== script.title ? shown.title : null;
  const reason = improve.error instanceof SocialApiError ? improve.error.reason : improve.error ? "failed" : rec.error;
  let aiN = 0, editN = 0;
  const chipLabel = state.versions.map((v) => (v.kind === "original" ? t("improve.original") : v.kind === "ai" ? t("improve.aiVersion", { n: ++aiN }) : t("improve.editVersion", { n: ++editN })));

  return (
    <div className="neu-inset-crisp" style={{ borderRadius: "var(--r-surface)", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }} data-testid="script-improve">
      {restorable && (
        <div className="neu-raised" style={{ borderRadius: "var(--r-surface)", background: "var(--card)", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }} role="status" data-testid="script-improve-restore">
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-soft)" }}>{t("improve.restoreBanner")}</p>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="la-btn la-btn--soft" disabled={busy}
              onClick={() => { versions.restore(); setBody(restorable.versions[restorable.index].body); }} data-testid="script-improve-restore-btn">{t("improve.restore")}</button>
            <button type="button" className="la-btn la-btn--plain" disabled={busy} onClick={versions.discard}>{t("improve.discard")}</button>
          </div>
        </div>
      )}

      {many && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
          <div className="row" style={{ gap: 8 }}>
            <span style={{ ...labelStyle, flex: 1 }}>{t("improve.versions")}</span>
            <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--mute-2)" }}>{t("improve.position", { n: state.index + 1, total: state.versions.length })}</span>
          </div>
          <div className="la-seg la-seg--pill" role="tablist" aria-label={t("improve.versions")} style={{ alignSelf: "flex-start", maxWidth: "100%", overflowX: "auto", scrollbarWidth: "none" }}>
            {state.versions.map((v, i) => (
              <button key={i} type="button" role="tab" aria-selected={state.index === i} className={cn("la-seg-btn", state.index === i && "on")} disabled={improve.isPending}
                title={v.notes ? t("improve.notesUsed", { notes: v.notes }) : undefined} onClick={() => pick(i)} style={{ flexShrink: 0 }} data-testid={`script-version-${i}`}>
                {chipLabel[i]}
              </button>
            ))}
          </div>
          {aiTitle && (
            <label className="row" style={{ gap: 8, fontSize: 12.5, color: "var(--ink-soft)", cursor: "pointer", alignItems: "flex-start" }}>
              <input type="checkbox" checked={title.trim() === aiTitle} onChange={(e) => setTitle(e.target.checked ? aiTitle : script.title)} style={{ marginTop: 3 }} data-testid="script-use-ai-title" />
              <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{t("improve.useAiTitle", { title: aiTitle })}</span>
            </label>
          )}
          <span style={hintStyle}>{t("improve.unsaved")}</span>
        </div>
      )}

      <label style={labelStyle} htmlFor="script-notes">{t("improve.notesLabel")}</label>
      <div className="row" style={{ gap: 8, alignItems: "flex-end" }}>
        <textarea id="script-notes" className="neu-input" rows={3} value={notes} maxLength={NOTES_MAX} onChange={(e) => setNotes(e.target.value)} placeholder={t("improve.notesPlaceholder")}
          style={{ flex: 1, minWidth: 0, fontSize: 12.5, padding: "8px 11px", resize: "vertical" }} data-testid="script-notes" />
        {rec.state === "recording" ? (
          <IconBtn onClick={rec.stop} title={t("improve.stop")} aria-label={t("improve.stop")} data-testid="script-notes-mic-stop"><Square className="w-4 h-4" /></IconBtn>
        ) : (
          <IconBtn onClick={rec.start} disabled={busy} title={t("improve.record")} aria-label={t("improve.record")} data-testid="script-notes-mic">
            {rec.state === "transcribing" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
          </IconBtn>
        )}
      </div>

      <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
        <button type="button" className="la-btn la-btn--soft" disabled={busy || !title.trim()}
          onClick={() => improve.mutate({ title: title.trim(), body, notes: notes.trim() })} data-testid="script-improve-btn">
          {improve.isPending ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}{t("improve.button")}
        </button>
        <span role="status" style={{ ...hintStyle, flex: 1, minWidth: 0 }}>
          {improve.isPending ? t("improve.working", { time: clock(elapsed) })
            : rec.state === "recording" ? t("improve.recording", { seconds: rec.elapsed })
            : rec.state === "transcribing" ? t("improve.transcribing") : ""}
        </span>
      </div>
      {reason && <p role="alert" style={errStyle}>{t(studioErrorKey(reason))}</p>}
    </div>
  );
}
