// New post / edit post, shown inline at the top of the Social tab (UI_STANDARDS 9.2.11: no
// dialog for forms). Video upload with progress and preview, caption with a live counter and
// Meta's limits, date and time in the account's zone (sent as strings, the server converts),
// three toggles, and the caption writer (CaptionWriter). Agency only; the server checks again.
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Film, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { API_BASE } from "@/lib/apiUtils";
import { IG_CAPTION_MAX, validateCaption } from "@shared/socialPosts";
import { SocialApiError, createSocialPost, updateSocialPost, uploadSocialVideo, type SocialPostView } from "../api/socialApi";
import { editBody, errorKey, toLocalDateTime, uploadPrecheck, type PostForm } from "../lib/posts";
import { CaptionWriter } from "./CaptionWriter";
import { CoverPicker } from "./CoverPicker";
import { VideoPreview } from "./VideoLightbox";

const labelStyle: React.CSSProperties = { fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--mute-2)", marginBottom: 5, display: "block" };
const inputStyle: React.CSSProperties = { fontSize: 12.5, padding: "8px 11px", width: "100%" };

/** The upload id is the public id in the post's video path (/media/social/<id>.<ext>). */
function uploadIdOf(videoUrl: string): string {
  return /\/media\/social\/([0-9a-f-]{36})\.\w+$/.exec(videoUrl)?.[1] ?? "";
}

function blankForm(): PostForm {
  return { uploadId: "", caption: "", date: "", time: "", shareToFeed: true, isAiGenerated: true, requiresApproval: true, coverThumbnailId: null };
}

function formFor(post: SocialPostView, timeZone: string): PostForm {
  const { date, time } = toLocalDateTime(post.scheduledAt, timeZone);
  return {
    uploadId: uploadIdOf(post.videoUrl), caption: post.caption, date, time,
    shareToFeed: post.shareToFeed, isAiGenerated: post.isAiGenerated, requiresApproval: post.requiresApproval, coverThumbnailId: post.coverThumbnailId,
  };
}

