import { useEffect, useRef, useCallback } from "react";

/**
 * Options for the useSwipeGesture hook.
 */
export interface SwipeGestureOptions {
  /** Called when user swipes left (right-to-left). */
  onSwipeLeft?: () => void;
  /** Called when user swipes right (left-to-right). */
  onSwipeRight?: () => void;
  /**
   * Minimum horizontal distance (px) required to trigger a swipe.
   * Defaults to 50px.
   */
  threshold?: number;
  /**
   * Minimum swipe velocity (px/ms) required to trigger a swipe.
   * Defaults to 0.15. Swipes that are slow AND short won't fire.
   */
  minVelocity?: number;
  /**
   * Whether the hook is currently enabled.
   * Defaults to true.
   */
  enabled?: boolean;
}

/**
 * Reusable swipe gesture detection hook for touch screens.
 *
 * Usage:
 *   const ref = useSwipeGesture({ onSwipeLeft: () => goNext(), onSwipeRight: () => goPrev() });
 *   return <div ref={ref}>...</div>;
 *
 * Features:
 * - Touch-only (touchstart/touchmove/touchend)
 * - Vertical scrolling is preserved: if vertical delta > horizontal delta the swipe is ignored
 * - Both distance threshold and velocity check: a swipe fires if it meets EITHER
 *   the minimum threshold OR the minimum velocity (but must always exceed 20px hard min)
 * - Works on any scrollable container without blocking vertical scroll
 */
export function useSwipeGesture<T extends HTMLElement = HTMLElement>(
  options: SwipeGestureOptions
): React.RefObject<T | null> {
  const ref = useRef<T>(null);

  const {
    onSwipeLeft,
    onSwipeRight,
    threshold = 50,
    minVelocity = 0.15,
    enabled = true,
  } = options;

  // Keep handlers in refs to avoid re-attaching listeners on every render
  const onSwipeLeftRef  = useRef(onSwipeLeft);
  const onSwipeRightRef = useRef(onSwipeRight);
  onSwipeLeftRef.current  = onSwipeLeft;
  onSwipeRightRef.current = onSwipeRight;

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;

    let startX    = 0;
    let startY    = 0;
    let startTime = 0;
    // Whether this touch sequence is a horizontal drag (not a vertical scroll)
    let isHorizontal: boolean | null = null;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.changedTouches[0];
      startX       = touch.clientX;
      startY       = touch.clientY;
      startTime    = Date.now();
      isHorizontal = null; // undecided until first move
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (isHorizontal === false) return; // already decided: it's a scroll

      const touch = e.changedTouches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;

      // Need at least 8px of movement to decide direction
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;

      if (isHorizontal === null) {
        // First significant movement — decide direction
        isHorizontal = Math.abs(dx) > Math.abs(dy);
      }

      // If horizontal drag: prevent default scroll so the swipe isn't consumed by
      // the browser's scroll machinery. This is intentional and safe because we only
      // do this when horizontal motion clearly dominates.
      if (isHorizontal) {
        e.preventDefault();
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      // Only act on intentional horizontal swipes
      if (!isHorizontal) return;

      const touch   = e.changedTouches[0];
      const dx      = touch.clientX - startX;
      const dy      = touch.clientY - startY;
      const elapsed = Math.max(1, Date.now() - startTime); // avoid division by zero
      const velocity = Math.abs(dx) / elapsed;

      // Hard minimum — ignore tiny twitches
      if (Math.abs(dx) < 20) return;

      // Ignore if vertical delta exceeds horizontal delta (residual scroll gesture)
      if (Math.abs(dy) > Math.abs(dx)) return;

      // Gate: must exceed threshold OR minimum velocity (but not both required)
      const meetsDistance = Math.abs(dx) >= threshold;
      const meetsVelocity = velocity >= minVelocity;
      if (!meetsDistance && !meetsVelocity) return;

      if (dx < 0) {
        onSwipeLeftRef.current?.();
      } else {
        onSwipeRightRef.current?.();
      }

      isHorizontal = null;
    };

    el.addEventListener("touchstart",  handleTouchStart, { passive: true  });
    el.addEventListener("touchmove",   handleTouchMove,  { passive: false }); // passive: false needed for preventDefault
    el.addEventListener("touchend",    handleTouchEnd,   { passive: true  });
    el.addEventListener("touchcancel", handleTouchEnd,   { passive: true  });

    return () => {
      el.removeEventListener("touchstart",  handleTouchStart);
      el.removeEventListener("touchmove",   handleTouchMove);
      el.removeEventListener("touchend",    handleTouchEnd);
      el.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [enabled, threshold, minVelocity]);

  return ref;
}
