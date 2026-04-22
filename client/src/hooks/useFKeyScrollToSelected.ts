import { useEffect, type RefObject } from "react";

interface Options {
  /** Scroll container (where the list/table scrolls). If null, scroll the first matching ancestor of the item element. */
  containerRef?: RefObject<HTMLElement>;
  /** Data attribute selector for the selected item. Receives the id. Default: data-[attr]="{id}". */
  getSelector: (id: string | number) => string;
  /** The id of the currently-focused single selection. null/undefined = no-op. */
  selectedId: string | number | null | undefined;
  /** Set to true to disable the shortcut (e.g. when multiple items are bulk-selected). */
  disabled?: boolean;
  /** Optional: load more pages or change page to bring the selected item into DOM. Called once if not found. */
  ensureLoaded?: (id: string | number) => Promise<void> | void;
  /** Pixels to offset from the top when scrolling (e.g. to clear a sticky group header). Default 48. */
  topOffset?: number;
}

/**
 * Global F shortcut: scrolls the selected item into view inside its container.
 * Skips when focus is in an input/textarea/contenteditable or when disabled.
 * If ensureLoaded is provided and the element isn't in the DOM, calls it first then retries.
 */
export function useFKeyScrollToSelected({
  containerRef,
  getSelector,
  selectedId,
  disabled = false,
  ensureLoaded,
  topOffset = 48,
}: Options) {
  useEffect(() => {
    const handler = async (e: KeyboardEvent) => {
      if (e.key !== "f" && e.key !== "F") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (disabled) return;
      if (selectedId === null || selectedId === undefined) return;

      const active = document.activeElement;
      const tag = active?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (active as HTMLElement | null)?.isContentEditable) return;

      e.preventDefault();
      // Blur any focused card/button so browsers don't reveal a focus ring on the keypress.
      if (active instanceof HTMLElement && active !== document.body) active.blur();

      const selector = getSelector(selectedId);
      const container = containerRef?.current ?? null;

      const findEl = (): HTMLElement | null => {
        if (container) return container.querySelector(selector) as HTMLElement | null;
        return document.querySelector(selector) as HTMLElement | null;
      };

      let el = findEl();
      if (!el && ensureLoaded) {
        await ensureLoaded(selectedId);
        // Give React one frame to render
        await new Promise((r) => requestAnimationFrame(() => r(null)));
        el = findEl();
      }
      if (!el) return;

      if (container) {
        const containerTop = container.getBoundingClientRect().top;
        const elTop = el.getBoundingClientRect().top;
        const relativeTop = elTop - containerTop + container.scrollTop;
        container.scrollTo({ top: Math.max(0, relativeTop - topOffset), behavior: "smooth" });
      } else {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [containerRef, getSelector, selectedId, disabled, ensureLoaded, topOffset]);
}
