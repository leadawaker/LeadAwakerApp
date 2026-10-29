// Horizontal scroll with edge fades: put the returned ref on an element with the
// `.la-fade-x` class (design-system.css). It sets data-fade="start" | "end" | "both"
// while content is hidden on that side, so the CSS mask fades only that edge.
// Pass `activeKey` to scroll the `[aria-selected="true"]` child into view when it changes.
import { useCallback, useEffect, useRef } from "react";

export function useScrollFadeX<T extends HTMLElement>(activeKey?: unknown) {
  const elRef = useRef<T | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const update = useCallback(() => {
    const el = elRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const start = el.scrollLeft > 1;
    const end = max - el.scrollLeft > 1;
    const fade = start && end ? "both" : start ? "start" : end ? "end" : "";
    if (fade) el.dataset.fade = fade;
    else delete el.dataset.fade;
  }, []);

  const ref = useCallback((el: T | null) => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    elRef.current = el;
    if (!el) return;
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    Array.from(el.children).forEach((c) => ro.observe(c));
    cleanupRef.current = () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [update]);

  useEffect(() => () => cleanupRef.current?.(), []);

  useEffect(() => {
    const el = elRef.current;
    if (!el || activeKey === undefined) return;
    const active = el.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!active) return;
    const a = active.getBoundingClientRect();
    const box = el.getBoundingClientRect();
    if (a.left < box.left) el.scrollBy({ left: a.left - box.left - 24, behavior: "smooth" });
    else if (a.right > box.right) el.scrollBy({ left: a.right - box.right + 24, behavior: "smooth" });
  }, [activeKey]);

  return ref;
}
