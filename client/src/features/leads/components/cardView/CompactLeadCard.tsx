import { useRef } from "react";
import { EntityAvatar } from "@/components/ui/entity-avatar";
import { getLeadStatusAvatarColor } from "@/lib/avatarUtils";
import { getFullName, getStatus } from "./leadUtils";

interface Props {
  lead: Record<string, any>;
  isActive: boolean;
  onClick: () => void;
  onHover: (lead: Record<string, any>, rect: DOMRect) => void;
  onHoverEnd: () => void;
}

export function CompactLeadCard({ lead, isActive, onClick, onHover, onHoverEnd }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const name = getFullName(lead);
  const status = getStatus(lead);
  const { bg, text } = getLeadStatusAvatarColor(status);

  return (
    <div
      ref={ref}
      className="flex items-center justify-center py-1 mx-1 cursor-pointer"
      onClick={onClick}
      onMouseEnter={() => { if (ref.current) onHover(lead, ref.current.getBoundingClientRect()); }}
      onMouseLeave={onHoverEnd}
    >
      <div
        className="rounded-full"
        style={isActive ? { boxShadow: "0 0 0 3px #ffffff, 0 0 0 4px rgba(0,0,0,0.9)" } : undefined}
      >
        <EntityAvatar
          name={name}
          photoUrl={lead.avatar_url || lead.Avatar_URL || null}
          bgColor={bg}
          textColor={text}
          size={40}
        />
      </div>
    </div>
  );
}
