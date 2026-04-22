import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Tracks the currently hovered item in a compact rail and keeps its anchor rect
 * in sync with scroll/resize. Consumers pass a function to find the element by id.
 */
export function useCompactHoverCard<T>(
  getId: (item: T) => string | number,
  findEl: (id: string | number) => HTMLElement | null,
) {
  const [hovered, setHovered] = useState<T | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onHover = useCallback((item: T, r: DOMRect) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setHovered(item);
    setRect(r);
  }, []);

  const onHoverEnd = useCallback(() => {
    timeoutRef.current = setTimeout(() => {
      setHovered(null);
      setRect(null);
    }, 150);
  }, []);

  const cancelHoverEnd = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  const close = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setHovered(null);
    setRect(null);
  }, []);

  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); }, []);

  useEffect(() => {
    if (!hovered) return;
    const id = getId(hovered);
    const reposition = () => {
      const el = findEl(id);
      if (el) setRect(el.getBoundingClientRect());
    };
    window.addEventListener("scroll", reposition, { passive: true, capture: true });
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [hovered, getId, findEl]);

  return { hovered, rect, onHover, onHoverEnd, cancelHoverEnd, close };
}
