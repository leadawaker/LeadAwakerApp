// "Use as cover" on a finished thumbnail: pick which scheduled Reel it becomes the cover of, or take
// it off again. The same link can be made from the post's own form (components/CoverPicker.tsx).
// Agency only (the server checks again); other roles just see which post a thumbnail covers.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Check, ImageUp, Loader2 } from "lucide-react";
import { fetchSocialPosts, SocialApiError, socialPostsKey, updateSocialPost, type SocialPostView } from "../../api/socialApi";
import type { ThumbnailView } from "../../api/thumbnailsApi";
import { errorKey } from "../../lib/posts";

const iconBtn: React.CSSProperties = { padding: "4px 7px", minHeight: 28, fontSize: 11 };

/** Only scheduled and held posts can still change; the server refuses the rest. */
const canTakeCover = (p: SocialPostView) => p.status === "scheduled" || p.status === "held";

function postLabel(p: SocialPostView, fallback: string): string {
  const text = p.caption.replace(/\s+/g, " ").trim();
  return text ? (text.length > 36 ? `${text.slice(0, 36)}…` : text) : fallback;
}

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function CoverLink({ accountId, thumb, canLink }: { accountId: number; thumb: ThumbnailView; canLink: boolean }) {
  const { t } = useTranslation("social");
  const { t: tAccounts } = useTranslation("accounts");
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const posts = useQuery({ queryKey: socialPostsKey(accountId), queryFn: () => fetchSocialPosts(accountId), staleTime: 30_000 });
  const fallback = (p: SocialPostView) => t("thumbnails.cover.reel", { id: p.id });

  const covered = (posts.data ?? []).filter((p) => p.coverThumbnailId === thumb.id);
  // The post this thumbnail was made for comes first, then the soonest to go out.
  const choices = (posts.data ?? [])
    .filter(canTakeCover)
    .sort((a, b) => Number(b.id === thumb.postId) - Number(a.id === thumb.postId) || Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt));

  const link = useMutation({
    mutationFn: (p: SocialPostView) => updateSocialPost(accountId, p.id, { coverThumbnailId: p.coverThumbnailId === thumb.id ? null : thumb.id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: socialPostsKey(accountId) }),
  });
  const error = link.error instanceof SocialApiError ? link.error.reason : link.error ? "failed" : null;

  if (thumb.status !== "ready") return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {covered.map((p) => (
        <p key={p.id} style={{ margin: 0, fontSize: 10.5, color: "var(--wine)", fontWeight: 600, overflowWrap: "anywhere" }} data-testid={`thumb-cover-of-${thumb.id}`}>
          {t("thumbnails.cover.coverOf", { post: postLabel(p, fallback(p)) })}
        </p>
      ))}
      {canLink && (
        <button type="button" className="la-btn la-btn--soft" style={{ ...iconBtn, alignSelf: "flex-start" }} aria-expanded={open}
          onClick={() => setOpen((o) => !o)} data-testid={`thumb-cover-open-${thumb.id}`}>
          <ImageUp size={12} />{t("thumbnails.cover.use")}
        </button>
      )}
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {posts.isLoading && <Loader2 size={14} className="animate-spin" />}
          {posts.isSuccess && choices.length === 0 && <p style={{ margin: 0, fontSize: 11, color: "var(--mute)" }}>{t("thumbnails.cover.noPosts")}</p>}
          {choices.map((p) => {
            const on = p.coverThumbnailId === thumb.id;
            return (
              <button key={p.id} type="button" className="la-btn la-btn--plain" disabled={link.isPending} onClick={() => link.mutate(p)}
                style={{ ...iconBtn, justifyContent: "flex-start", textAlign: "left", height: "auto", whiteSpace: "normal", gap: 6, alignItems: "flex-start" }}
                aria-pressed={on} data-testid={`thumb-cover-post-${thumb.id}-${p.id}`}>
                {on ? <Check size={12} style={{ flexShrink: 0, marginTop: 2, color: "var(--wine)" }} /> : <span style={{ width: 12, flexShrink: 0 }} />}
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontWeight: 600, color: "var(--ink-soft)", overflowWrap: "anywhere" }}>{postLabel(p, fallback(p))}</span>
                  <span style={{ display: "block", color: "var(--mute)" }}>{when(p.scheduledAt)}{p.id === thumb.postId ? ` · ${t("thumbnails.cover.madeFor")}` : ""}</span>
                </span>
              </button>
            );
          })}
          {choices.length > 0 && <p style={{ margin: 0, fontSize: 10.5, color: "var(--mute)" }}>{t("thumbnails.cover.approvalNote")}</p>}
          {error && <p role="alert" style={{ margin: 0, fontSize: 11, color: "hsl(var(--destructive))" }}>{tAccounts(errorKey(error))}</p>}
        </div>
      )}
    </div>
  );
}
