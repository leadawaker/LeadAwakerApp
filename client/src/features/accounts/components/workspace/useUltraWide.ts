import { useEffect, useState, type RefObject } from "react";

// Detail-area width (px) at which the ultra-wide multi-column overview engages.
export const ULTRA_AT = 1750;

/**
 * Observe the detail scroll area's own width (not the viewport) and report
 * whether the ultra-wide layout should engage. Stays correct regardless of
 * nav-bar / list-panel collapse state.
 */
export function useUltraWide(ref: RefObject<HTMLElement>): boolean {
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setW(e.contentRect.width);
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [ref]);
  return w >= ULTRA_AT;
}
