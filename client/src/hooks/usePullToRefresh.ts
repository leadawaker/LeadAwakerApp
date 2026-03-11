import { useEffect, useRef, useState, useCallback } from "react";

export interface PullToRefreshOptions {
  /** Container ref to attach touch listeners to */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Callback triggered when user pulls past threshold and releases */
  onRefresh: () => Promise<void> | void;
  /** Pull distance (px) required to trigger refresh. Default: 72 */
  threshold?: number;
  /** Whether the hook is active. Default: true */
  enabled?: boolean;
}

export interface PullToRefreshState {
  /** Current pull distance (0 when not pulling) */
  pullDistance: number;
  /** Whether a refresh is in progress */
  isRefreshing: boolean;
  /** Whether the user is actively pulling */
  isPulling: boolean;
}

/**
 * usePullToRefresh — consistent pull-to-refresh gesture for mobile lists.
 *
 * Attach to a scrollable container. When the user is at the top of the
 * container and drags down, the hook tracks the pull distance and fires
 * onRefresh when the threshold is met and the finger is released.
 *
 * Uses touch events only (passive for scroll safety, non-passive only when
 * intercepting a confirmed downward pull at top-of-scroll).
 */
export function usePullToRefresh({
  containerRef,
  onRefresh,
  threshold = 72,
  enabled = true,
}: PullToRefreshOptions): PullToRefreshState {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);

  // Refs for values that closures read (avoids stale closure issues)
  const startYRef = useRef(0);
  const isDraggingRef = useRef(false);
  const isRefreshingRef = useRef(false);
  const pullDistanceRef = useRef(0);

  // Keep onRefresh stable via ref
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  const triggerRefresh = useCallback(async () => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    setIsRefreshing(true);
    pullDistanceRef.current = 0;
    setPullDistance(0);
    setIsPulling(false);
    try {
      await onRefreshRef.current();
    } finally {
      // Small delay so spinner is visible on fast refreshes
      await new Promise((r) => setTimeout(r, 400));
      isRefreshingRef.current = false;
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !enabled) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (isRefreshingRef.current) return;
      // Only start tracking if we're at the very top
      if (el.scrollTop > 0) return;
      startYRef.current = e.touches[0].clientY;
      isDraggingRef.current = true;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDraggingRef.current || isRefreshingRef.current) return;
      // If user scrolled away from top, cancel
      if (el.scrollTop > 1) {
        isDraggingRef.current = false;
        pullDistanceRef.current = 0;
        setPullDistance(0);
        setIsPulling(false);
        return;
      }
      const dy = e.touches[0].clientY - startYRef.current;
      if (dy <= 0) {
        // Dragging up — ignore
        pullDistanceRef.current = 0;
        setPullDistance(0);
        setIsPulling(false);
        return;
      }
      // Apply resistance: movement feels heavier as it extends
      const resistance = 0.45;
      const clamped = Math.min(dy * resistance, threshold * 1.5);
      pullDistanceRef.current = clamped;
      setPullDistance(clamped);
      setIsPulling(true);
      // Prevent native scroll bounce while pulling down from top
      if (dy > 4) {
        e.preventDefault();
      }
    };

    const handleTouchEnd = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      // Use ref to avoid stale closure — gets the actual current pull distance
      const dist = pullDistanceRef.current;
      pullDistanceRef.current = 0;
      setPullDistance(0);
      setIsPulling(false);
      if (dist >= threshold * 0.45) {
        triggerRefresh();
      }
    };

    const handleTouchCancel = () => {
      isDraggingRef.current = false;
      pullDistanceRef.current = 0;
      setPullDistance(0);
      setIsPulling(false);
    };

    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    el.addEventListener("touchend", handleTouchEnd, { passive: true });
    el.addEventListener("touchcancel", handleTouchCancel, { passive: true });

    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
      el.removeEventListener("touchcancel", handleTouchCancel);
    };
  }, [containerRef, enabled, threshold, triggerRefresh]);

  return { pullDistance, isRefreshing, isPulling };
}
