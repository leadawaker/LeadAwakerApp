// Infinite-scroll trigger: sits after the last loaded row and asks for the next
// page when it comes within 600px of the scroll container's bottom.
import { useEffect, useRef, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";

export function LoadMoreSentinel({
  rootRef,
  hasMore,
  loading,
  onLoadMore,
  compact = false,
  asTableRow,
}: {
  rootRef: RefObject<HTMLElement | null>;
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
  compact?: boolean;
  /** Render as a <tr> spanning this many columns (inside a table body). */
  asTableRow?: number;
}) {
  const { t } = useTranslation("leads");
  const ref = useRef<HTMLElement | null>(null);
  const cb = useRef(onLoadMore);
  cb.current = onLoadMore;

  useEffect(() => {
    const el = ref.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver(
      (entries) => { if (entries.some((e) => e.isIntersecting)) cb.current(); },
      { root: rootRef.current, rootMargin: "0px 0px 600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, rootRef, loading]);

  if (!hasMore && !loading) return null;
  const body = (
    <span
      className="inline-flex items-center justify-center gap-1.5"
      style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mute-2)" }}
    >
      <Loader2 className="h-3 w-3 animate-spin" />
      {!compact && t("list.loadingMore")}
    </span>
  );
  if (asTableRow) {
    return (
      <tr ref={(n) => { ref.current = n; }} data-testid="leads-load-more">
        <td colSpan={asTableRow} style={{ padding: "14px 0", textAlign: "center" }}>{body}</td>
      </tr>
    );
  }
  return (
    <div ref={(n) => { ref.current = n; }} data-testid="leads-load-more" className="flex justify-center" style={{ padding: compact ? "6px 0" : "14px 0 18px" }}>
      {body}
    </div>
  );
}
