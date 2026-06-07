import { useRef } from "react";
import { CAMPAIGN_STICKERS } from "@/assets/campaign-stickers/index";
import { getInitials } from "@/lib/avatarUtils";

interface Props {
  campaign: Record<string, any>;
  isActive: boolean;
  onClick: () => void;
  onHover: (campaign: Record<string, any>, rect: DOMRect) => void;
  onHoverEnd: () => void;
}

export function CompactCampaignCard({ campaign, isActive, onClick, onHover, onHoverEnd }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const name = String(campaign.name || "Unnamed");
  const initials = getInitials(name);
  const status = String(campaign.status || "");
  const stickerSlug = campaign.campaign_sticker ?? null;
  const sticker = stickerSlug ? CAMPAIGN_STICKERS.find((s) => s.slug === stickerSlug) : null;

  const tileClass = status === "Active" || isActive ? "wine"
    : status === "Inactive" || status === "Draft" ? "inactive"
    : "";

  return (
    <div
      ref={ref}
      className="flex items-center justify-center py-1 mx-1 cursor-pointer"
      onClick={onClick}
      onMouseEnter={() => { if (ref.current) onHover(campaign, ref.current.getBoundingClientRect()); }}
      onMouseLeave={onHoverEnd}
    >
      {sticker ? (
        <div className="la-mono-tile" style={{ overflow: "hidden", padding: 0 }}>
          <img src={sticker.url} alt="" className="h-full w-full object-contain" />
        </div>
      ) : (
        <div className={`la-mono-tile ${tileClass}`}>{initials}</div>
      )}
    </div>
  );
}
