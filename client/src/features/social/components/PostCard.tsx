// One scheduled post: 9:16 video preview (plays inline on tap), caption excerpt, time in the
// account's zone, status, permalink once live, and the buttons the viewer's role allows
// (lib/posts.ts postActions, which mirrors the server). Reject and Cancel confirm inline.
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ExternalLink, Loader2 } from "lucide-react";
import { Pill } from "@/components/crm/primitives";
import { API_BASE } from "@/lib/apiUtils";
import {
  SocialApiError,
  approveSocialPost,
  cancelSocialPost,
  rejectSocialPost,
  retrySocialPost,
  type SocialPostView,
} from "../api/socialApi";
import { errorKey, postActions, type PostAction } from "../lib/posts";

const STATUS_COLOR: Record<SocialPostView["section"], string> = {
  needs_approval: "var(--warn)",
  upcoming: "var(--wine)",
  held: "var(--mute)",
  failed: "hsl(var(--destructive))",
  published: "var(--good)",
};

const lineStyle: React.CSSProperties = { fontSize: 12, color: "var(--mute)", lineHeight: 1.5, margin: 0 };

export function formatPostTime(iso: string, timeZone: string, locale: string): string {
  const opts = { dateStyle: "medium", timeStyle: "short" } as const;
  try {
    return new Intl.DateTimeFormat(locale, { ...opts, timeZone }).format(new Date(iso));
  } catch {
    return new Intl.DateTimeFormat(locale, opts).format(new Date(iso));
  }
}

export function PostCard({ post, accountId, timeZone, who, onChanged, onEdit }: {
  post: SocialPostView;
  accountId: number;
  timeZone: string;
  who: { isAgency: boolean; userRole: string };
  onChanged: () => void;
  onEdit: (post: SocialPostView, focus: "all" | "time") => void;
}) {
  const { t, i18n } = useTranslation("accounts");
  const [confirm, setConfirm] = useState<"reject" | "cancel" | null>(null);
  const [note, setNote] = useState("");
  const actions = postActions(post, who);

  const act = useMutation({
    mutationFn: async (a: PostAction) => {
      if (a === "approve") return approveSocialPost(accountId, post);
      if (a === "reject") return rejectSocialPost(accountId, post, note.trim());
      if (a === "retry") return retrySocialPost(accountId, post.id);
      if (a === "cancel") return cancelSocialPost(accountId, post.id);
    },
    onSuccess: () => { setConfirm(null); setNote(""); },
    onSettled: onChanged,
  });
  const errorReason = act.error instanceof SocialApiError ? act.error.reason : act.error ? "failed" : null;

  const label = (a: PostAction) => t(`social.posts.actions.${a}`);
  const button = (a: PostAction, primary = false) => (
    <button
      key={a}
      type="button"
      className={`la-btn ${primary ? "la-btn--wine" : "la-btn--soft"}`}
      disabled={act.isPending}
      data-testid={`post-${post.id}-${a}`}
      onClick={() => {
        if (a === "edit" || a === "reschedule") onEdit(post, a === "reschedule" ? "time" : "all");
        else if (a === "reject" || a === "cancel") setConfirm(a);
        else act.mutate(a);
      }}
    >
      {act.isPending && act.variables === a && <Loader2 size={12} className="animate-spin" />}
      {label(a)}
    </button>
  );

  return (
    <article className="neu-raised" style={{ borderRadius: "var(--r-card)", background: "var(--bone)", padding: 14, display: "flex", gap: 14 }} data-testid={`post-${post.id}`}>
      {post.videoUrl ? (
        <video
          src={`${API_BASE}${post.videoUrl}`}
          preload="metadata"
          controls
          playsInline
          aria-label={t("social.posts.previewLabel")}
          style={{ width: 96, aspectRatio: "9 / 16", objectFit: "cover", borderRadius: "var(--r-surface)", background: "var(--bg)", flexShrink: 0 }}
        />
      ) : (
        <div style={{ width: 96, aspectRatio: "9 / 16", borderRadius: "var(--r-surface)", background: "var(--bg)", flexShrink: 0 }} />
      )}

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <Pill color={STATUS_COLOR[post.section]}>{t(`social.posts.badge.${post.status === "publishing" ? "publishing" : post.section}`)}</Pill>
          <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--mute)" }}>
            {formatPostTime(post.scheduledAt, timeZone, i18n.language)}
          </span>
        </div>

        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden", whiteSpace: "pre-line" }}>
          {post.caption || <span style={{ color: "var(--mute-2)", fontStyle: "italic" }}>{t("social.posts.noCaption")}</span>}
        </p>

        {post.approvedByName && <p style={lineStyle}>{t("social.posts.approvedBy", { name: post.approvedByName })}</p>}
        {post.waivedByName && <p style={lineStyle}>{t("social.posts.waivedBy", { name: post.waivedByName })}</p>}
        {post.approvalStatus === "rejected" && (
          <p style={{ ...lineStyle, color: "var(--ink-soft)" }}>
            {post.approvalNote ? t("social.posts.rejectedNote", { note: post.approvalNote }) : t("social.posts.rejectedNoNote")}
          </p>
        )}
        {post.section === "held" && <p style={lineStyle}>{t("social.posts.heldHelp")}</p>}
        {post.status === "failed" && post.lastError && (
          <p style={{ ...lineStyle, color: "hsl(var(--destructive))" }}>{t("social.posts.failedReason", { reason: post.lastError })}</p>
        )}
        {post.permalink && (
          <a href={post.permalink} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, color: "var(--wine)", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <ExternalLink size={12} />{t("social.posts.viewOnInstagram")}
          </a>
        )}

        {actions.length > 0 && !confirm && (
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            {actions.map((a) => button(a, a === "approve"))}
          </div>
        )}

        {confirm && (
          <div className="neu-inset" style={{ borderRadius: "var(--r-surface)", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
            {confirm === "reject" ? (
              <>
                <label style={{ ...lineStyle, color: "var(--ink-soft)" }} htmlFor={`reject-note-${post.id}`}>{t("social.posts.rejectNoteLabel")}</label>
                <textarea
                  id={`reject-note-${post.id}`}
                  className="neu-input"
                  rows={3}
                  maxLength={1000}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t("social.posts.rejectNotePlaceholder")}
                  style={{ fontSize: 12.5, padding: "8px 11px", width: "100%", resize: "vertical" }}
                />
              </>
            ) : (
              <p style={{ ...lineStyle, color: "var(--ink-soft)" }}>{t("social.posts.cancelConfirm")}</p>
            )}
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <button type="button" className="la-btn la-btn--wine" disabled={act.isPending} onClick={() => act.mutate(confirm)} data-testid={`post-${post.id}-${confirm}-confirm`}>
                {act.isPending && <Loader2 size={12} className="animate-spin" />}
                {t(confirm === "reject" ? "social.posts.rejectYes" : "social.posts.cancelYes")}
              </button>
              <button type="button" className="la-btn la-btn--plain" disabled={act.isPending} onClick={() => { setConfirm(null); act.reset(); }}>
                {t("social.posts.back")}
              </button>
            </div>
          </div>
        )}

        {errorReason && <p style={{ ...lineStyle, color: "hsl(var(--destructive))" }} role="alert">{t(errorKey(errorReason))}</p>}
      </div>
    </article>
  );
}
