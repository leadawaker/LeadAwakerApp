/**
 * PullToRefreshIndicator — consistent pull-to-refresh visual across all mobile lists.
 *
 * Shows a circular spinner that:
 * - Appears as the user pulls down (opacity + scale follow pullDistance)
 * - Rotates while refreshing (CSS @keyframes spin via transform, no transition-all)
 * - Fades out on completion
 *
 * Uses CSS @keyframes with transform only (not transition-all) per spec.
 */

/** Inject keyframes once — only runs in browser */
const STYLE_ID = "ptr-keyframes";
function injectKeyframes() {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes ptr-spin {
      from { transform: rotate(0deg); }
      to   { transform: rotate(360deg); }
    }
    @keyframes ptr-fadein {
      from { opacity: 0; transform: scale(0.7); }
      to   { opacity: 1; transform: scale(1); }
    }
  `;
  document.head.appendChild(style);
}
injectKeyframes();

interface PullToRefreshIndicatorProps {
  pullDistance: number;
  isRefreshing: boolean;
  /** Distance at which spinner is fully visible (default: 56) */
  threshold?: number;
}

export function PullToRefreshIndicator({
  pullDistance,
  isRefreshing,
  threshold = 56,
}: PullToRefreshIndicatorProps) {
  const visible = isRefreshing || pullDistance > 4;
  if (!visible) return null;

  // Progress 0–1 based on pull distance
  const progress = Math.min(pullDistance / threshold, 1);
  const opacity = isRefreshing ? 1 : Math.min(progress * 1.5, 1);
  const scale = isRefreshing ? 1 : 0.6 + progress * 0.4;

  // Height the indicator occupies (pushes list content down)
  const indicatorHeight = isRefreshing ? 48 : Math.min(pullDistance, 48);

  return (
    <div
      aria-live="polite"
      aria-label={isRefreshing ? "Refreshing…" : "Pull to refresh"}
      style={{
        height: indicatorHeight,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        transition: isRefreshing ? "height 200ms ease" : "none",
        willChange: "height",
      }}
    >
      {/* Spinner ring */}
      <span
        style={{
          display: "block",
          width: 24,
          height: 24,
          borderRadius: "50%",
          border: "2.5px solid hsl(var(--border))",
          borderTopColor: "hsl(var(--brand-indigo, 238 84% 62%))",
          opacity,
          transform: `scale(${scale})`,
          animation: isRefreshing
            ? "ptr-spin 700ms linear infinite"
            : undefined,
          transition: isRefreshing
            ? "opacity 150ms ease"
            : "opacity 150ms ease, transform 100ms ease",
          willChange: "transform",
        }}
      />
    </div>
  );
}
