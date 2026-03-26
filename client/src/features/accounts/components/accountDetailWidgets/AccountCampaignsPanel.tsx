import { useState, useCallback, useEffect } from "react";
import {
  FileText, Plus, ChevronRight, Users,
} from "lucide-react";
import { apiFetch } from "@/lib/apiUtils";
import { getInitials, getCampaignAvatarColor } from "@/lib/avatarUtils";
import { CAMPAIGN_STICKERS } from "@/assets/campaign-stickers/index";
import { useLocation } from "wouter";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

// ── AccountCampaignsPanel ──────────────────────────────────────────────────────

export function AccountCampaignsPanel({ accountId, routePrefix }: { accountId: number; routePrefix: string }) {
  const { t } = useTranslation("accounts");
  const [, setLocation] = useLocation();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [loadingC, setLoadingC] = useState(true);
  const [loadingK, setLoadingK] = useState(true);

  // Picker state
  const [pickerOpen, setPickerOpen]       = useState(false);
  const [allCampaigns, setAllCampaigns]   = useState<any[]>([]);
  const [pickerSearch, setPickerSearch]   = useState("");
  const [pickerLoading, setPickerLoading] = useState(false);
  const [linking, setLinking]             = useState<number | null>(null);

  const refreshCampaigns = useCallback(() => {
    if (!accountId) return;
    setLoadingC(true);
    apiFetch(`/api/campaigns?accountId=${accountId}`)
      .then((res) => res.json())
      .then((data: any) => {
        const list = Array.isArray(data) ? data : (data?.list ?? data?.data ?? []);
        setCampaigns(list);
      })
      .catch(() => setCampaigns([]))
      .finally(() => setLoadingC(false));
  }, [accountId]);

  useEffect(() => { refreshCampaigns(); }, [refreshCampaigns]);

  useEffect(() => {
    if (!accountId) return;
    setLoadingK(true);
    apiFetch(`/api/contracts?accountId=${accountId}`)
      .then((res) => res.json())
      .then((data: any) => {
        const list = Array.isArray(data) ? data : (data?.list ?? data?.data ?? []);
        setContracts(list);
      })
      .catch(() => setContracts([]))
      .finally(() => setLoadingK(false));
  }, [accountId]);

  const openPicker = useCallback(async () => {
    setPickerOpen(true);
    setPickerSearch("");
    setPickerLoading(true);
    try {
      const res  = await apiFetch("/api/campaigns");
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data?.list ?? data?.data ?? []);
      setAllCampaigns(list);
    } catch {
      setAllCampaigns([]);
    } finally {
      setPickerLoading(false);
    }
  }, []);

  const handleLink = useCallback(async (campaign: any) => {
    const cid = campaign.id ?? campaign.Id;
    if (!cid) return;
    setLinking(cid);
    try {
      await apiFetch(`/api/campaigns/${cid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Accounts_id: accountId }),
      });
      setPickerOpen(false);
      refreshCampaigns();
    } catch (e) {
      console.error("Failed to link campaign", e);
    } finally {
      setLinking(null);
    }
  }, [accountId, refreshCampaigns]);

  const alreadyLinkedIds = new Set(campaigns.map((c: any) => c.id ?? c.Id));
  const pickerFiltered = allCampaigns
    .filter((c: any) => !alreadyLinkedIds.has(c.id ?? c.Id))
    .filter((c: any) => {
      if (!pickerSearch.trim()) return true;
      const name = c.name ?? c.campaign_name ?? c.Name ?? "";
      return name.toLowerCase().includes(pickerSearch.toLowerCase());
    });

  return (
    <div className="space-y-4">

      {/* Campaign picker dialog */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("related.addCampaign")}</DialogTitle>
            <DialogDescription>{t("related.pickCampaign")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <input
              autoFocus
              value={pickerSearch}
              onChange={(e) => setPickerSearch(e.target.value)}
              placeholder={t("related.searchCampaigns")}
              className="w-full text-[12px] bg-white dark:bg-popover border border-border/40 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-brand-indigo/40"
            />
            <div className="max-h-60 overflow-y-auto">
              {pickerLoading ? (
                <div className="space-y-1.5 py-2">
                  {[1, 2, 3].map((i) => <div key={i} className="h-8 rounded bg-muted animate-pulse" />)}
                </div>
              ) : pickerFiltered.length === 0 ? (
                <p className="text-[12px] text-foreground/40 italic py-6 text-center">{t("related.noCampaignsAvailable")}</p>
              ) : (
                <div className="space-y-0.5">
                  {pickerFiltered.map((c: any) => {
                    const cid    = c.id ?? c.Id;
                    const name   = c.name ?? c.campaign_name ?? c.Name ?? "Unnamed";
                    const status = c.status ?? c.Status ?? "";
                    return (
                      <button
                        key={cid}
                        onClick={() => handleLink(c)}
                        disabled={linking === cid}
                        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left hover:bg-muted/60 transition-colors disabled:opacity-50"
                      >
                        <span className="text-[12px] text-foreground font-medium truncate flex-1">{name}</span>
                        {status && (
                          <span className="text-[10px] text-foreground/50 shrink-0 bg-black/[0.05] rounded-full px-1.5 py-0.5">{status}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Campaigns sub-section */}
      <div>
        <div className="flex items-center gap-1.5 mb-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">{t("related.campaigns")}</span>
          {!loadingC && (
            <span className="text-[10px] font-semibold text-foreground/40 bg-black/[0.05] rounded-full px-1.5 py-0.5">{campaigns.length}</span>
          )}
          <button
            onClick={openPicker}
            title={t("related.addCampaign")}
            className="ml-auto h-5 w-5 rounded-full flex items-center justify-center bg-black/[0.06] hover:bg-brand-indigo hover:text-white text-foreground/50 transition-colors"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
        {loadingC ? (
          <div className="flex flex-col gap-2">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-[100px] rounded-xl bg-black/[0.05] animate-pulse" />)}
          </div>
        ) : campaigns.length === 0 ? (
          <p className="text-[11px] text-foreground/30 italic">{t("related.noCampaigns")}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {campaigns.map((c: any, i: number) => {
              const name        = c.name ?? c.campaign_name ?? c.Name ?? t("related.unnamed");
              const status      = c.status ?? c.Status ?? "";
              const cid         = c.Id ?? c.id;
              const colors      = getCampaignAvatarColor(status);
              const inits       = getInitials(name);
              const stickerSlug = c.campaign_sticker ?? c.campaignSticker ?? null;
              const hue         = Number(c.campaign_hue ?? c.campaignHue ?? 0);
              const sticker     = stickerSlug ? CAMPAIGN_STICKERS.find(s => s.slug === stickerSlug) ?? null : null;
              // Find the contract linked to this campaign
              const contract    = contracts.find((k: any) => {
                const kCid = k.campaigns_id ?? k.campaignsId ?? k.Campaigns_id;
                return kCid && String(kCid) === String(cid);
              }) ?? null;
              const createdAt   = c.createdAt ?? c.created_at ?? null;
              const leadsCount  = c.total_leads_targeted ?? c.totalLeadsTargeted ?? c.Leads ?? null;
              const dateLabel   = createdAt
                ? new Date(createdAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })
                : null;
              return (
                <button
                  key={cid ?? i}
                  className="flex flex-row items-stretch gap-0 p-0 bg-white dark:bg-white/[0.08] rounded-xl border border-black/[0.07] hover:border-brand-indigo/30 hover:bg-white dark:hover:bg-white/[0.12] transition-colors duration-100 cursor-pointer text-left overflow-hidden"
                  onClick={() => {
                    if (cid) {
                      try { localStorage.setItem("selected-campaign-id", String(cid)); } catch {}
                    }
                    setLocation(`${routePrefix}/campaigns`);
                  }}
                >
                  {/* Sticker — 2× size, left column */}
                  <div className="shrink-0 w-[88px] flex items-center justify-center bg-black/[0.025] dark:bg-white/[0.04] rounded-l-xl">
                    {sticker ? (
                      <img
                        src={sticker.url}
                        alt={sticker.label}
                        className="h-[72px] w-[72px] object-contain"
                        style={{ filter: hue ? `hue-rotate(${hue}deg)` : undefined }}
                      />
                    ) : (
                      <div
                        className="h-[72px] w-[72px] rounded-full text-[18px] font-bold flex items-center justify-center"
                        style={{ backgroundColor: colors.bg, color: colors.text }}
                      >
                        {inits || "?"}
                      </div>
                    )}
                  </div>

                  {/* Right column — name, date, status, leads */}
                  <div className="flex flex-col justify-between flex-1 min-w-0 p-3 gap-1.5">
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-foreground truncate leading-tight">{name}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {status && (
                          <span
                            className="text-[10px] font-medium rounded-full px-1.5 py-0.5 leading-none shrink-0"
                            style={{ backgroundColor: colors.bg, color: colors.text }}
                          >
                            {status}
                          </span>
                        )}
                        {dateLabel && (
                          <span className="text-[10px] text-foreground/40 shrink-0">{dateLabel}</span>
                        )}
                      </div>
                      {leadsCount != null && (
                        <p className="text-[10px] text-foreground/50 mt-1 flex items-center gap-1">
                          <Users className="h-3 w-3 shrink-0 text-foreground/35" />
                          <span className="tabular-nums">{leadsCount.toLocaleString()} {t("detail.leads")}</span>
                        </p>
                      )}
                    </div>

                    {/* Attached contract pill */}
                    {!loadingK && (
                      <div
                        className={cn(
                          "flex items-center gap-1.5 px-2 py-1 rounded-lg border",
                          contract
                            ? "bg-indigo-50/80 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800/40"
                            : "bg-black/[0.03] border-black/[0.05]"
                        )}
                        onClick={(e) => {
                          if (!contract) return;
                          e.stopPropagation();
                          const kid = contract.Id ?? contract.id;
                          if (kid) { try { localStorage.setItem("billing-selected-contract", String(kid)); } catch {} }
                          setLocation(`${routePrefix}/contracts`);
                        }}
                      >
                        <FileText className={cn("h-3 w-3 shrink-0", contract ? "text-indigo-500" : "text-foreground/20")} />
                        {contract ? (
                          <span className="text-[10px] text-indigo-700 dark:text-indigo-300 font-medium truncate flex-1 leading-tight">
                            {contract.title ?? contract.name ?? contract.Name ?? t("related.contract")}
                          </span>
                        ) : (
                          <span className="text-[10px] text-foreground/25 italic">{t("related.noContract")}</span>
                        )}
                        {contract && (contract.status ?? contract.Status) && (
                          <span className="text-[9px] font-medium text-indigo-500 shrink-0 bg-indigo-100/80 dark:bg-indigo-900/40 rounded-full px-1 py-0.5 leading-none">
                            {contract.status ?? contract.Status}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Unlinked contracts — shown only if any contract has no campaign attached */}
      {!loadingK && contracts.some((k: any) => {
        const kCid = k.campaigns_id ?? k.campaignsId ?? k.Campaigns_id;
        return !kCid;
      }) && (
        <div className="border-t border-white/30 pt-3">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">{t("related.unlinkedContracts")}</span>
          </div>
          <ul className="space-y-0">
            {contracts.filter((k: any) => {
              const kCid = k.campaigns_id ?? k.campaignsId ?? k.Campaigns_id;
              return !kCid;
            }).map((k: any, i: number) => {
              const name   = k.title ?? k.name ?? k.Name ?? t("related.unnamed");
              const status = k.status ?? k.Status ?? "";
              const kid    = k.Id ?? k.id;
              return (
                <li
                  key={kid ?? i}
                  className="flex items-center gap-2 py-1.5 px-2 -mx-2 border-b border-border/15 last:border-0 cursor-pointer rounded-lg hover:bg-black/[0.04] transition-colors duration-100"
                  onClick={() => {
                    if (kid) { try { localStorage.setItem("billing-selected-contract", String(kid)); } catch {} }
                    setLocation(`${routePrefix}/contracts`);
                  }}
                >
                  <div
                    className="h-[28px] w-[28px] rounded-full text-[10px] font-bold flex items-center justify-center shrink-0"
                    style={{ backgroundColor: "#E0E7FF", color: "#4338CA" }}
                  >
                    <FileText className="h-3 w-3" />
                  </div>
                  <span className="text-[12px] text-foreground truncate flex-1">{name}</span>
                  {status && (
                    <span className="text-[10px] font-medium text-foreground/50 shrink-0 bg-black/[0.05] rounded-full px-1.5 py-0.5">{status}</span>
                  )}
                  <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
