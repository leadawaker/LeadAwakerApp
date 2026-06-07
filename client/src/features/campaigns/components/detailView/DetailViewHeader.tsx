import React, { useState, useRef, useEffect } from "react";
import { Zap, X, Camera, ImageIcon } from "lucide-react";
import type { Campaign } from "@/types/models";
import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/avatarUtils";
import { CAMPAIGN_STICKERS } from "@/assets/campaign-stickers/index";
import { formatDate } from "./utils";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

interface DetailViewHeaderProps {
  campaign: Campaign;
  isAdmin: boolean;
  status: string;
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

function statusClass(status: string, isDraft: boolean, isPaused: boolean, isInactive: boolean) {
  if (isDraft) return "draft";
  if (isPaused) return "paused";
  if (isInactive) return "inactive";
  const s = status?.toLowerCase();
  if (s === "active") return "active-s";
  if (s === "paused") return "paused";
  if (s === "inactive" || s === "completed" || s === "archived") return "inactive";
  return "inactive";
}

function stickerFilter(isDraft: boolean, isPaused: boolean, isInactive: boolean, hueValue: number) {
  if (isInactive) return "grayscale(1) opacity(0.8)";
  if (isDraft) return "grayscale(1) sepia(1) hue-rotate(185deg) saturate(4) brightness(0.9) opacity(0.8)";
  if (isPaused) return "sepia(1) saturate(2) hue-rotate(-5deg) brightness(0.85) opacity(0.8)";
  return `hue-rotate(${hueValue}deg)`;
}

export function DetailViewHeader({
  campaign,
  isAdmin,
  status,
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
  const [photoPopoverOpen, setPhotoPopoverOpen] = useState(false);

  useEffect(() => { setNameValue(campaign.name); }, [campaign.name]);
  useEffect(() => { if (editingName) nameInputRef.current?.select(); }, [editingName]);

  const commitName = async () => {
    setEditingName(false);
    const trimmed = nameValue.trim();
    if (trimmed && trimmed !== campaign.name) await onSaveName(trimmed);
    else setNameValue(campaign.name);
  };

  const openPhotoPicker = () => {
    if (!isAdmin) return;
    setPendingSlug(selectedSticker?.slug ?? null);
    setPendingHue(hueValue);
    setPhotoPopoverOpen(true);
  };

  const handleSaveSticker = () => {
    setSelectedStickerSlug(pendingSlug);
    setHueValue(pendingHue);
    saveSticker(pendingSlug, pendingHue, stickerSize);
    setPhotoPopoverOpen(false);
  };

  const hasImage = !!(selectedSticker || campaign.logo_url);
  const statusMod = statusClass(status, isDraft, isPaused, isInactive);
  const imgFilter = stickerFilter(isDraft, isPaused, isInactive, hueValue);

  const renderMetaChip = (label: string, value: React.ReactNode, icon?: React.ReactNode) => (
    <div>
      <div className="eyebrow eyebrow-sm" style={{ color: 'var(--mute)' }}>{label}</div>
      <div className="flex items-center gap-1.5" style={{ fontSize: 13, color: 'var(--ink)', marginTop: 5 }}>
        {icon}
        {value}
      </div>
    </div>
  );

  const renderAccountAvatar = (name: string, logoUrl?: string) => (
    <div className="h-[30px] w-[30px] rounded-full flex items-center justify-center shrink-0 overflow-hidden"
      style={logoUrl ? {} : { backgroundColor: 'var(--bg-2)', color: 'var(--ink)' }}>
      {logoUrl ? <img src={logoUrl} alt="account" className="h-full w-full object-cover" /> : <span className="text-[10px] font-bold">{getInitials(name)}</span>}
    </div>
  );

  const renderMobileAccountAvatar = (name: string, logoUrl?: string) => (
    <div className="h-[24px] w-[24px] rounded-full flex items-center justify-center shrink-0 overflow-hidden"
      style={logoUrl ? {} : { backgroundColor: 'var(--bg-2)', color: 'var(--ink)' }}>
      {logoUrl ? <img src={logoUrl} alt="account" className="h-full w-full object-cover" /> : <span className="text-[9px] font-bold">{getInitials(name)}</span>}
    </div>
  );

  const channelIcon = (campaign as any).channel && (
    <img
      src={`/logos/${(({ whatsapp: "whatsapp-svgrepo-com", instagram: "instagram-svgrepo-com", email: "email-address-svgrepo-com", sms: "sms-svgrepo-com", phone: "phone-call-svgrepo-com" } as Record<string, string>)[(campaign as any).channel?.toLowerCase()] ?? "sms-svgrepo-com")}.svg`}
      alt={(campaign as any).channel}
      className="h-[26px] w-[26px] object-contain shrink-0"
    />
  );

  const mobileChannelIcon = (campaign as any).channel && (
    <img
      src={`/logos/${(({ whatsapp: "whatsapp-svgrepo-com", instagram: "instagram-svgrepo-com", email: "email-address-svgrepo-com", sms: "sms-svgrepo-com", phone: "phone-call-svgrepo-com" } as Record<string, string>)[(campaign as any).channel?.toLowerCase()] ?? "sms-svgrepo-com")}.svg`}
      alt={(campaign as any).channel}
      className="h-[24px] w-[24px] object-contain shrink-0"
    />
  );

  return (
    <>
      {/* Eyebrow: status pill + CAMPAIGN · #N · LIVE MONITOR */}
      <div className="flex items-center gap-3 mb-3" data-testid="campaign-detail-view-status">
        {status && (
          <span className={cn("la-status", statusMod)}>
            <span className="dot" />
            {t(`statusLabels.${status}`, status)}
          </span>
        )}
        <span style={{ fontFamily: "'Geist Mono', ui-monospace, monospace", fontSize: 10, color: 'var(--mute)', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
          {t("detail.campaignLabel", "Campaign")} · #{campaignNumber} · {t("detail.liveMonitor", "Live Monitor")}
        </span>
      </div>

      {/* Title row: Avatar + Name */}
      <div className="relative flex items-center gap-4">
        <Popover open={photoPopoverOpen} onOpenChange={setPhotoPopoverOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                "la-mono-tile wine shrink-0 relative group",
                isAdmin ? "cursor-pointer" : "cursor-default"
              )}
              style={{ width: 52, height: 52, fontSize: 21, ...(hasImage ? { overflow: 'hidden' } : {}) }}
              onClick={(e) => {
                if (!isAdmin) { e.preventDefault(); return; }
                openPhotoPicker();
              }}
              title={isAdmin ? t("photo.clickToChange") : undefined}
              aria-label={isAdmin ? t("photo.clickToChange") : "Campaign photo"}
            >
              {selectedSticker ? (
                <img src={selectedSticker.url} alt={selectedSticker.label} className="object-contain w-full h-full" style={{ filter: imgFilter }} />
              ) : campaign.logo_url ? (
                <img src={campaign.logo_url} alt="logo" className="h-full w-full object-cover"
                  style={{ filter: isInactive ? "grayscale(1) opacity(0.5)" : isDraft ? "grayscale(1) sepia(1) hue-rotate(185deg) saturate(4) brightness(0.9) opacity(0.5)" : isPaused ? "sepia(1) saturate(2) hue-rotate(-5deg) brightness(0.85) opacity(0.5)" : undefined }}
                />
              ) : (
                <span style={{ fontFamily: 'var(--serif)', fontSize: 20 }}>{initials || <Zap className="w-5 h-5" />}</span>
              )}
              {isAdmin && (
                <div className="absolute inset-0 rounded-[var(--r-surface)] bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <Camera className="w-5 h-5" style={{ color: 'var(--paper)' }} />
                </div>
              )}
            </button>
          </PopoverTrigger>
          {isAdmin && (
            <PopoverContent className="w-80" align="start">
              <div className="flex flex-col gap-3">
                {/* Preview */}
                <div className="flex justify-center py-2">
                  {(() => {
                    const previewSticker = CAMPAIGN_STICKERS.find(s => s.slug === pendingSlug) ?? null;
                    return previewSticker ? (
                      <img src={previewSticker.url} alt={previewSticker.label} className="object-contain" style={{ width: 80, height: 80, filter: `hue-rotate(${pendingHue}deg)` }} />
                    ) : (
                      <div className="h-[72px] w-[72px] rounded-full flex items-center justify-center"
                        style={{ background: 'var(--bg-2)', color: 'var(--mute)' }}>
                        <ImageIcon className="h-8 w-8" />
                      </div>
                    );
                  })()}
                </div>

                {/* Hue slider */}
                {pendingSlug && (
                  <div className="space-y-1.5 px-1">
                    <div className="flex items-center justify-between">
                      <p className="eyebrow-sm" style={{ color: 'var(--mute)' }}>{t("photo.hue")}</p>
                      <p className="text-[11px] tabular-nums" style={{ color: 'var(--mute)' }}>{pendingHue}°</p>
                    </div>
                    <input type="range" min={0} max={360} value={pendingHue} onChange={(e) => setPendingHue(Number(e.target.value))} className="w-full accent-brand-indigo cursor-pointer" />
                  </div>
                )}

                {/* Upload logo */}
                <button type="button" onClick={() => logoInputRef.current?.click()}
                  className="la-btn la-btn--raised w-full"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-xs, 6px)' }}>
                  <Camera className="h-4 w-4" />{t("photo.uploadLogo")}
                </button>

                {/* Sticker grid */}
                <div className="space-y-2">
                  <p className="eyebrow-sm" style={{ color: 'var(--mute)' }}>{t("photo.chooseSticker")}</p>
                  <div className="grid grid-cols-5 gap-1.5 max-h-[200px] overflow-y-auto pr-1">
                    <button type="button"
                      className={cn("h-10 w-10 rounded-lg flex items-center justify-center border transition-colors", !pendingSlug ? "border-brand-indigo bg-indigo-50" : "border-[var(--line)] hover:border-[var(--mute)]")}
                      onClick={() => setPendingSlug(null)} title={t("photo.noSticker")}
                    >
                      <X className="h-4 w-4" style={{ color: 'var(--mute)' }} />
                    </button>
                    {CAMPAIGN_STICKERS.map((s) => (
                      <button key={s.slug} type="button"
                        className={cn("h-10 w-10 rounded-lg flex items-center justify-center border transition-colors p-1", pendingSlug === s.slug ? "border-brand-indigo bg-indigo-50" : "border-[var(--line)] hover:border-[var(--mute)]")}
                        onClick={() => setPendingSlug(s.slug)} title={s.label}
                      >
                        <img src={s.url} alt={s.label} className="h-full w-full object-contain" style={{ filter: `hue-rotate(${pendingHue}deg)` }} />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Save button */}
                <button type="button"
                  onClick={handleSaveSticker}
                  className="w-full h-9 rounded-lg text-[13px] font-semibold transition-colors"
                  style={{ background: 'var(--wine)', color: 'var(--paper)' }}
                >
                  {t("toolbar.save")}
                </button>
              </div>
            </PopoverContent>
          )}
        </Popover>

        {isAdmin && campaign.logo_url && (
          <button
            onClick={(e) => { e.stopPropagation(); handleRemoveLogo(); }}
            title={t("photo.removeLogo")}
            className="absolute top-0 left-0 -translate-x-1/4 -translate-y-1/4 h-5 w-5 rounded-full flex items-center justify-center z-10 opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--mute)' }}
          >
            <X className="h-3 w-3" />
          </button>
        )}

        <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoFile} />

        <div className="flex-1 min-w-0">
          {editingName ? (
            <input
              ref={nameInputRef}
              value={nameValue}
              onChange={e => setNameValue(e.target.value)}
              onBlur={commitName}
              onKeyDown={e => { if (e.key === "Enter") { e.currentTarget.blur(); } else if (e.key === "Escape") { setNameValue(campaign.name); setEditingName(false); } }}
              className="text-[26px] md:text-[40px] font-normal font-heading text-foreground leading-none bg-transparent border-b border-foreground/30 outline-none w-full"
              data-testid="campaign-detail-view-name-input"
            />
          ) : (
            <h2
              className="text-[26px] md:text-[40px] font-normal leading-none truncate cursor-text hover:opacity-80 transition-opacity"
              style={{ fontFamily: 'var(--serif)', color: 'var(--ink)', letterSpacing: '-0.018em' }}
              data-testid="campaign-detail-view-name"
              onClick={() => setEditingName(true)}
              title={t("detail.clickToRename", "Click to rename")}
            >
              {campaign.name || t("detail.unnamed")}
            </h2>
          )}
        </div>

      </div>

      {/* Meta chips — always below title, spaced like the reference hero */}
      <div className="flex flex-wrap items-start" style={{ gap: 32, marginTop: 22 }}>
        {(campaign as any).channel && renderMetaChip(t("meta.channel"), <span className="capitalize">{(campaign as any).channel}</span>, mobileChannelIcon)}
        {campaign.daily_lead_limit != null && renderMetaChip(t("meta.dailyLimit"),
          dailyStats != null ? `${dailyStats.sentToday} / ${campaign.daily_lead_limit}` : `${campaign.daily_lead_limit}`
        )}
        {(campaign.active_hours_start || (campaign as any).activeHoursStart) && renderMetaChip(t("meta.activeHours"),
          `${((campaign.active_hours_start || (campaign as any).activeHoursStart) as string).slice(0, 5)} – ${((campaign.active_hours_end || (campaign as any).activeHoursEnd) as string)?.slice(0, 5) ?? "-"}`
        )}
        {campaign.type && renderMetaChip(t("meta.type"), campaign.type)}
        {campaignCreatedAt && renderMetaChip(t("meta.started"), formatDate(campaignCreatedAt))}
        {campaign.account_name && renderMetaChip(t("meta.owner"), campaign.account_name, renderMobileAccountAvatar(campaign.account_name, (campaign as any).account_logo_url))}
      </div>
    </>
  );
}
