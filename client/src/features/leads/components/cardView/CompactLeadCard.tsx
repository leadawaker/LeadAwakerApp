import { useRef } from "react";
import { getLeadStatusAvatarColor } from "@/lib/avatarUtils";
import { useTheme } from "@/hooks/useTheme";
import { getFullName, getInitials } from "./leadUtils";
import { presentName, useChatsPresenting } from "../../presenting";
import { displayStage, stageColorKey } from "../../lib/leadDisplay";

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
  const { masked } = useChatsPresenting();
  const name = presentName(getFullName(lead), masked);
  const stage = displayStage(lead);
  const avatarColor = getLeadStatusAvatarColor(stageColorKey(stage));
  const color = avatarColor.bg;
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
        color: avatarColor.text,
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
