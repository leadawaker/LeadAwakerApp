import React, { useState, useRef, useEffect } from "react";
import { Zap, X, Camera, ImageIcon } from "lucide-react";
import type { Campaign } from "@/types/models";
import { cn } from "@/lib/utils";
import { CAMPAIGN_STATUS_HEX, getInitials } from "@/lib/avatarUtils";
import { CAMPAIGN_STICKERS } from "@/assets/campaign-stickers/index";
import { formatDate } from "./utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface DetailViewHeaderProps {
  campaign: Campaign;
  isAdmin: boolean;
  status: string;
  avatarColor: { bg: string; text: string };
  isDraft: boolean;
  isPaused: boolean;
  isInactive: boolean;
  initials: string;
  campaignNumber: number;
  campaignCreatedAt: string | null;
  dailyStats: { sentToday: number } | null | undefined;
  selectedSticker: { url: string; label: string; slug: string } | null;
  stickerSize: number;
  hueValue: number;
  photoDialogOpen: boolean;
  pendingSlug: string | null;
  pendingHue: number;
  setPhotoDialogOpen: (v: boolean) => void;
  setPendingSlug: (v: string | null) => void;
  setPendingHue: (v: number) => void;
  saveSticker: (slug: string | null, hue: number, size: number) => Promise<void>;
  setSelectedStickerSlug: (v: string | null) => void;
  setHueValue: (v: number) => void;
  logoInputRef: React.RefObject<HTMLInputElement | null>;
  handleLogoFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleRemoveLogo: () => void;
  compact: boolean;
  t: (...args: any[]) => any;
  onSaveName: (name: string) => Promise<void>;
}

