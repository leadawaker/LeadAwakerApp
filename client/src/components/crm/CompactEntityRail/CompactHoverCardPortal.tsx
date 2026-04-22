import { ReactNode } from "react";
import { createPortal } from "react-dom";

interface Props {
  rect: DOMRect | null;
  width?: number;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  children: ReactNode;
}

/**
 * Renders a floating panel to the right of an anchor rect. Portal-based so the
 * content never clips on overflow:hidden scroll containers.
 */
export function CompactHoverCardPortal({ rect, width = 300, onMouseEnter, onMouseLeave, children }: Props) {
  if (!rect) return null;
  return createPortal(
    <div
      className="fixed z-50"
      style={{
        top: Math.min(rect.top - 8, window.innerHeight - 200),
        left: rect.right + 6,
        width,
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="shadow-xl rounded-xl overflow-hidden border border-black/[0.06]">
        {children}
      </div>
    </div>,
    document.body,
  );
}
