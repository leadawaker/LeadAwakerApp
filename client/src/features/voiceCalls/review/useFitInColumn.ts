// In the wide layout the test panel is a sticky column that scrolls on its own
// (VoiceTab's <aside>). A list inside it (the live or review transcript) gets the height
// that is left in that column after everything above and below it, so the column does
// not need a scrollbar of its own on top of the list's. Narrow layout: `fallback`.
// `mounted` says whether the list element is rendered: a list that mounts later (turns that
// arrive after the first render) is measured when it appears, not only at first render.
import { useEffect, useState, type RefObject } from "react";

const FLOOR_PX = 200;

function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const y = getComputedStyle(p).overflowY;
    if (y === "auto" || y === "scroll") return p;
  }
  return null;
}

export function useFitInColumn(ref: RefObject<HTMLElement | null>, column: boolean, fallback: string, mounted = true): string {
  const [px, setPx] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!column || !mounted || !el) { setPx(null); return; }
    const col = scrollParent(el);
    if (!col) { setPx(null); return; }
    const measure = () => {
      const cs = getComputedStyle(col);
      // The column's tallest size (its max-height), not its current one: it shrinks to short content.
      const max = parseFloat(cs.maxHeight);
      const limit = Number.isFinite(max) ? max : col.clientHeight;
      const r = el.getBoundingClientRect();
      const top = r.top - col.getBoundingClientRect().top + col.scrollTop;
      let bottom = r.bottom;
      for (const c of Array.from(col.children)) bottom = Math.max(bottom, c.getBoundingClientRect().bottom);
      const below = bottom - r.bottom + (parseFloat(cs.paddingBottom) || 0);
      setPx(Math.max(FLOOR_PX, Math.floor(limit - top - below)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(col);
    for (const child of Array.from(col.children)) ro.observe(child);
    window.addEventListener("resize", measure);
    return () => { ro.disconnect(); window.removeEventListener("resize", measure); };
  }, [ref, column, mounted]);

  return px === null ? fallback : `${px}px`;
}
