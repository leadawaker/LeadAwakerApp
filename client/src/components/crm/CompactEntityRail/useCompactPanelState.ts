import { useEffect, useRef, useState } from "react";
import { COMPACT_ACTIVATE_BELOW, COMPACT_DEACTIVATE_ABOVE } from "./constants";

interface Options {
  /** Pixel width below which compact mode activates. */
  activateBelow?: number;
  /** Pixel width above which compact mode deactivates (must be > activateBelow to absorb panel-swing hysteresis). */
  deactivateAbove?: number;
}

/**
 * Watches an element's width and toggles a boolean with hysteresis.
 * Activates when width < activateBelow, deactivates when width > deactivateAbove.
 * The gap absorbs the panel swing that would otherwise cause oscillation.
 */
export function useCompactPanelState(disabled = false, opts: Options = {}) {
  const activateBelow = opts.activateBelow ?? COMPACT_ACTIVATE_BELOW;
  const deactivateAbove = opts.deactivateAbove ?? COMPACT_DEACTIVATE_ABOVE;
  const ref = useRef<HTMLDivElement>(null);
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    if (disabled) return;
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setNarrow((prev) => (prev ? w < deactivateAbove : w < activateBelow));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [disabled, activateBelow, deactivateAbove]);

  return { ref, narrow };
}
