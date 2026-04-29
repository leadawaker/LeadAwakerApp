import { useCallback, useRef, useState } from "react";
import { COMPACT_ACTIVATE_BELOW, COMPACT_DEACTIVATE_ABOVE } from "./constants";

interface Options {
  /** Pixel width below which compact mode activates. */
  activateBelow?: number;
  /** Pixel width above which compact mode deactivates (must be > activateBelow to absorb panel-swing hysteresis). */
  deactivateAbove?: number;
}

/**
 * Watches an element's width and toggles a boolean with hysteresis.
 * Uses a callback ref so it works with conditionally-rendered elements.
 * Activates when width < activateBelow, deactivates when width > deactivateAbove.
 */
export function useCompactPanelState(disabled = false, opts: Options = {}) {
  const activateBelow = opts.activateBelow ?? COMPACT_ACTIVATE_BELOW;
  const deactivateAbove = opts.deactivateAbove ?? COMPACT_DEACTIVATE_ABOVE;
  const [narrow, setNarrow] = useState(false);
  const roRef = useRef<ResizeObserver | null>(null);

  const ref = useCallback((el: HTMLDivElement | null) => {
    roRef.current?.disconnect();
    roRef.current = null;
    if (!el || disabled) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setNarrow((prev) => (prev ? w < deactivateAbove : w < activateBelow));
    });
    ro.observe(el);
    roRef.current = ro;
  }, [disabled, activateBelow, deactivateAbove]);

  return { ref, narrow };
}
