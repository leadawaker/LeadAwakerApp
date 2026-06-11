import { useRef } from "react";
import { getInitials, ACCOUNT_STATUS_HEX } from "@/lib/avatarUtils";
import type { AccountRow } from "./types";

interface Props {
  account: AccountRow;
  isActive: boolean;
  onClick: () => void;
  onHover: (account: Record<string, any>, rect: DOMRect) => void;
  onHoverEnd: () => void;
}

export function CompactAccountCard({ account, isActive, onClick, onHover, onHoverEnd }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const name = String(account.name || "?");
  const initials = getInitials(name);
  const status = String(account.status || "");
  const statusHex = ACCOUNT_STATUS_HEX[status] || "#94A3B8";
  const logo = account.logo_url ? String(account.logo_url) : "";
  const tileClass = isActive || status === "Active" ? "wine" : status === "Inactive" || status === "Suspended" ? "inactive" : "";

  return (
    <div
      ref={ref}
      className="flex items-center justify-center py-1 mx-1 cursor-pointer"
      style={{ position: "relative" }}
      onClick={onClick}
      onMouseEnter={() => { if (ref.current) onHover(account, ref.current.getBoundingClientRect()); }}
      onMouseLeave={onHoverEnd}
    >
      {logo ? (
        <div className="la-mono-tile" style={{ overflow: "hidden", padding: 0, boxShadow: isActive ? "var(--sh-raised-crisp), 0 0 0 2px var(--wine)" : undefined }}>
          <img src={logo} alt="" className="h-full w-full object-cover" />
        </div>
      ) : (
        <div className={`la-mono-tile ${tileClass}`} style={isActive ? { boxShadow: "var(--sh-raised-crisp), 0 0 0 2px var(--wine)" } : undefined}>
          {initials}
        </div>
      )}
      <span style={{ position: "absolute", bottom: 4, right: 6, width: 8, height: 8, borderRadius: "50%", background: statusHex, boxShadow: "0 0 0 2px var(--bg)" }} />
    </div>
  );
}
