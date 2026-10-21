// One script, agency side: edit the title and text, let Claude draft it with the account's voice guide,
// send it to the Manager, see his answer, give it a video (HeyGen or an mp4) and schedule the post with
// the caption writer reading the script. Right panel on desktop, full width on a phone (no dialog).
import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ExternalLink, Loader2, Send, Sparkles, Upload } from "lucide-react";
import { IconBtn } from "@/components/ui/icon-btn";
import { SocialApiError, socialPostsKey, uploadSocialVideo } from "../../api/socialApi";
import {
  attachScriptVideo, draftScript, linkScriptPost, sendScriptForReview, socialScriptsKey, updateScript, type ScriptView,
} from "../../api/studioApi";
import { uploadPrecheck } from "../../lib/posts";
import { scriptActions, spokenSeconds, studioErrorKey } from "../../lib/studio";
import { PostSheet } from "../PostSheet";
import { HeygenPicker } from "./HeygenPicker";

const labelStyle: React.CSSProperties = { fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--mute-2)", marginBottom: 5, display: "block" };
const errStyle: React.CSSProperties = { margin: 0, fontSize: 12, color: "hsl(var(--destructive))" };

function reasonOf(err: unknown): string | null {
  return err instanceof SocialApiError ? err.reason : err ? "failed" : null;
}