export function DetailViewHeader({
  campaign,
  isAdmin,
  status,
  avatarColor,
  isDraft,
  isPaused,
  isInactive,
  initials,
  campaignNumber,
  campaignCreatedAt,
  dailyStats,
  selectedSticker,
  stickerSize,
  hueValue,
  photoDialogOpen,
  pendingSlug,
  pendingHue,
  setPhotoDialogOpen,
  setPendingSlug,
  setPendingHue,
  saveSticker,
  setSelectedStickerSlug,
  setHueValue,
  logoInputRef,
  handleLogoFile,
  handleRemoveLogo,
  compact,
  t,
  onSaveName,
}: DetailViewHeaderProps) {
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(campaign.name);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setNameValue(campaign.name); }, [campaign.name]);
  useEffect(() => { if (editingName) nameInputRef.current?.select(); }, [editingName]);

  const commitName = async () => {
    setEditingName(false);
    const trimmed = nameValue.trim();
    if (trimmed && trimmed !== campaign.name) await onSaveName(trimmed);
    else setNameValue(campaign.name);
  };

  return (
    <>
      {/* Row 2: Avatar + Name + Meta chips */}
      <div className="relative flex items-center gap-3">
        <div className="relative group shrink-0">
          <div
            className={cn(
              "relative flex items-center justify-center text-xl font-bold",
              !selectedSticker && "rounded-full overflow-hidden",
              isAdmin ? "cursor-pointer" : "cursor-default"
            )}
            style={{
              width: selectedSticker ? Math.min(stickerSize, 130) : 72,
              height: selectedSticker ? Math.min(stickerSize, 130) : 72,
              ...(campaign.logo_url || selectedSticker ? {} : isDraft
                ? { backgroundColor: "#B8C8E8", color: "#2D3F6E" }
                : isPaused
                ? { backgroundColor: "#C8B86A", color: "#5A4A1A" }
                : { backgroundColor: avatarColor.bg, color: avatarColor.text }),
            }}
            onClick={() => {
              if (!isAdmin) return;
              setPendingSlug(selectedSticker?.slug ?? null);
              setPendingHue(hueValue);
              setPhotoDialogOpen(true);
            }}
            title={isAdmin ? t("photo.clickToChange") : undefined}
          >
            {selectedSticker ? (
              <img src={selectedSticker.url} alt={selectedSticker.label} className="object-contain w-full h-full"
                style={{ filter:
                  isInactive ? "grayscale(1) opacity(0.8)"
                  : isDraft ? "grayscale(1) sepia(1) hue-rotate(185deg) saturate(4) brightness(0.9) opacity(0.8)"
                  : isPaused ? "sepia(1) saturate(2) hue-rotate(-5deg) brightness(0.85) opacity(0.8)"
                  : `hue-rotate(${hueValue}deg)`
                }}
              />
            ) : campaign.logo_url ? (
              <img src={campaign.logo_url} alt="logo" className="h-full w-full object-cover"
                style={{ filter:
                  isInactive ? "grayscale(1) opacity(0.5)"
                  : isDraft ? "grayscale(1) sepia(1) hue-rotate(185deg) saturate(4) brightness(0.9) opacity(0.5)"
                  : isPaused ? "sepia(1) saturate(2) hue-rotate(-5deg) brightness(0.85) opacity(0.5)"
                  : undefined
                }}
              />
            ) : (
              initials || <Zap className="w-6 h-6" />
            )}
          </div>
          {isAdmin && (
            <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer pointer-events-none">
              <Camera className="w-5 h-5 text-white" />
            </div>
          )}
          {isAdmin && campaign.logo_url && (
            <button
              onClick={(e) => { e.stopPropagation(); handleRemoveLogo(); }}
              title={t("photo.removeLogo")}
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-white dark:bg-card border border-black/[0.125] flex items-center justify-center text-foreground/50 hover:text-red-500 hover:border-red-300 transition-colors z-10 opacity-0 group-hover:opacity-100"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoFile} />

        {/* Photo / Sticker dialog */}
        <Dialog open={photoDialogOpen} onOpenChange={setPhotoDialogOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>{t("photo.dialogTitle")}</DialogTitle></DialogHeader>
            <div className="flex justify-center py-2">
              {(() => {
                const previewSticker = CAMPAIGN_STICKERS.find(s => s.slug === pendingSlug) ?? null;
                return previewSticker ? (
                  <img src={previewSticker.url} alt={previewSticker.label} className="object-contain" style={{ width: 80, height: 80, filter: `hue-rotate(${pendingHue}deg)` }} />
                ) : (
                  <div className="h-[72px] w-[72px] rounded-full flex items-center justify-center bg-muted/30 text-muted-foreground/40">
                    <ImageIcon className="h-8 w-8" />
                  </div>
                );
              })()}
            </div>
            {pendingSlug && (
              <div className="space-y-1.5 px-1">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase tracking-wider text-foreground/40 font-semibold">{t("photo.hue")}</p>
                  <p className="text-[11px] text-muted-foreground tabular-nums">{pendingHue}°</p>
                </div>
                <input type="range" min={0} max={360} value={pendingHue} onChange={(e) => setPendingHue(Number(e.target.value))} className="w-full accent-brand-indigo cursor-pointer" />
              </div>
            )}
            <button type="button" onClick={() => logoInputRef.current?.click()}
              className="w-full h-9 rounded-lg border border-black/[0.125] text-[12px] font-medium text-foreground/60 hover:text-foreground hover:border-black/[0.175] transition-colors flex items-center justify-center gap-1.5"
            >
              <Camera className="h-4 w-4" />{t("photo.uploadLogo")}
            </button>
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-wider text-foreground/40 font-semibold">{t("photo.chooseSticker")}</p>
              <div className="grid grid-cols-5 gap-1.5 max-h-[200px] overflow-y-auto pr-1">
                <button type="button"
                  className={cn("h-10 w-10 rounded-lg flex items-center justify-center border transition-colors", !pendingSlug ? "border-brand-indigo bg-indigo-50" : "border-black/[0.125] hover:border-black/[0.175]")}
                  onClick={() => setPendingSlug(null)} title={t("photo.noSticker")}
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
                {CAMPAIGN_STICKERS.map((s) => (
                  <button key={s.slug} type="button"
                    className={cn("h-10 w-10 rounded-lg flex items-center justify-center border transition-colors p-1", pendingSlug === s.slug ? "border-brand-indigo bg-indigo-50" : "border-black/[0.125] hover:border-black/[0.175]")}
                    onClick={() => setPendingSlug(s.slug)} title={s.label}
                  >
                    <img src={s.url} alt={s.label} className="h-full w-full object-contain" style={{ filter: `hue-rotate(${pendingHue}deg)` }} />
                  </button>
                ))}
              </div>
            </div>
            <button type="button"
              onClick={() => { setSelectedStickerSlug(pendingSlug); setHueValue(pendingHue); saveSticker(pendingSlug, pendingHue, stickerSize); setPhotoDialogOpen(false); }}
              className="w-full h-9 rounded-lg bg-brand-indigo text-white text-[13px] font-semibold hover:bg-brand-indigo/90 transition-colors"
            >
              {t("toolbar.save")}
            </button>
          </DialogContent>
        </Dialog>

        <div className="flex-1 min-w-0">
          {editingName ? (
            <input
              ref={nameInputRef}
              value={nameValue}
              onChange={e => setNameValue(e.target.value)}
              onBlur={commitName}
              onKeyDown={e => { if (e.key === "Enter") { e.currentTarget.blur(); } else if (e.key === "Escape") { setNameValue(campaign.name); setEditingName(false); } }}
              className="text-[18px] md:text-[27px] font-semibold font-heading text-foreground leading-tight bg-transparent border-b border-foreground/30 outline-none w-full"
              data-testid="campaign-detail-view-name-input"
            />
          ) : (
            <h2
              className="text-[18px] md:text-[27px] font-semibold font-heading text-foreground leading-tight truncate cursor-text hover:opacity-80 transition-opacity"
              data-testid="campaign-detail-view-name"
              onClick={() => setEditingName(true)}
              title={t("detail.clickToRename", "Click to rename")}
            >
              {campaign.name || t("detail.unnamed")}
            </h2>
          )}
          <div className="mt-1 flex items-center gap-1.5" data-testid="campaign-detail-view-status">
            {status && (
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold self-start"
                style={{ backgroundColor: `${CAMPAIGN_STATUS_HEX[status]}20`, color: CAMPAIGN_STATUS_HEX[status] || "#6B7280" }}
              >
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: CAMPAIGN_STATUS_HEX[status] || "#6B7280" }} />
                {t(`statusLabels.${status}`, status)}
              </span>
            )}
            <span className="text-[11px] font-semibold text-foreground/40">#{campaignNumber}</span>
          </div>
        </div>

        {/* Desktop meta chips */}
        {!compact && (
          <div className="shrink-0 hidden md:flex items-center gap-7 whitespace-nowrap">
            {(campaign as any).channel && (
              <div className="flex items-center gap-1.5">
                <img src={`/logos/${(({ whatsapp: "whatsapp-svgrepo-com", instagram: "instagram-svgrepo-com", email: "email-address-svgrepo-com", sms: "sms-svgrepo-com", phone: "phone-call-svgrepo-com" } as Record<string, string>)[(campaign as any).channel?.toLowerCase()] ?? "sms-svgrepo-com")}.svg`} alt={(campaign as any).channel} className="h-[26px] w-[26px] object-contain shrink-0" />
                <div>
                  <div className="text-[8px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-0.5">{t("meta.channel")}</div>
                  <div className="text-[11px] font-bold text-foreground leading-none capitalize">{(campaign as any).channel}</div>
                </div>
              </div>
            )}
            {campaignCreatedAt && (
              <div>
                <div className="text-[8px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-0.5">{t("meta.started")}</div>
                <div className="text-[11px] font-bold text-foreground leading-none">{formatDate(campaignCreatedAt)}</div>
              </div>
            )}
            {campaign.type && (
              <div>
                <div className="text-[8px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-0.5">{t("meta.type")}</div>
                <div className="text-[11px] font-bold text-foreground leading-none">{campaign.type}</div>
              </div>
            )}
            {campaign.daily_lead_limit != null && (
              <div>
                <div className="text-[8px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-0.5">{t("meta.dailyLimit")}</div>
                <div className="text-[11px] font-bold text-foreground leading-none tabular-nums">
                  {dailyStats != null ? `${dailyStats.sentToday} / ${campaign.daily_lead_limit}` : `${campaign.daily_lead_limit}`}
                </div>
              </div>
            )}
            {(campaign.active_hours_start || (campaign as any).activeHoursStart) && (
              <div>
                <div className="text-[8px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-0.5">{t("meta.activeHours")}</div>
                <div className="text-[11px] font-bold text-foreground leading-none">
                  {((campaign.active_hours_start || (campaign as any).activeHoursStart) as string).slice(0, 5)}
                  {" - "}
                  {((campaign.active_hours_end || (campaign as any).activeHoursEnd) as string)?.slice(0, 5) ?? "-"}
                </div>
              </div>
            )}
            {campaign.account_name && (
              <div className="flex items-center gap-1.5">
                <div className="h-[30px] w-[30px] rounded-full flex items-center justify-center shrink-0 overflow-hidden" style={(campaign as any).account_logo_url ? {} : { backgroundColor: "rgba(0,0,0,0.08)", color: "#374151" }}>
                  {(campaign as any).account_logo_url ? <img src={(campaign as any).account_logo_url} alt="account" className="h-full w-full object-cover" /> : <span className="text-[10px] font-bold">{getInitials(campaign.account_name)}</span>}
                </div>
                <div>
                  <div className="text-[8px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-0.5">{t("meta.owner")}</div>
                  <div className="text-[11px] font-bold text-foreground leading-none">{campaign.account_name}</div>
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Mobile / compact meta chips */}
      <div className={cn("flex flex-wrap items-center gap-7", compact ? "flex" : "flex md:hidden")}>
        {campaign.account_name && (
          <div className="flex items-center gap-1.5">
            <div className="h-[24px] w-[24px] rounded-full flex items-center justify-center shrink-0 overflow-hidden" style={(campaign as any).account_logo_url ? {} : { backgroundColor: "rgba(0,0,0,0.08)", color: "#374151" }}>
              {(campaign as any).account_logo_url ? <img src={(campaign as any).account_logo_url} alt="account" className="h-full w-full object-cover" /> : <span className="text-[9px] font-bold">{getInitials(campaign.account_name)}</span>}
            </div>
            <div>
              <div className="text-[8px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-0.5">{t("meta.owner")}</div>
              <div className="text-[11px] font-bold text-foreground leading-none">{campaign.account_name}</div>
            </div>
          </div>
        )}
        {(campaign as any).channel && (
          <div className="flex items-center gap-1.5">
            <img src={`/logos/${(({ whatsapp: "whatsapp-svgrepo-com", instagram: "instagram-svgrepo-com", email: "email-address-svgrepo-com", sms: "sms-svgrepo-com", phone: "phone-call-svgrepo-com" } as Record<string, string>)[(campaign as any).channel?.toLowerCase()] ?? "sms-svgrepo-com")}.svg`} alt={(campaign as any).channel} className="h-[24px] w-[24px] object-contain shrink-0" />
            <div>
              <div className="text-[8px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-0.5">{t("meta.channel")}</div>
              <div className="text-[11px] font-bold text-foreground leading-none capitalize">{(campaign as any).channel}</div>
            </div>
          </div>
        )}
        {campaignCreatedAt && (
          <div>
            <div className="text-[8px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-0.5">{t("meta.started")}</div>
            <div className="text-[11px] font-bold text-foreground leading-none">{formatDate(campaignCreatedAt)}</div>
          </div>
        )}
        {campaign.type && (
          <div>
            <div className="text-[8px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-0.5">{t("meta.type")}</div>
            <div className="text-[11px] font-bold text-foreground leading-none">{campaign.type}</div>
          </div>
        )}
        {campaign.daily_lead_limit != null && (
          <div>
            <div className="text-[8px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-0.5">{t("meta.dailyLimit")}</div>
            <div className="text-[11px] font-bold text-foreground leading-none tabular-nums">
              {dailyStats != null ? `${dailyStats.sentToday} / ${campaign.daily_lead_limit}` : `${campaign.daily_lead_limit}`}
            </div>
          </div>
        )}
        {(campaign.active_hours_start || (campaign as any).activeHoursStart) && (
          <div>
            <div className="text-[8px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-0.5">{t("meta.activeHours")}</div>
            <div className="text-[11px] font-bold text-foreground leading-none">
              {((campaign.active_hours_start || (campaign as any).activeHoursStart) as string).slice(0, 5)}
              {" – "}
              {((campaign.active_hours_end || (campaign as any).activeHoursEnd) as string)?.slice(0, 5) ?? "—"}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
