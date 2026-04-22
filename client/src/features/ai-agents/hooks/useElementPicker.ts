import { useState, useEffect, useCallback, useRef } from "react";

export interface SelectedElementInfo {
  /** React component name (from __reactFiber$) */
  componentName: string | null;
  /** data-testid attribute if present */
  testId: string | null;
  /** HTML tag name (lowercase) */
  tagName: string;
  /** Visible text content, truncated */
  textContent: string;
  /** First few meaningful CSS classes */
  classes: string[];
  /** Bounding rect for overlay positioning */
  rect: DOMRect;
  /** Raw DOM element reference (for re-measuring) */
  element: HTMLElement;
}

/** Walk React fiber tree to find the nearest named component */
function getReactComponentName(el: HTMLElement): string | null {
  const fiberKey = Object.keys(el).find((k) => k.startsWith("__reactFiber$"));
  if (!fiberKey) return null;
  let node = (el as unknown as Record<string, unknown>)[fiberKey] as {
    type?: unknown;
    return?: unknown;
  } | null;
  while (node) {
    if (typeof node.type === "function") {
      const fn = node.type as { displayName?: string; name?: string };
      const name = fn.displayName || fn.name;
      if (name && !name.startsWith("_") && name !== "Fragment") return name;
    }
    node = node.return as typeof node;
  }
  return null;
}

function extractElementInfo(el: HTMLElement): SelectedElementInfo {
  const rect = el.getBoundingClientRect();
  const text = (el.textContent || "").trim().slice(0, 80);
  const classes = Array.from(el.classList)
    .filter((c) => !c.startsWith("__") && c.length < 40)
    .slice(0, 5);
  return {
    componentName: getReactComponentName(el),
    testId: el.getAttribute("data-testid"),
    tagName: el.tagName.toLowerCase(),
    textContent: text,
    classes,
    rect,
    element: el,
  };
}

const WIDGET_ATTR = "data-agent-widget";

function isInsideWidget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return !!el.closest(`[${WIDGET_ATTR}]`);
}

export function useElementPicker() {
  const [pickerActive, setPickerActive] = useState(false);
  const [locked, setLocked] = useState(false);
  const [hoveredInfo, setHoveredInfo] = useState<SelectedElementInfo | null>(null);
  const [selectedInfo, setSelectedInfo] = useState<SelectedElementInfo | null>(null);
  const [confirmedInfo, setConfirmedInfo] = useState<SelectedElementInfo | null>(null);

  const rafRef = useRef(0);
  const selectedRef = useRef<SelectedElementInfo | null>(null);
  selectedRef.current = selectedInfo;
  const lockedRef = useRef(locked);
  lockedRef.current = locked;

  const activate = useCallback(() => {
    setPickerActive(true);
    setLocked(false);
    setHoveredInfo(null);
    setSelectedInfo(null);
  }, []);

  const deactivate = useCallback(() => {
    setPickerActive(false);
    setHoveredInfo(null);
    setSelectedInfo(null);
  }, []);

  const confirm = useCallback(() => {
    setConfirmedInfo(selectedRef.current);
    setHoveredInfo(null);
    setSelectedInfo(null);
  }, []);

  const clear = useCallback(() => {
    setConfirmedInfo(null);
    setLocked(false);
    setPickerActive(false);
  }, []);

  const toggleLock = useCallback(() => {
    setLocked((prev) => !prev);
  }, []);

  // Attach/detach document listeners when pickerActive changes (but skip while locked)
  useEffect(() => {
    if (!pickerActive || locked) return;

    const onMouseMove = (e: MouseEvent) => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0;
        const target = e.target as HTMLElement;
        if (!target || isInsideWidget(target)) {
          setHoveredInfo(null);
          return;
        }
        setHoveredInfo(extractElementInfo(target));
      });
    };

    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target || isInsideWidget(target)) return; // let widget clicks pass through
      e.preventDefault();
      e.stopPropagation();
      const info = extractElementInfo(target);
      setConfirmedInfo(info);
      setHoveredInfo(null);
      setSelectedInfo(null);
    };

    const onScroll = () => {
      const sel = selectedRef.current;
      if (sel && document.contains(sel.element)) {
        setSelectedInfo({ ...sel, rect: sel.element.getBoundingClientRect() });
      }
    };

    const onResize = () => onScroll();

    document.addEventListener("mousemove", onMouseMove, { capture: true });
    document.addEventListener("click", onClick, { capture: true });
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    window.addEventListener("resize", onResize, { passive: true });

    document.body.style.cursor = "crosshair";

    return () => {
      document.removeEventListener("mousemove", onMouseMove, { capture: true } as EventListenerOptions);
      document.removeEventListener("click", onClick, { capture: true } as EventListenerOptions);
      document.removeEventListener("scroll", onScroll, { capture: true } as EventListenerOptions);
      window.removeEventListener("resize", onResize);
      document.body.style.cursor = "";
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
    };
  }, [pickerActive, locked]);

  // Auto-clear confirmed element if it leaves the DOM, and keep its rect fresh on scroll/resize
  useEffect(() => {
    if (!confirmedInfo) return;
    const interval = setInterval(() => {
      if (!document.contains(confirmedInfo.element)) {
        setConfirmedInfo(null);
      }
    }, 2000);
    const refreshRect = () => {
      if (!document.contains(confirmedInfo.element)) return;
      setConfirmedInfo((cur) => cur ? { ...cur, rect: cur.element.getBoundingClientRect() } : cur);
    };
    document.addEventListener("scroll", refreshRect, { capture: true, passive: true });
    window.addEventListener("resize", refreshRect, { passive: true });
    return () => {
      clearInterval(interval);
      document.removeEventListener("scroll", refreshRect, { capture: true } as EventListenerOptions);
      window.removeEventListener("resize", refreshRect);
    };
  }, [confirmedInfo]);

  return {
    pickerActive,
    locked,
    hoveredInfo,
    selectedInfo,
    confirmedInfo,
    activate,
    deactivate,
    confirm,
    clear,
    toggleLock,
  };
}
