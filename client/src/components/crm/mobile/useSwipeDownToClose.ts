import { useEffect, useRef, type RefObject } from "react";
import { animate, type MotionValue } from "framer-motion";

/**
 * Pull-down-to-close for phone sheets and full-screen panels (shared by MobileSheet).
 *
 * Forgiving by design:
 * - Starts anywhere on the panel: the header, the handle, or the body while its
 *   scroll area sits at the top. If any scroll area under the finger is scrolled
 *   down, the gesture is left to the scroll.
 * - Diagonal is fine: it counts as a pull when the vertical move is at least
 *   `axisRatio` times the horizontal move (0.7 = up to about 55 degrees off vertical).
 * - Closes past `min(distance, 25% of the panel height)`, or on a quick flick.
 * - Ignores range inputs, text areas, editable text and anything marked
 *   `data-no-sheet-drag` (sliders, signature pads, carousels).
 */
export interface SwipeDownOptions {
  onClose: () => void;
  /** The motion value the panel's `y` is bound to. */
  y: MotionValue<number>;
  enabled?: boolean;
  /** Close distance in px (also capped at 25% of the panel height). Default 80. */
  distance?: number;
  /** Flick speed in px/ms that closes regardless of distance. Default 0.5. */
  flickVelocity?: number;
  /** Vertical must be at least this times the horizontal move. Default 0.7. */
  axisRatio?: number;
}

const DECIDE_PX = 8;
const SKIP_SELECTOR = 'input[type="range"], textarea, [contenteditable="true"], [data-no-sheet-drag]';

/** True when any scroll area between the touch and the panel is scrolled away from the top. */
function scrolledAboveTop(target: EventTarget | null, panel: HTMLElement): boolean {
  let el = target instanceof Element ? target : null;
  while (el) {
    if (el instanceof HTMLElement && el.scrollTop > 0) {
      const oy = getComputedStyle(el).overflowY;
      if (oy === "auto" || oy === "scroll") return true;
    }
    if (el === panel) break;
    el = el.parentElement;
  }
  return false;
}

export function useSwipeDownToClose<T extends HTMLElement>(
  panelRef: RefObject<T | null>,
  { onClose, y, enabled = true, distance = 80, flickVelocity = 0.5, axisRatio = 0.7 }: SwipeDownOptions,
) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel || !enabled) return;

    let tracking = false;
    let decided: "pull" | "skip" | null = null;
    let startX = 0;
    let startY = 0;
    // Recent samples for the release velocity.
    let samples: { y: number; t: number }[] = [];

    const onStart = (e: TouchEvent) => {
      decided = null;
      tracking = false;
      if (e.touches.length !== 1) return;
      const target = e.target as Element | null;
      if (target?.closest?.(SKIP_SELECTOR)) return;
      if (scrolledAboveTop(target, panel)) return;
      const tch = e.touches[0];
      startX = tch.clientX;
      startY = tch.clientY;
      samples = [{ y: tch.clientY, t: e.timeStamp }];
      tracking = true;
    };

    const onMove = (e: TouchEvent) => {
      if (!tracking || decided === "skip") return;
      const tch = e.touches[0];
      const dx = tch.clientX - startX;
      const dy = tch.clientY - startY;
      if (decided === null) {
        if (Math.abs(dx) < DECIDE_PX && Math.abs(dy) < DECIDE_PX) {
          // Hold the browser's overscroll while a downward pull is still forming
          // (iOS stops letting us cancel once its own scroll has started).
          if (dy > 0 && dy >= Math.abs(dx) * axisRatio && e.cancelable) e.preventDefault();
          return;
        }
        decided = dy > 0 && dy >= Math.abs(dx) * axisRatio ? "pull" : "skip";
        if (decided === "skip") { tracking = false; return; }
      }
      if (e.cancelable) e.preventDefault();
      y.set(Math.max(0, dy));
      samples.push({ y: tch.clientY, t: e.timeStamp });
      if (samples.length > 6) samples.shift();
    };

    const onEnd = (e: TouchEvent) => {
      if (!tracking || decided !== "pull") { tracking = false; decided = null; return; }
      tracking = false;
      decided = null;
      const endY = e.changedTouches[0]?.clientY ?? startY;
      const dy = endY - startY;
      const first = samples[0];
      const last = samples[samples.length - 1];
      const dt = Math.max(1, (last?.t ?? 0) - (first?.t ?? 0));
      const velocity = first && last ? (last.y - first.y) / dt : 0;
      const limit = Math.min(distance, panel.offsetHeight * 0.25);
      if (dy > limit || (velocity > flickVelocity && dy > 20)) {
        closeRef.current();
      } else {
        animate(y, 0, { type: "spring", stiffness: 500, damping: 40 });
      }
    };

    panel.addEventListener("touchstart", onStart, { passive: true });
    panel.addEventListener("touchmove", onMove, { passive: false });
    panel.addEventListener("touchend", onEnd, { passive: true });
    panel.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      panel.removeEventListener("touchstart", onStart);
      panel.removeEventListener("touchmove", onMove);
      panel.removeEventListener("touchend", onEnd);
      panel.removeEventListener("touchcancel", onEnd);
    };
  }, [panelRef, y, enabled, distance, flickVelocity, axisRatio]);
}