export function ScriptPanel({ accountId, timeZone, script, onClose }: { accountId: number; timeZone: string; script: ScriptView; onClose: () => void }) {
  const { t, i18n } = useTranslation("social");
  const qc = useQueryClient();
  const [title, setTitle] = useState(script.title);
  const [body, setBody] = useState(script.body);
  const [notes, setNotes] = useState("");
  const [videoPicker, setVideoPicker] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  // A new script picked, or the server sent a new version (draft, review): show what is saved.
  useEffect(() => { setTitle(script.title); setBody(script.body); }, [script.id, script.title, script.body]);
  useEffect(() => { panelRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }); }, [script.id]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: socialScriptsKey(accountId) });
    qc.invalidateQueries({ queryKey: socialPostsKey(accountId) });
  };
  const save = useMutation({ mutationFn: () => updateScript(accountId, script.id, { title: title.trim(), body }), onSuccess: refresh });
  const draft = useMutation({ mutationFn: () => draftScript(accountId, script.id, notes), onSuccess: () => { setNotes(""); refresh(); } });
  const send = useMutation({ mutationFn: () => sendScriptForReview(accountId, script.id), onSuccess: refresh });
  const approve = useMutation({ mutationFn: () => updateScript(accountId, script.id, { status: "approved" }), onSuccess: refresh });
  const link = useMutation({ mutationFn: (postId: number) => linkScriptPost(accountId, script.id, postId), onSettled: () => { setScheduling(false); refresh(); } });

  const dirty = title.trim() !== script.title || body !== script.body;
  const actions = scriptActions(script);
  const busy = save.isPending || draft.isPending || send.isPending;
  const when = (iso: string) => new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(iso));

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    setUploadErr(null);
    const bad = uploadPrecheck(file);
    if (bad) { setUploadErr(bad); return; }
    setUploadPct(0);
    try {
      const up = await uploadSocialVideo(accountId, file, setUploadPct);
      await attachScriptVideo(accountId, script.id, up.uploadId);
      refresh();
    } catch (err) {
      setUploadErr(reasonOf(err));
    } finally {
      setUploadPct(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <section ref={panelRef} className="neu-raised" style={{ borderRadius: "var(--r-card)", background: "var(--bone)", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14, scrollMarginTop: 96, minWidth: 0 }} data-testid="script-panel">
      <div className="row" style={{ gap: 10 }}>
        <IconBtn onClick={onClose} title={t("scripts.back")} aria-label={t("scripts.back")}><ArrowLeft className="w-4 h-4" /></IconBtn>
        <span style={{ flex: 1, fontFamily: "var(--mono)", fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--mute-2)" }}>
          {t(`scripts.statuses.${script.status}`)}{script.reviewStatus !== "none" ? ` · ${t(`scripts.review.${script.reviewStatus}`)}` : ""}
        </span>
      </div>

      {script.reviewStatus === "changes" && script.reviewNote && (
        <p className="neu-inset" style={{ margin: 0, borderRadius: "var(--r-surface)", padding: "10px 12px", fontSize: 12.5, color: "var(--ink-soft)" }} data-testid="script-review-note">
          {t("scripts.reviewNote", { note: script.reviewNote })}
        </p>
      )}

      {script.post && (
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-soft)" }}>
          {script.status === "published" ? t("scripts.publishedOn", { when: when(script.post.scheduledAt) }) : t("scripts.scheduledFor", { when: when(script.post.scheduledAt) })}
          {script.post.permalink && <> · <a href={script.post.permalink} target="_blank" rel="noreferrer" style={{ color: "var(--wine)" }}>{t("scripts.viewOnInstagram")} <ExternalLink size={11} style={{ display: "inline" }} /></a></>}
        </p>
      )}

      <div>
        <label style={labelStyle} htmlFor="script-title">{t("scripts.titleLabel")}</label>
        <input id="script-title" className="neu-input" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} disabled={!actions.includes("edit")}
          style={{ fontSize: 13, padding: "8px 11px", width: "100%" }} data-testid="script-title" />
      </div>
      <div>
        <div className="row" style={{ gap: 8 }}>
          <label style={{ ...labelStyle, flex: 1 }} htmlFor="script-body">{t("scripts.bodyLabel")}</label>
          {body.trim() && <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--mute-2)" }}>{t("scripts.seconds", { seconds: spokenSeconds(body) })}</span>}
        </div>
        <textarea id="script-body" className="neu-input" rows={10} value={body} onChange={(e) => setBody(e.target.value)} disabled={!actions.includes("edit")}
          style={{ fontSize: 13, lineHeight: 1.55, padding: "10px 12px", width: "100%", resize: "vertical" }} data-testid="script-body" />
      </div>

      {actions.includes("edit") && (
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="la-btn la-btn--wine" disabled={!dirty || !title.trim() || busy} onClick={() => save.mutate()} data-testid="script-save">
            {save.isPending && <Loader2 size={12} className="animate-spin" />}{t("scripts.save")}
          </button>
          {actions.includes("sendForReview") && !dirty && (
            <button type="button" className="la-btn la-btn--soft" disabled={busy} onClick={() => send.mutate()} data-testid="script-send-review">
              {send.isPending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}{t("scripts.actions.sendForReview")}
            </button>
          )}
          {(script.status === "idea" || script.status === "draft") && body.trim() && !dirty && (
            <button type="button" className="la-btn la-btn--plain" disabled={approve.isPending} onClick={() => approve.mutate()}>{t("scripts.markApproved")}</button>
          )}
        </div>
      )}
      {[save.error, send.error, approve.error].map(reasonOf).filter(Boolean).slice(0, 1).map((r) => <p key="e" role="alert" style={errStyle}>{t(studioErrorKey(r))}</p>)}

      {actions.includes("draft") && (
        <div className="neu-inset" style={{ borderRadius: "var(--r-surface)", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
          <label style={labelStyle} htmlFor="script-notes">{t("scripts.draftNotes")}</label>
          <textarea id="script-notes" className="neu-input" rows={2} value={notes} maxLength={2000} onChange={(e) => setNotes(e.target.value)} placeholder={t("scripts.draftNotesPlaceholder")}
            style={{ fontSize: 12.5, padding: "8px 11px", width: "100%", resize: "vertical" }} />
          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <button type="button" className="la-btn la-btn--soft" disabled={busy || dirty} onClick={() => draft.mutate()} data-testid="script-draft">
              {draft.isPending ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}{t(script.body.trim() ? "scripts.redraft" : "scripts.actions.draft")}
            </button>
            {draft.isPending && <span role="status" style={{ fontSize: 11.5, color: "var(--mute)" }}>{t("scripts.drafting")}</span>}
            {dirty && <span style={{ fontSize: 11.5, color: "var(--mute)" }}>{t("scripts.saveFirst")}</span>}
          </div>
          {draft.error && <p role="alert" style={errStyle}>{t(studioErrorKey(reasonOf(draft.error)))}</p>}
        </div>
      )}

      {(actions.includes("pickVideo") || actions.includes("uploadVideo")) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={labelStyle}>{t("scripts.video")}</span>
          <p style={{ margin: 0, fontSize: 12.5, color: script.videoUploadId ? "var(--good)" : "var(--mute)" }}>
            {script.videoUploadId ? t(script.heygenVideoId ? "scripts.videoFromHeygen" : "scripts.videoUploaded") : t("scripts.noVideo")}
          </p>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="la-btn la-btn--soft" onClick={() => setVideoPicker((v) => !v)} data-testid="script-pick-heygen">{t("scripts.actions.pickVideo")}</button>
            <input ref={fileRef} type="file" accept="video/mp4,video/quicktime" hidden onChange={(e) => pickFile(e.target.files?.[0])} />
            <button type="button" className="la-btn la-btn--plain" disabled={uploadPct !== null} onClick={() => fileRef.current?.click()} data-testid="script-upload">
              {uploadPct !== null ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
              {uploadPct !== null ? t("scripts.uploading", { pct: uploadPct }) : t("scripts.actions.uploadVideo")}
            </button>
            {actions.includes("schedule") && !scheduling && (
              <button type="button" className="la-btn la-btn--wine" onClick={() => setScheduling(true)} data-testid="script-schedule">{t("scripts.actions.schedule")}</button>
            )}
          </div>
          {uploadErr && <p role="alert" style={errStyle}>{t(studioErrorKey(uploadErr))}</p>}
          {videoPicker && <HeygenPicker accountId={accountId} scriptId={script.id} onPulled={() => { setVideoPicker(false); refresh(); }} />}
        </div>
      )}

      {scheduling && script.videoUploadId && (
        <PostSheet
          accountId={accountId}
          timeZone={timeZone}
          script={{ id: script.id, title: script.title }}
          initialUploadId={script.videoUploadId}
          onClose={() => setScheduling(false)}
          onSaved={(created) => { if (created) link.mutate(created.id); else setScheduling(false); }}
          onConflict={refresh}
        />
      )}
      {link.error && <p role="alert" style={errStyle}>{t(studioErrorKey(reasonOf(link.error)))}</p>}
    </section>
  );
}