export function PostSheet({ accountId, timeZone, post, focus = "all", script, initialUploadId, onClose, onSaved, onConflict }: {
  accountId: number;
  timeZone: string;
  /** Absent for a new post. */
  post?: SocialPostView;
  /** "time": a held post being rescheduled; only the time fields are shown. */
  focus?: "all" | "time";
  /** The studio script this post is (or will be) made from: the caption writer reads it. */
  script?: { id: number; title: string };
  /** A new post from a script whose video is already uploaded or pulled from HeyGen. */
  initialUploadId?: string;
  onClose: () => void;
  /** The saved post (the server's answer) for a new post; nothing for an edit. */
  onSaved: (created?: SocialPostView) => void;
  /** A 409: someone (or the publisher) got there first. The list refreshes, the panel stays with the message. */
  onConflict: () => void;
}) {
  const { t } = useTranslation("accounts");
  const original = useMemo(() => (post ? formFor(post, timeZone) : { ...blankForm(), uploadId: initialUploadId ?? "" }), [post, timeZone, initialUploadId]);
  const [form, setForm] = useState<PostForm>(original);
  const [previewUrl, setPreviewUrl] = useState<string>(post?.videoUrl ? `${API_BASE}${post.videoUrl}` : "");
  const [coverPreview, setCoverPreview] = useState<string | null>(post?.coverUrl ?? null);
  const [progress, setProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const objectUrl = useRef<string | null>(null);
  const uploadAbort = useRef<AbortController | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  useEffect(() => () => {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    uploadAbort.current?.abort();
  }, []);
  // Opened from a card lower down (Edit, Pick a new time): bring the panel into view, on a phone above all.
  useEffect(() => { sectionRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }); }, []);
  const today = toLocalDateTime(new Date().toISOString(), timeZone).date;
  const set = <K extends keyof PostForm>(k: K, v: PostForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  const caption = validateCaption(form.caption);
  const captionLength = [...form.caption].length;
  const uploading = progress !== null;
  const timeOnly = focus === "time";

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    setUploadError(null);
    const bad = uploadPrecheck(file);
    if (bad) { setUploadError(bad); return; }
    setProgress(0);
    try {
      uploadAbort.current = new AbortController();
      const up = await uploadSocialVideo(accountId, file, setProgress, uploadAbort.current.signal);
      set("uploadId", up.uploadId);
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
      objectUrl.current = URL.createObjectURL(file);
      setPreviewUrl(objectUrl.current);
    } catch (err) {
      setUploadError(err instanceof SocialApiError ? err.reason : "failed");
    } finally {
      setProgress(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const save = useMutation({
    mutationFn: async (): Promise<SocialPostView | undefined> => {
      if (!post) return createSocialPost(accountId, form);
      const body = editBody(original, form);
      if (Object.keys(body).length > 0) await updateSocialPost(accountId, post.id, body);
      return undefined;
    },
    onSuccess: (created) => onSaved(created),
    onError: (err) => {
      if (err instanceof SocialApiError && err.status === 409) onConflict();
    },
  });
  const saveError = save.error instanceof SocialApiError ? save.error.reason : save.error ? "failed" : null;
  const changed = !post || Object.keys(editBody(original, form)).length > 0;
  const canSave = changed && !uploading && !save.isPending && caption.ok && !!form.uploadId && !!form.date && !!form.time;

  return (
    <section ref={sectionRef} className="neu-raised" style={{ borderRadius: "var(--r-card)", background: "var(--bone)", padding: "20px 22px", display: "flex", flexDirection: "column", gap: 16, scrollMarginTop: 96 }} data-testid="social-post-sheet">
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>
        {t(post ? (timeOnly ? "social.posts.sheet.rescheduleTitle" : "social.posts.sheet.editTitle") : "social.posts.sheet.newTitle")}
      </h3>

      {!timeOnly && (
        <div>
          <span style={labelStyle}>{t("social.posts.sheet.video")}</span>
          <div className="row" style={{ gap: 14, alignItems: "flex-start" }}>
            {previewUrl ? (
              <VideoPreview src={previewUrl} title={form.caption.trim().slice(0, 60) || t("social.posts.sheet.video")} testId="social-sheet-enlarge" />
            ) : (
              <div className="neu-inset-crisp" style={{ width: 96, aspectRatio: "9 / 16", borderRadius: "var(--r-surface)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "var(--mute-2)" }}>
                <Film size={16} />
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              <input ref={fileRef} type="file" accept="video/mp4,video/quicktime" hidden onChange={(e) => pickFile(e.target.files?.[0])} data-testid="social-video-input" />
              <div>
                <button type="button" className="la-btn la-btn--soft" disabled={uploading} onClick={() => fileRef.current?.click()}>
                  {uploading && <Loader2 size={12} className="animate-spin" />}
                  {t(form.uploadId ? "social.posts.sheet.replaceVideo" : "social.posts.sheet.chooseVideo")}
                </button>
              </div>
              <p style={{ margin: 0, fontSize: 11.5, color: "var(--mute)", lineHeight: 1.5 }}>{t("social.posts.sheet.videoHelp")}</p>
              {form.uploadId && !previewUrl && (
                <p style={{ margin: 0, fontSize: 12, color: "var(--ink-soft)", fontWeight: 600 }} data-testid="social-studio-video">{t("social.posts.sheet.studioVideo")}</p>
              )}
              {uploading && (
                <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress ?? 0} aria-label={t("social.posts.sheet.uploading")}
                  className="neu-inset-crisp" style={{ height: 8, boxShadow: "var(--sh-inset-super-crisp)", borderRadius: "var(--r-pill)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${progress}%`, background: "var(--wine)", transition: "width 150ms ease" }} />
                </div>
              )}
              {uploadError && <p role="alert" style={{ margin: 0, fontSize: 12, color: "hsl(var(--destructive))" }}>{t(errorKey(uploadError))}</p>}
            </div>
          </div>
        </div>
      )}

      {!timeOnly && (
        <CoverPicker accountId={accountId} value={form.coverThumbnailId} previewUrl={coverPreview}
          onChange={(id, url) => { set("coverThumbnailId", id); setCoverPreview(url); }} />
      )}

      {!timeOnly && (
        <div>
          <label style={labelStyle} htmlFor="social-caption">{t("social.posts.sheet.caption")}</label>
          <textarea id="social-caption" className="neu-input" rows={5} value={form.caption} onChange={(e) => set("caption", e.target.value)}
            style={{ ...inputStyle, resize: "vertical" }} data-testid="social-caption" />
          <div className="row" style={{ gap: 8, marginTop: 4 }}>
            <span style={{ flex: 1, fontSize: 11.5, color: "hsl(var(--destructive))" }} role={caption.ok ? undefined : "alert"}>
              {caption.ok ? "" : t(errorKey(caption.reason))}
            </span>
            <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: captionLength > IG_CAPTION_MAX ? "hsl(var(--destructive))" : "var(--mute)" }}>
              {captionLength} / {IG_CAPTION_MAX}
            </span>
          </div>
          <div style={{ marginTop: 8 }}>
            <CaptionWriter accountId={accountId} scriptId={script?.id} scriptTitle={script?.title} onPick={(c) => set("caption", c)} />
          </div>
        </div>
      )}

      <div>
        <span style={labelStyle}>{t("social.posts.sheet.when", { zone: timeZone })}</span>
        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <input type="date" className="neu-input" aria-label={t("social.posts.sheet.date")} value={form.date} min={today} onChange={(e) => set("date", e.target.value)} style={{ ...inputStyle, width: 170 }} data-testid="social-date" />
          <input type="time" className="neu-input" aria-label={t("social.posts.sheet.time")} value={form.time} onChange={(e) => set("time", e.target.value)} style={{ ...inputStyle, width: 120 }} data-testid="social-time" />
        </div>
      </div>

      {!timeOnly && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {(["shareToFeed", "isAiGenerated", "requiresApproval"] as const).map((k) => (
            <label key={k} className="row" style={{ gap: 12, cursor: "pointer" }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--ink-soft)" }}>{t(`social.posts.sheet.${k}`)}</span>
                <span style={{ display: "block", fontSize: 11.5, color: "var(--mute)" }}>{t(`social.posts.sheet.${k}Help`)}</span>
              </span>
              <Switch checked={form[k]} onCheckedChange={(v) => set(k, v)} data-testid={`social-${k}`} />
            </label>
          ))}
        </div>
      )}

      {saveError && <p role="alert" style={{ margin: 0, fontSize: 12, color: "hsl(var(--destructive))" }}>{t(errorKey(saveError))}</p>}

      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="la-btn la-btn--wine" disabled={!canSave} onClick={() => save.mutate()} data-testid="social-save">
          {save.isPending && <Loader2 size={12} className="animate-spin" />}
          {t(post ? "social.posts.sheet.save" : "social.posts.sheet.schedule")}
        </button>
        <button type="button" className="la-btn la-btn--plain" disabled={save.isPending} onClick={onClose}>{t("social.posts.sheet.cancel")}</button>
      </div>
    </section>
  );
}
