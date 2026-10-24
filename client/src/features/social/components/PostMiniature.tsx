// A post at a glance: a small frame of its video and its number (#id, the same one the post card
// shows). Used where a post has to be picked or named without its caption, e.g. the cover menu.
import { API_BASE } from "@/lib/apiUtils";
import type { SocialPostView } from "../api/socialApi";

export function PostMiniature({ post, width = 26 }: { post: Pick<SocialPostView, "id" | "videoUrl">; width?: number }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
      {post.videoUrl ? (
        // #t=0.1 makes browsers that skip the first frame (Safari) still show one.
        <video src={`${API_BASE}${post.videoUrl}#t=0.1`} preload="metadata" muted playsInline aria-hidden="true" tabIndex={-1}
          style={{ display: "block", width, aspectRatio: "9 / 16", objectFit: "cover", borderRadius: 4, background: "var(--bg)", pointerEvents: "none" }} />
      ) : (
        <span style={{ display: "block", width, aspectRatio: "9 / 16", borderRadius: 4, background: "var(--bg)" }} />
      )}
      <span style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, color: "var(--ink-soft)" }}>#{post.id}</span>
    </span>
  );
}
