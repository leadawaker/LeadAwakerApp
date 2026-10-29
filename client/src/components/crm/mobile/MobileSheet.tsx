import { type ReactNode, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useMotionValue } from "framer-motion";
import { useSwipeDownToClose } from "./useSwipeDownToClose";

/**
 * While the sheet is open, push a sentinel history entry so the phone/browser
 * Back button closes the sheet first (returning to the list) instead of leaving
 * the page. Closing the sheet by tap/drag pops the sentinel back off so history
 * never accumulates.
 */
export function useBackButtonClose(open: boolean, onClose: () => void) {
  const cbRef = useRef(onClose);
  cbRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const id = Math.random().toString(36).slice(2);
    window.history.pushState({ __laSheet: id }, "");
    const onPop = () => cbRef.current?.();
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      // Closed by tap/drag (not Back): remove the sentinel we added.
      if ((window.history.state as { __laSheet?: string } | null)?.__laSheet === id) {
        window.history.back();
      }
    };
  }, [open]);
}

/**
 * MobileSheet — the canonical mobile "variation B" detail surface.
 *
 * A list → detail drill-down rises from the bottom as a dimmed sheet with a
 * drag handle. Pull it down (or tap the scrim) to dismiss. Fully covers the
 * list behind it (the list also recedes via {@link MobileRecede}), so the
 * underlying list never peeks through.
 *
 * Ported from the design prototype (`Design files/mobile-shell.jsx` → MobSheet),
 * but using framer-motion for real drag-to-dismiss instead of the rAF hack.
 *
 * Renders into document.body so it escapes any transformed/overflow ancestors.
 */
const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const EASE_IN = [0.4, 0, 1, 1] as const;

// Pull-down-to-close lives in useSwipeDownToClose: it starts anywhere on the
// sheet (header, handle, or the body while it is scrolled to the top), closes
// past 80px or 25% of the height, or on a quick flick, and tolerates diagonals.

export function MobileSheet({
  open,
  onClose,
  children,
  /** Gap above the sheet (px) so the receding list peeks at the very top. */
  topGap = 18,
  zIndex = 200,
  /** When true, the sheet sizes to its content from the bottom instead of
   *  filling the full height. Useful for short action lists. */
  fitContent = false,
  "data-testid": testId,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  topGap?: number;
  zIndex?: number;
  fitContent?: boolean;
  "data-testid"?: string;
}) {
  useBackButtonClose(open, onClose);

  // Drag offset on the inner panel; the outer layer owns the slide in / out.
  const dragY = useMotionValue(0);
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (open) dragY.set(0); }, [open, dragY]);
  useSwipeDownToClose(panelRef, { onClose, y: dragY, enabled: open });

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="md:hidden" style={{ position: "fixed", inset: 0, zIndex }}>
          {/* Scrim */}
          <motion.div
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.32, ease: "easeOut" }}
            style={{ position: "absolute", inset: 0, background: "rgba(31,26,20,0.32)" }}
            data-testid={testId ? `${testId}-scrim` : undefined}
          />

          {/* Panel: the outer layer slides in and out, the inner one follows the finger */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "tween", duration: 0.36, ease: open ? EASE_OUT : EASE_IN }}
            style={fitContent ? {
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              maxHeight: `calc(90vh - ${topGap}px)`,
              display: "flex",
              flexDirection: "column",
            } : {
              position: "absolute",
              left: 0,
              right: 0,
              top: topGap,
              bottom: 0,
              display: "flex",
              flexDirection: "column",
            }}
          >
          <motion.div
            ref={panelRef}
            style={{
              y: dragY,
              flex: fitContent ? "0 1 auto" : "1 1 auto",
              minHeight: 0,
              borderRadius: "var(--r-panel) var(--r-panel) 0 0",
              overflow: fitContent ? "auto" : "hidden",
              overscrollBehaviorY: "contain",
              background: "var(--bg)",
              boxShadow: "0 -10px 40px rgba(60,45,25,0.20)",
              display: "flex",
              flexDirection: "column",
            }}
            data-testid={testId}
          >
            {/* Drag handle — the "little dash" to pull down */}
            <div
              style={{
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: 22,
                cursor: "grab",
              }}
              data-testid={testId ? `${testId}-handle` : undefined}
            >
              <span
                style={{
                  width: 40,
                  height: 5,
                  borderRadius: "var(--r-pill)",
                  background: "var(--mute-2)",
                  opacity: 0.6,
                }}
              />
            </div>

            {/* Body — flex column, children own their own scroll region */}
            <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
              {children}
            </div>
          </motion.div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/**
 * MobileRecede — wraps the list screen so it scales back slightly while a sheet
 * is open behind it, reinforcing the depth of the rising sheet.
 */
export function MobileRecede({
  open,
  children,
  fill = false,
}: {
  open: boolean;
  children: ReactNode;
  /**
   * When the detail panel is out of flow (mobile overlay), the list panel must
   * fill the row instead of sizing to content. Pass true on those pages so the
   * inner panel's `w-full` resolves against the full viewport, not ~half.
   */
  fill?: boolean;
}) {
  return (
    <motion.div
      animate={{ scale: open ? 0.96 : 1 }}
      transition={{ type: "tween", duration: 0.36, ease: EASE_OUT }}
      style={{
        height: "100%",
        transformOrigin: "50% 0%",
        ...(fill ? { flex: "1 1 0%", minWidth: 0, width: "100%" } : {}),
      }}
    >
      {children}
    </motion.div>
  );
}
