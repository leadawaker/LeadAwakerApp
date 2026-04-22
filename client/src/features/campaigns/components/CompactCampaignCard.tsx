import { useRef } from "react";
import { EntityAvatar } from "@/components/ui/entity-avatar";
import { getCampaignAvatarColor } from "@/lib/avatarUtils";
import { CAMPAIGN_STICKERS } from "@/assets/campaign-stickers/index";

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
  const status = String(campaign.status || "");
  const { bg, text } = getCampaignAvatarColor(status);
  const stickerSlug = campaign.campaign_sticker ?? null;
  const sticker = stickerSlug ? CAMPAIGN_STICKERS.find((s) => s.slug === stickerSlug) : null;

  return (
    <div
      ref={ref}
      className="flex items-center justify-center py-1 mx-1 cursor-pointer"
      onClick={onClick}
      onMouseEnter={() => { if (ref.current) onHover(campaign, ref.current.getBoundingClientRect()); }}
      onMouseLeave={onHoverEnd}
    >
      <div
        className="rounded-full"
        style={isActive ? { boxShadow: "0 0 0 3px #ffffff, 0 0 0 4px rgba(0,0,0,0.9)" } : undefined}
      >
        {sticker ? (
          <div className="h-10 w-10 rounded-full overflow-hidden shrink-0 flex items-center justify-center bg-white dark:bg-card">
            <img src={sticker.url} alt="" className="h-9 w-9 object-contain" />
          </div>
        ) : (
          <EntityAvatar
            name={name}
            bgColor={bg}
            textColor={text}
            size={40}
          />
        )}
      </div>
    </div>
  );
}
