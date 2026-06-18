import { useRef } from "react";
import { PIPELINE_HEX, getLeadStatusAvatarColor } from "@/lib/avatarUtils";
import { useTheme } from "@/hooks/useTheme";
import { getFullName, getStatus, getInitials } from "./leadUtils";

interface Props {
  lead: Record<string, any>;
  isActive: boolean;
  onClick: () => void;
  onHover: (lead: Record<string, any>, rect: DOMRect) => void;
  onHoverEnd: () => void;
}

const SIZE = 38;

/**
 * Minimized-rail avatar tile. Matches the design's StageAvatar: a square-rounded
 * tile filled with the lead's stage color, white initials, raised-crisp shadow.
 * The active lead gets a wine ring. Rendered inside the ~65px rail.
 */
export function CompactLeadCard({ lead, isActive, onClick, onHover, onHoverEnd }: Props) {
  const ref = useRef<HTMLButtonElement>(null);
  const { isDark } = useTheme();
  const name = getFullName(lead);
  const status = getStatus(lead);
  const avatarColor = getLeadStatusAvatarColor(status);
  const color = isDark ? avatarColor.bg : (PIPELINE_HEX[status] ?? "#6B7280");
  const initials = getInitials(name);

  return (
    <button
      ref={ref}
      type="button"
      title={name}
      onClick={onClick}
      onMouseEnter={() => { if (ref.current) onHover(lead, ref.current.getBoundingClientRect()); }}
      onMouseLeave={onHoverEnd}
      style={{
        width: SIZE,
        height: SIZE,
        flexShrink: 0,
        border: "none",
        padding: 0,
        cursor: "pointer",
        background: color,
        borderRadius: 11,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: isDark ? avatarColor.text : "#fff",
        fontFamily: "var(--mono)",
        fontWeight: 600,
        fontSize: Math.round(SIZE * 0.34),
        letterSpacing: "0.01em",
        boxShadow: isActive
          ? "var(--sh-raised-crisp), 0 0 0 2px var(--wine)"
          : "var(--sh-raised-crisp)",
        transition: "box-shadow 120ms",
      }}
    >
      {initials}
    </button>
  );
}
