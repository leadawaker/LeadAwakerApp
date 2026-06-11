import { useRef, type ReactNode } from "react";

// Mini tile for the compact (65px) list rail. Renders initials or an entity icon
// plus a status dot + active ring (mirrors CompactAccountCard).
export function CompactBillingCard({ init, icon, dotColor, isActive, onClick, onHover, onHoverEnd }: {
  init?: string;
  icon?: ReactNode;
  dotColor: string;
  isActive: boolean;
  onClick: () => void;
  onHover: (rect: DOMRect) => void;
  onHoverEnd: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      className="flex items-center justify-center py-1 mx-1 cursor-pointer"
      style={{ position: "relative" }}
      onClick={onClick}
      onMouseEnter={() => { if (ref.current) onHover(ref.current.getBoundingClientRect()); }}
      onMouseLeave={onHoverEnd}
    >
      <div
        className={`la-mono-tile ${isActive ? "wine" : ""}`}
        style={isActive ? { boxShadow: "var(--sh-raised-crisp), 0 0 0 2px var(--wine)" } : undefined}
      >
        {icon ?? init}
      </div>
      <span style={{ position: "absolute", bottom: 4, right: 6, width: 8, height: 8, borderRadius: "50%", background: dotColor, boxShadow: "0 0 0 2px var(--bg)" }} />
    </div>
  );
}
