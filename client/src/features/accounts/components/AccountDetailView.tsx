import { useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import {
  Building2, Phone, Bot, Globe, Clock, FileText, Ban,
  Eye, EyeOff, Copy, Check,
  Plus, Trash2, FileDown,
  Pencil, X, RefreshCw, Camera,
  ChevronRight, ChevronLeft, Megaphone, Users,
  Mic, Upload,
} from "lucide-react";
import { useIsMobile } from "@/hooks/useIsMobile";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/apiUtils";
import { syncInstagramContacts } from "../api/accountsApi";
import { getInitials, getAccountAvatarColor, getCampaignAvatarColor, getUserRoleAvatarColor } from "@/lib/avatarUtils";
import { CAMPAIGN_STICKERS } from "@/assets/campaign-stickers/index";
import { useLocation } from "wouter";
import type { AccountRow } from "./AccountDetailsDialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

// ── Status helpers ─────────────────────────────────────────────────────────────

function getStatusDotCls(status: string): string {
  switch (status) {
    case "Active":    return "bg-emerald-500";
    case "Trial":     return "bg-amber-500";
    case "Suspended": return "bg-rose-500";
    case "Inactive":  return "bg-slate-400";
    default:          return "bg-indigo-400";
  }
}

function getStatusBadgeStyle(status: string): { bg: string; text: string } {
  return getAccountAvatarColor(status);
}

function getStatusIcon(status: string) {
  switch (status) {
    case "Trial":     return <Clock className="w-3 h-3" />;
    case "Suspended": return <Ban className="w-3 h-3" />;
    default:          return null;
  }
}


// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTimeDisplay(val: string | null | undefined): string {
  if (!val) return "";
  const parts = val.split(":");
  if (parts.length < 2) return val;
  const hours = parseInt(parts[0], 10);
  const minutes = parts[1];
  if (isNaN(hours)) return val;
  const ampm = hours >= 12 ? "PM" : "AM";
  const h = hours % 12 === 0 ? 12 : hours % 12;
  return `${String(h).padStart(2, "0")}:${minutes} ${ampm}`;
}

function parseServiceCategories(val: string | null | undefined): string[] {
  if (!val) return [];
  const trimmed = val.trim();
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map((s: unknown) => String(s).trim()).filter(Boolean);
    } catch { /* fall through */ }
  }
  return trimmed.split(",").map((s) => s.trim()).filter(Boolean);
}

// ── Logo Crop Modal ────────────────────────────────────────────────────────────

function LogoCropModal({ srcUrl, onSave, onCancel }: {
  srcUrl: string;
  onSave: (dataUrl: string) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation("accounts");
  const PREVIEW = 240;
  const OUTPUT  = 128;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef    = useRef<HTMLImageElement | null>(null);
  const [zoom, setZoom]     = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragging  = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const pinchRef  = useRef<{ dist: number; zoom: number } | null>(null);

  useEffect(() => {
    const img = new globalThis.Image();
    img.onload = () => {
      imgRef.current = img;
      setZoom(Math.min(PREVIEW / img.width, PREVIEW / img.height));
      setOffset({ x: 0, y: 0 });
    };
    img.src = srcUrl;
  }, [srcUrl]);

  useEffect(() => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, PREVIEW, PREVIEW);
    const w = img.width * zoom;
    const h = img.height * zoom;
    ctx.drawImage(img, (PREVIEW - w) / 2 + offset.x, (PREVIEW - h) / 2 + offset.y, w, h);
  }, [zoom, offset]);

  const handleSave = () => {
    const img = imgRef.current;
    if (!img) return;
    const out = document.createElement("canvas");
    out.width = OUTPUT; out.height = OUTPUT;
    const ctx = out.getContext("2d");
    if (!ctx) return;
    const f = OUTPUT / PREVIEW;
    const w = img.width * zoom * f;
    const h = img.height * zoom * f;
    ctx.drawImage(img, (OUTPUT - w) / 2 + offset.x * f, (OUTPUT - h) / 2 + offset.y * f, w, h);
    onSave(out.toDataURL("image/jpeg", 0.85));
  };

  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging.current) return;
    setOffset({ x: dragStart.current.ox + e.clientX - dragStart.current.x, y: dragStart.current.oy + e.clientY - dragStart.current.y });
  };
  const onMouseUp = () => { dragging.current = false; };

  return (
    <Dialog open onOpenChange={() => onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("detail.cropLogo")}</DialogTitle>
          <DialogDescription>{t("detail.cropDescription")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-2">
          <div className="rounded-full overflow-hidden ring-2 ring-brand-blue/20" style={{ width: PREVIEW, height: PREVIEW }}>
            <canvas
              ref={canvasRef}
              width={PREVIEW}
              height={PREVIEW}
              className="cursor-grab active:cursor-grabbing"
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseUp}
              onTouchStart={(e) => {
                e.preventDefault();
                if (e.touches.length === 1) {
                  const t = e.touches[0];
                  dragging.current = true;
                  dragStart.current = { x: t.clientX, y: t.clientY, ox: offset.x, oy: offset.y };
                }
                if (e.touches.length === 2) {
                  const dx = e.touches[0].clientX - e.touches[1].clientX;
                  const dy = e.touches[0].clientY - e.touches[1].clientY;
                  pinchRef.current = { dist: Math.hypot(dx, dy), zoom };
                }
              }}
              onTouchMove={(e) => {
                e.preventDefault();
                if (e.touches.length === 1 && dragging.current) {
                  const t = e.touches[0];
                  setOffset({ x: dragStart.current.ox + t.clientX - dragStart.current.x, y: dragStart.current.oy + t.clientY - dragStart.current.y });
                }
                if (e.touches.length === 2 && pinchRef.current) {
                  const dx = e.touches[0].clientX - e.touches[1].clientX;
                  const dy = e.touches[0].clientY - e.touches[1].clientY;
                  const newDist = Math.hypot(dx, dy);
                  const scale = newDist / pinchRef.current.dist;
                  const newZoom = Math.min(8, Math.max(0.05, pinchRef.current.zoom * scale));
                  setZoom(newZoom);
                }
              }}
              onTouchEnd={() => {
                dragging.current = false;
                pinchRef.current = null;
              }}
            />
          </div>
          <div className="flex items-center gap-3 w-full px-2">
            <button type="button" onClick={() => setZoom((z) => Math.max(0.05, parseFloat((z - 0.1).toFixed(2))))}
              className="h-6 w-6 rounded-full flex items-center justify-center text-[14px] font-bold text-muted-foreground hover:bg-muted transition-colors select-none shrink-0">−</button>
            <input type="range" min="0.05" max="8" step="0.05" value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))} className="flex-1 accent-brand-blue" />
            <button type="button" onClick={() => setZoom((z) => Math.min(8, parseFloat((z + 0.1).toFixed(2))))}
              className="h-6 w-6 rounded-full flex items-center justify-center text-[14px] font-bold text-muted-foreground hover:bg-muted transition-colors select-none shrink-0">+</button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>{t("detail.cancel")}</Button>
          <Button onClick={handleSave}>{t("detail.saveLogo")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Field display components ───────────────────────────────────────────────────

/** Label above value, with a subtle divider below. Value is below the label. */
function InfoRow({ label, value, editChild }: {
  label: string;
  value?: React.ReactNode;
  editChild?: React.ReactNode;
}) {
  return (
    <div className="py-2.5 border-b border-border/20 last:border-0 last:pb-0">
      <span className="text-[10px] font-medium uppercase tracking-wider text-foreground/40 block leading-none mb-1">
        {label}
      </span>
      <div className="min-h-[1.125rem]">
        {editChild ?? (
          <span className="text-[12px] font-semibold text-foreground leading-snug">
            {value ?? <span className="text-foreground/25 font-normal italic">—</span>}
          </span>
        )}
      </div>
    </div>
  );
}

/** Sub-section header within a widget column */
function SectionHeader({ label, icon: Icon }: { label: string; icon?: React.ElementType }) {
  return (
    <div className="flex items-center gap-1.5 pt-3 mt-1 mb-1 border-t border-white/30">
      {Icon && <Icon className="w-3 h-3 text-foreground/40" />}
      <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">{label}</span>
    </div>
  );
}

// ── Edit input helpers ─────────────────────────────────────────────────────────

function EditText({ value, onChange, placeholder, type = "text" }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full text-[12px] bg-white/60 dark:bg-white/[0.10] border border-brand-blue/30 rounded-lg px-2.5 py-1 outline-none focus:ring-1 focus:ring-brand-blue/40 placeholder:text-foreground/25"
    />
  );
}

function EditSelect({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full text-[12px] bg-white/60 dark:bg-white/[0.10] border border-brand-blue/30 rounded-lg px-2.5 py-1 outline-none focus:ring-1 focus:ring-brand-blue/40"
    >
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function EditTextarea({ value, onChange, placeholder, rows = 3 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full text-[12px] bg-white/60 dark:bg-white/[0.10] border border-brand-blue/30 rounded-lg px-2.5 py-1 resize-none outline-none focus:ring-1 focus:ring-brand-blue/40 placeholder:text-foreground/25 leading-relaxed"
    />
  );
}

// ── Twilio display helpers (read-only mode) ────────────────────────────────────

function MonoValue({ value }: { value?: string | null }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => {
    if (!value) return;
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [value]);
  if (!value) return <span className="text-foreground/25 font-normal italic text-[12px]">—</span>;
  return (
    <span className="flex items-center gap-0.5 min-w-0">
      <span className="text-[11px] font-mono text-foreground truncate">{value}</span>
      <button onClick={copy} className="p-0.5 rounded hover:bg-white/30 dark:hover:bg-white/[0.04] transition-colors text-foreground/40 hover:text-foreground shrink-0">
        {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
      </button>
    </span>
  );
}

function SecretDisplay({ value }: { value?: string | null }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => {
    if (!value) return;
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [value]);
  if (!value) return <span className="text-foreground/25 font-normal italic text-[12px]">—</span>;
  return (
    <span className="flex items-center gap-0.5 min-w-0">
      <span className={cn("text-[11px] font-mono text-foreground truncate", !revealed && "tracking-widest")}>
        {revealed ? value : "••••••••••••"}
      </span>
      <button onClick={() => setRevealed((r) => !r)} className="p-0.5 rounded hover:bg-white/30 dark:hover:bg-white/[0.04] transition-colors text-foreground/40 hover:text-foreground shrink-0">
        {revealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
      </button>
      <button onClick={copy} className="p-0.5 rounded hover:bg-white/30 dark:hover:bg-white/[0.04] transition-colors text-foreground/40 hover:text-foreground shrink-0">
        {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
      </button>
    </span>
  );
}

// ── AccountCampaignsPanel ──────────────────────────────────────────────────────

function AccountCampaignsPanel({ accountId, routePrefix }: { accountId: number; routePrefix: string }) {
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

// ── AccountUsersPanel ──────────────────────────────────────────────────────────

function AccountUsersPanel({ accountId, routePrefix }: { accountId: number; routePrefix: string }) {
  const { t } = useTranslation("accounts");
  const [, setLocation] = useLocation();
  const [users, setUsers]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Picker state
  const [pickerOpen, setPickerOpen]       = useState(false);
  const [allUsers, setAllUsers]           = useState<any[]>([]);
  const [pickerSearch, setPickerSearch]   = useState("");
  const [pickerLoading, setPickerLoading] = useState(false);
  const [assigning, setAssigning]         = useState<number | null>(null);

  const refreshUsers = useCallback(() => {
    if (!accountId) return;
    setLoading(true);
    apiFetch("/api/users")
      .then((res) => res.json())
      .then((data: any) => {
        const all: any[] = Array.isArray(data) ? data : (data?.list ?? data?.data ?? []);
        setUsers(all.filter((u: any) => {
          const uid = u.accountsId ?? u.Accounts_id ?? u.accounts_id ?? u.account_id;
          return uid === accountId;
        }));
      })
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, [accountId]);

  useEffect(() => { refreshUsers(); }, [refreshUsers]);

  const openPicker = useCallback(async () => {
    setPickerOpen(true);
    setPickerSearch("");
    setPickerLoading(true);
    try {
      const res  = await apiFetch("/api/users");
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data?.list ?? data?.data ?? []);
      setAllUsers(list);
    } catch {
      setAllUsers([]);
    } finally {
      setPickerLoading(false);
    }
  }, []);

  const handleAssign = useCallback(async (user: any) => {
    const uid = user.id ?? user.Id;
    if (!uid) return;
    setAssigning(uid);
    try {
      await apiFetch(`/api/users/${uid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Accounts_id: accountId }),
      });
      setPickerOpen(false);
      refreshUsers();
    } catch (e) {
      console.error("Failed to assign user", e);
    } finally {
      setAssigning(null);
    }
  }, [accountId, refreshUsers]);

  const alreadyAssignedIds = new Set(users.map((u: any) => u.id ?? u.Id));
  const pickerFiltered = allUsers
    .filter((u: any) => !alreadyAssignedIds.has(u.id ?? u.Id))
    .filter((u: any) => {
      if (!pickerSearch.trim()) return true;
      const name = u.full_name ?? u.name ?? u.email ?? "";
      return name.toLowerCase().includes(pickerSearch.toLowerCase());
    });

  return (
    <div>

      {/* User picker dialog */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("related.addUser")}</DialogTitle>
            <DialogDescription>{t("related.pickUser")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <input
              autoFocus
              value={pickerSearch}
              onChange={(e) => setPickerSearch(e.target.value)}
              placeholder={t("related.searchUsers")}
              className="w-full text-[12px] bg-white dark:bg-popover border border-border/40 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-brand-indigo/40"
            />
            <div className="max-h-60 overflow-y-auto">
              {pickerLoading ? (
                <div className="space-y-1.5 py-2">
                  {[1, 2, 3].map((i) => <div key={i} className="h-8 rounded bg-muted animate-pulse" />)}
                </div>
              ) : pickerFiltered.length === 0 ? (
                <p className="text-[12px] text-foreground/40 italic py-6 text-center">{t("related.noUsersAvailable")}</p>
              ) : (
                <div className="space-y-0.5">
                  {pickerFiltered.map((u: any) => {
                    const uid   = u.id ?? u.Id;
                    const name  = u.full_name ?? u.name ?? u.email ?? t("related.unknown");
                    const email = u.email ?? "";
                    const role  = u.role ?? u.Role ?? "";
                    return (
                      <button
                        key={uid}
                        onClick={() => handleAssign(u)}
                        disabled={assigning === uid}
                        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left hover:bg-muted/60 transition-colors disabled:opacity-50"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] text-foreground font-medium truncate">{name}</p>
                          {email && name !== email && (
                            <p className="text-[10px] text-foreground/40 truncate">{email}</p>
                          )}
                        </div>
                        {role && (
                          <span className="text-[10px] text-foreground/50 shrink-0 bg-black/[0.05] rounded-full px-1.5 py-0.5">{role}</span>
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

      {/* Members header */}
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">{t("related.members")}</span>
        {!loading && (
          <span className="text-[10px] font-semibold text-foreground/40 bg-black/[0.05] rounded-full px-1.5 py-0.5">{users.length}</span>
        )}
        <button
          onClick={openPicker}
          title={t("related.addUser")}
          className="ml-auto h-5 w-5 rounded-full flex items-center justify-center bg-black/[0.06] hover:bg-brand-indigo hover:text-white text-foreground/50 transition-colors"
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>

      {/* Users list */}
      {loading ? (
        <div className="space-y-1.5">
          {[1, 2, 3].map((i) => <div key={i} className="h-6 rounded bg-black/[0.05] animate-pulse" />)}
        </div>
      ) : users.length === 0 ? (
        <p className="text-[11px] text-foreground/30 italic">{t("related.noUsersAssigned")}</p>
      ) : (
        <ul className="space-y-0">
          {[...users].sort((a: any, b: any) => {
            const roleOrder: Record<string, number> = { Admin: 0, Operator: 1, Manager: 2, Agent: 3, Viewer: 4 };
            const ra = roleOrder[a.role ?? a.Role ?? ""] ?? 5;
            const rb = roleOrder[b.role ?? b.Role ?? ""] ?? 5;
            return ra - rb;
          }).map((u: any, i: number) => {
            const name    = u.full_name ?? u.fullName1 ?? u.name ?? u.email ?? u.username ?? t("related.unknown");
            const email   = u.email ?? "";
            const role    = u.role ?? u.Role ?? "";
            const uid     = u.id ?? u.Id;
            const photo   = u.avatarUrl ?? u.avatar_url ?? null;
            const colors  = getUserRoleAvatarColor(role);
            const inits   = getInitials(name);
            // Role → ring color
            const ringColor: Record<string, string> = {
              Admin:    "#B45309",
              Operator: "#C2410C",
              Manager:  "#1D4ED8",
              Agent:    "#6D28D9",
              Viewer:   "#6B7280",
            };
            const ring = ringColor[role] ?? "#9CA3AF";
            return (
              <li
                key={uid ?? i}
                className="flex items-center gap-2 py-1.5 px-2 -mx-2 border-b border-border/15 last:border-0 cursor-pointer rounded-lg hover:bg-black/[0.04] transition-colors duration-100"
                onClick={() => {
                  sessionStorage.setItem("pendingSettingsSection", "team");
                  if (uid) sessionStorage.setItem("pendingUserSelection", String(uid));
                  setLocation(`${routePrefix}/settings`);
                }}
              >
                <div
                  className="h-[34px] w-[34px] rounded-full text-[11px] font-bold flex items-center justify-center shrink-0 overflow-hidden"
                  style={photo
                    ? { outline: `2.5px solid ${ring}`, outlineOffset: "1.5px" }
                    : { backgroundColor: colors.bg, color: colors.text, outline: `2.5px solid ${ring}`, outlineOffset: "1.5px" }
                  }
                >
                  {photo
                    ? <img src={photo} alt={name} className="h-full w-full object-cover" />
                    : (inits || "?")
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] text-foreground truncate">{name}</p>
                  {email && name !== email && (
                    <p className="text-[10px] text-foreground/40 truncate">{email}</p>
                  )}
                </div>
                {role && (
                  <span
                    className="text-[10px] font-semibold shrink-0 rounded-full px-1.5 py-0.5"
                    style={{ backgroundColor: colors.bg, color: colors.text }}
                  >{role}</span>
                )}
                <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────

export function AccountDetailViewEmpty({ toolbarPrefix }: { toolbarPrefix?: ReactNode }) {
  const { t } = useTranslation("accounts");
  return (
    <div className="flex-1 flex flex-col">
      {toolbarPrefix && (
        <div className="shrink-0 px-4 pt-5 pb-3">
          <div className="flex items-center gap-1 flex-wrap">
            {toolbarPrefix}
          </div>
        </div>
      )}
      <div className="flex-1 flex flex-col items-center justify-center gap-5 p-8 text-center">
        <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-stone-50 to-gray-100 flex items-center justify-center ring-1 ring-stone-200/50">
          <Building2 className="h-10 w-10 text-stone-400" />
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-semibold text-foreground/70">{t("empty.title")}</p>
          <p className="text-xs text-muted-foreground max-w-[180px] leading-relaxed">
            {t("empty.description")}
          </p>
        </div>
        <div className="text-[11px] text-stone-400 font-medium">{t("empty.chooseFromList")}</div>
      </div>
    </div>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_OPTIONS   = ["Active", "Trial", "Inactive", "Suspended"];
const TYPE_OPTIONS     = ["Agency", "Client"];
const TIMEZONE_OPTIONS = [
  "America/Sao_Paulo",
  "Europe/Amsterdam",
];

// ── Draft type ────────────────────────────────────────────────────────────────

type AccountDraft = {
  name: string; status: string; type: string; business_niche: string;
  owner_email: string; phone: string; website: string; address: string; tax_id: string;
  business_description: string; notes: string; service_categories: string;
  default_ai_name: string; default_ai_role: string; default_ai_style: string;
  default_typo_frequency: string; opt_out_keyword: string; preferred_terminology: string;
  timezone: string; business_hours_start: string; business_hours_end: string; max_daily_sends: string;
  twilio_account_sid: string; twilio_auth_token: string; twilio_messaging_service_sid: string;
  twilio_default_from_number: string; webhook_url: string; webhook_secret: string; logo_url: string;
  instagram_user_id: string; instagram_access_token: string;
};

// ── Voice Clone Widget ───────────────────────────────────────────────────────

const VOICE_MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const VOICE_ACCEPT = "audio/*";

function formatVoiceFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function VoiceCloneWidget({
  voiceFileData,
  voiceFileName,
  accountId,
  onSave,
}: {
  voiceFileData: string | null;
  voiceFileName: string | null;
  accountId: number;
  onSave: (field: string, value: string) => Promise<void>;
}) {
  const { t } = useTranslation("accounts");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasVoice = Boolean(voiceFileData);
  const voiceId = `account_${accountId}`;

  const processFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("audio/")) {
      alert(t("detail.pleaseUploadAudio"));
      return;
    }
    if (file.size > VOICE_MAX_SIZE) {
      alert(t("detail.fileSizeLimit"));
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
      });
      await onSave("voice_file_data", dataUrl);
      await onSave("voice_file_name", file.name);
    } catch (e) {
      console.error("Voice upload failed", e);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [onSave]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleRemove = useCallback(async () => {
    setUploading(true);
    try {
      await onSave("voice_file_data", "");
      await onSave("voice_file_name", "");
    } catch (e) {
      console.error("Voice remove failed", e);
    } finally {
      setUploading(false);
    }
  }, [onSave]);

  return (
    <div className="bg-white/60 dark:bg-white/[0.10] rounded-xl p-4 flex flex-col min-h-full" data-testid="account-widget-voice">
      <div className="flex items-center gap-2 mb-3">
        <Mic className="w-5 h-5 text-foreground/50" />
        <p className="text-[18px] font-semibold font-heading text-foreground">{t("detail.voiceClone")}</p>
      </div>

      {hasVoice ? (
        <div className="space-y-3">
          {/* File info + remove */}
          <div className="flex items-center gap-2 rounded-lg bg-foreground/[0.03] border border-foreground/[0.06] px-3 py-2">
            <Mic className="w-4 h-4 text-brand-indigo shrink-0" />
            <span className="text-[13px] text-foreground/70 truncate flex-1">
              {voiceFileName || t("detail.voiceFile")}
            </span>
            <button
              onClick={handleRemove}
              disabled={uploading}
              className="ml-auto p-1 rounded hover:bg-red-50 text-foreground/40 hover:text-red-500 transition-colors"
              title={t("detail.removeVoice")}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Audio player */}
          <audio
            controls
            src={voiceFileData ?? undefined}
            className="w-full h-10 rounded-lg"
            style={{ colorScheme: "light" }}
          />

          {/* Voice ID hint */}
          <div className="rounded-lg bg-brand-indigo/5 border border-brand-indigo/10 px-3 py-2">
            <p className="text-[11px] text-foreground/40 uppercase tracking-wider font-medium mb-0.5">
              {t("detail.voiceIdForCampaigns")}
            </p>
            <p className="text-[13px] font-mono text-brand-indigo font-medium">{voiceId}</p>
          </div>
        </div>
      ) : (
        <>
          {/* Drop zone */}
          <div
            onClick={() => !uploading && fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={cn(
              "flex-1 flex flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors cursor-pointer min-h-[200px]",
              dragOver
                ? "border-brand-indigo bg-brand-indigo/5"
                : "border-foreground/[0.08] hover:border-foreground/20 hover:bg-foreground/[0.01]",
              uploading && "pointer-events-none opacity-50",
            )}
          >
            {uploading ? (
              <RefreshCw className="w-8 h-8 text-foreground/20 animate-spin" />
            ) : (
              <>
                <Upload className="w-8 h-8 text-foreground/20 mb-2" />
                <p className="text-[13px] text-foreground/40 font-medium">
                  {t("detail.clickOrDragAudio")}
                </p>
                <p className="text-[11px] text-foreground/25 mt-1">
                  {t("detail.voiceFormats")}
                </p>
              </>
            )}
          </div>

          {/* Voice ID hint (shown even before upload) */}
          <div className="rounded-lg bg-foreground/[0.02] border border-foreground/[0.06] px-3 py-2 mt-3">
            <p className="text-[11px] text-foreground/30 uppercase tracking-wider font-medium mb-0.5">
              {t("detail.voiceIdWillBe")}
            </p>
            <p className="text-[13px] font-mono text-foreground/40 font-medium">{voiceId}</p>
          </div>
        </>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={VOICE_ACCEPT}
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

interface AccountDetailViewProps {
  account: AccountRow;
  onSave: (field: string, value: string) => Promise<void>;
  onAddAccount: () => void;
  onDelete: () => void;
  onToggleStatus: (account: AccountRow) => void;
  toolbarPrefix?: ReactNode;
  onBack?: () => void;
}

export function AccountDetailView({ account, onSave, onAddAccount, onDelete, onToggleStatus, toolbarPrefix, onBack }: AccountDetailViewProps) {
  const { t } = useTranslation("accounts");
  const isMobile   = useIsMobile();
  const status     = String(account.status || t("status.unknown"));
  const badgeStyle = getStatusBadgeStyle(status);
  const accountId  = account.Id ?? account.id ?? 0;
  const [location] = useLocation();
  const routePrefix = location.startsWith("/subaccount") ? "/subaccount" : "/agency";

  // ── Edit state ──────────────────────────────────────────────────────────────
  const [isEditing, setIsEditing] = useState(false);
  const [draft,     setDraft]     = useState<AccountDraft>({} as AccountDraft);
  const [saving,    setSaving]    = useState(false);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const [cropSrc,    setCropSrc]    = useState<string | null>(null);

  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [leadCount, setLeadCount] = useState<number | null>(null);

  // ── Instagram sync state ──────────────────────────────────────────────────
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    const id = (account as any).Id ?? (account as any).id;
    if (!id) return;
    setLeadCount(null);
    apiFetch(`/api/leads?accountId=${id}&page=1&limit=1`)
      .then((data: any) => {
        const total = data?.total ?? data?.pagination?.total ?? null;
        setLeadCount(typeof total === "number" ? total : null);
      })
      .catch(() => setLeadCount(null));
  }, [(account as any).Id ?? (account as any).id]);

  // ── Instagram sync handler ─────────────────────────────────────────────────
  const handleSyncInstagram = async () => {
    const id = (account as any).Id ?? (account as any).id;
    if (!id) return;
    setSyncing(true);
    setSyncResult(null);
    setSyncError(null);
    try {
      const result = await syncInstagramContacts(id);
      setSyncResult(result);
    } catch (err: any) {
      setSyncError(err.message || "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  // ── Edit handlers ───────────────────────────────────────────────────────────
  const startEdit = useCallback(() => {
    setDraft({
      name:                       String(account.name                    || ""),
      status:                     String(account.status                  || ""),
      type:                       String(account.type                    || ""),
      business_niche:             String(account.business_niche          || ""),
      owner_email:                String(account.owner_email             || ""),
      phone:                      String(account.phone                   || ""),
      website:                    String(account.website                 || ""),
      address:                    String(account.address                 || ""),
      tax_id:                     String(account.tax_id                  || ""),
      business_description:       String(account.business_description    || ""),
      notes:                      String(account.notes                   || ""),
      service_categories:         String(account.service_categories      || ""),
      default_ai_name:            String(account.default_ai_name         || ""),
      default_ai_role:            String(account.default_ai_role         || ""),
      default_ai_style:           String(account.default_ai_style        || ""),
      default_typo_frequency:     String(account.default_typo_frequency  || ""),
      opt_out_keyword:            String(account.opt_out_keyword         || ""),
      preferred_terminology:      String(account.preferred_terminology   || ""),
      timezone:                   String(account.timezone                || "UTC"),
      business_hours_start:       String(account.business_hours_start    || ""),
      business_hours_end:         String(account.business_hours_end      || ""),
      max_daily_sends:            account.max_daily_sends != null ? String(account.max_daily_sends) : "",
      twilio_account_sid:         String(account.twilio_account_sid           || ""),
      twilio_auth_token:          String(account.twilio_auth_token            || ""),
      twilio_messaging_service_sid: String(account.twilio_messaging_service_sid || ""),
      twilio_default_from_number: String(account.twilio_default_from_number   || ""),
      webhook_url:                String(account.webhook_url                  || ""),
      webhook_secret:             String(account.webhook_secret               || ""),
      logo_url:                   String(account.logo_url                     || ""),
      instagram_user_id:          String(account.instagram_user_id            || ""),
      instagram_access_token:     String(account.instagram_access_token       || ""),
    });
    setIsEditing(true);
  }, [account]);

  const cancelEdit = useCallback(() => {
    setIsEditing(false);
    setDraft({} as AccountDraft);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      for (const [field, value] of Object.entries(draft) as [keyof AccountDraft, string][]) {
        const current = String((account as any)[field] ?? "");
        if (value !== current) {
          await onSave(field, value);
        }
      }
      setIsEditing(false);
      setDraft({} as AccountDraft);
    } catch (e) {
      console.error("Save failed", e);
    } finally {
      setSaving(false);
    }
  }, [draft, account, onSave]);

  const set = useCallback((field: keyof AccountDraft, value: string) => {
    setDraft((d) => ({ ...d, [field]: value }));
  }, []);

  // Helper: get current value (draft when editing, account otherwise)
  const val = useCallback((field: keyof AccountDraft): string => {
    if (isEditing) return draft[field] ?? "";
    return String((account as any)[field] ?? "");
  }, [isEditing, draft, account]);

  const handleDelete = useCallback(() => {
    if (deleteConfirm) { onDelete(); setDeleteConfirm(false); }
    else { setDeleteConfirm(true); setTimeout(() => setDeleteConfirm(false), 3000); }
  }, [deleteConfirm, onDelete]);

  const handlePDF = useCallback(() => { window.print(); }, []);

  const handleLogoFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (logoInputRef.current) logoInputRef.current.value = "";
    setCropSrc(URL.createObjectURL(file));
  }, []);

  const handleCropSave = useCallback(async (dataUrl: string) => {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
    await onSave("logo_url", dataUrl);
  }, [cropSrc, onSave]);

  const handleCropCancel = useCallback(() => {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  }, [cropSrc]);

  const handleRemoveLogo = useCallback(async () => {
    await onSave("logo_url", "");
  }, [onSave]);

  const initials = getInitials(account.name || "?");

  const serviceCategories = parseServiceCategories(account.service_categories);

  // Display status badge uses live account status (not draft — badge updates after save)
  const displayStatus     = isEditing ? (draft.status || status) : status;
  const displayBadgeStyle = getStatusBadgeStyle(displayStatus);

  return (
    <div className="relative flex flex-col h-full overflow-hidden" data-testid="account-detail-view">

      {/* ── Full-height warm gradient ── */}
      <div className="absolute inset-0 bg-popover dark:bg-background" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_180%_123%_at_78%_83%,rgba(255,193,193,0.8)_0%,transparent_69%)] dark:opacity-[0.08]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_200%_200%_at_2%_2%,#d0f8ff_5%,transparent_30%)] dark:opacity-[0.08]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_96%_80%_at_49%_51%,rgba(203,203,241,0.8)_0%,transparent_66%)] dark:opacity-[0.08]" />

      {/* ── Header ── */}
      <div className="shrink-0 relative z-10">
        <div className="relative px-4 pt-6 pb-4 md:pb-10 space-y-3 max-w-[1386px] w-full mr-auto">

          {/* Row 1: Toolbar */}
          <div className="flex items-center gap-1">
            {onBack && (
              <button
                onClick={onBack}
                className="md:hidden h-9 w-9 rounded-full border border-black/[0.125] bg-background grid place-items-center shrink-0 mr-2"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            {toolbarPrefix}

            <div className="flex-1 min-w-0" />

            {/* Edit / Save / Cancel + PDF + Delete — far right */}
            <div className="flex items-center gap-1 shrink-0">
              {isEditing ? (
                <>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="group inline-flex items-center h-9 pl-[9px] rounded-full border text-[12px] font-medium overflow-hidden shrink-0 transition-[max-width,color,border-color] duration-200 max-w-9 hover:max-w-[80px] border-brand-indigo text-brand-indigo disabled:opacity-50"
                  >
                    {saving ? <RefreshCw className="h-4 w-4 shrink-0 animate-spin" /> : <Check className="h-4 w-4 shrink-0" />}
                    <span className="whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                      {saving ? t("detail.saving") : t("detail.save")}
                    </span>
                  </button>
                  <button
                    onClick={cancelEdit}
                    disabled={saving}
                    className="group inline-flex items-center h-9 pl-[9px] rounded-full border text-[12px] font-medium overflow-hidden shrink-0 transition-[max-width,color,border-color] duration-200 max-w-9 hover:max-w-[100px] border-black/[0.125] text-foreground/60 hover:text-foreground"
                  >
                    <X className="h-4 w-4 shrink-0" />
                    <span className="whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">{t("detail.cancel")}</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={startEdit}
                  className="group inline-flex items-center h-9 pl-[9px] rounded-full border text-[12px] font-medium overflow-hidden shrink-0 transition-[max-width,color,border-color] duration-200 max-w-9 hover:max-w-[80px] border-black/[0.125] text-foreground/60 hover:text-foreground"
                >
                  <Pencil className="h-4 w-4 shrink-0" />
                  <span className="whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">{t("detail.edit")}</span>
                </button>
              )}

              <button
                onClick={handlePDF}
                className="group inline-flex items-center h-9 pl-[9px] rounded-full border text-[12px] font-medium overflow-hidden shrink-0 transition-[max-width,color,border-color] duration-200 max-w-9 hover:max-w-[80px] border-black/[0.125] text-foreground/60 hover:text-foreground"
              >
                <FileDown className="h-4 w-4 shrink-0" />
                <span className="whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">PDF</span>
              </button>
              <button
                onClick={handleDelete}
                className={cn(
                  "group inline-flex items-center h-9 pl-[9px] rounded-full border text-[12px] font-medium overflow-hidden shrink-0 transition-[max-width,color,border-color] duration-200 max-w-9 hover:max-w-[100px]",
                  deleteConfirm
                    ? "border-red-400/60 text-red-600"
                    : "border-black/[0.125] text-foreground/60 hover:text-foreground"
                )}
              >
                <Trash2 className="h-4 w-4 shrink-0" />
                <span className="whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  {deleteConfirm ? t("detail.confirm") : t("toolbar.delete")}
                </span>
              </button>
            </div>
          </div>

          {/* Row 2: Avatar + Name + badges */}
          <div className="flex items-start gap-3">
            {/* Logo circle — click to upload */}
            <div className="relative group shrink-0">
              <div
                className="h-[72px] w-[72px] rounded-full flex items-center justify-center text-xl font-bold overflow-hidden cursor-pointer"
                style={account.logo_url ? {} : { backgroundColor: displayBadgeStyle.bg, color: displayBadgeStyle.text }}
                onClick={() => logoInputRef.current?.click()}
                title={t("detail.clickToUploadLogo")}
              >
                {account.logo_url ? (
                  <img src={account.logo_url} alt="logo" className="h-full w-full object-cover" />
                ) : (
                  initials || <Building2 className="w-6 h-6" />
                )}
              </div>
              {/* Hover overlay */}
              <div
                className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer pointer-events-none"
              >
                <Camera className="w-5 h-5 text-white" />
              </div>
              {/* Remove button — hover-only, top-right */}
              {account.logo_url && !cropSrc && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleRemoveLogo(); }}
                  title={t("detail.removeLogo")}
                  className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-white dark:bg-card border border-black/[0.125] flex items-center justify-center text-foreground/50 hover:text-red-500 hover:border-red-300 transition-colors z-10 opacity-0 group-hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoFile}
            />

            <div className="flex-1 min-w-0 py-1">
              {isEditing ? (
                <input
                  value={draft.name}
                  onChange={(e) => set("name", e.target.value)}
                  className="text-[20px] md:text-[27px] font-semibold font-heading bg-transparent border-b-2 border-brand-blue outline-none w-full leading-tight"
                  placeholder={t("fields.accountName")}
                  data-testid="account-detail-name-input"
                />
              ) : (
                <h2
                  className="text-[20px] md:text-[27px] font-semibold font-heading text-foreground leading-tight truncate"
                  data-testid="account-detail-name"
                >
                  {account.name || t("detail.unnamedAccount")}
                </h2>
              )}

              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
                  style={{ backgroundColor: displayBadgeStyle.bg, color: displayBadgeStyle.text }}
                >
                  <span className={cn("w-1.5 h-1.5 rounded-full", getStatusDotCls(displayStatus))} />
                  {getStatusIcon(displayStatus)}
                  {displayStatus}
                </span>
                {leadCount !== null && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-black/[0.06] text-foreground/55">
                    {leadCount} {leadCount === 1 ? t("detail.lead") : t("detail.leads")}
                  </span>
                )}
                {(isEditing ? draft.type : account.type) && (
                  <span className={cn(
                    "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border",
                    (isEditing ? draft.type : account.type) === "Agency"
                      ? "bg-brand-blue/[0.08] border-brand-blue/20 text-brand-blue"
                      : "border-border/50 text-foreground/60"
                  )}>
                    {isEditing ? draft.type : account.type}
                  </span>
                )}
                {account.business_niche && !isEditing && (
                  <span className="text-[11px] text-foreground/50 truncate">{account.business_niche}</span>
                )}
                <span className="text-[11px] text-foreground/40">#{accountId}</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── Body: scrollable with fade ── */}
      <div
        className="relative flex-1 overflow-y-auto min-h-0 -mt-[80px] pt-[83px] px-[3px] pb-[3px] flex flex-col gap-[3px]"
        style={{
          maskImage: "linear-gradient(to bottom, transparent 0px, black 83px)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent 0px, black 83px)",
        }}
      >

        {/* Top row: Overview | Campaigns & Contracts | Users */}
        <div
          className={cn("grid gap-[3px]", isMobile ? "grid-cols-1" : "grid-cols-3", "max-w-[1386px] w-full mr-auto")}
          style={isMobile ? undefined : { gridTemplateColumns: "1fr 1fr 1fr" }}
        >

          {/* Column 1: Overview */}
          <div className={cn("overflow-y-auto rounded-xl", isMobile ? "min-h-[300px]" : "h-[720px]")} style={isMobile ? undefined : { height: 720 }}>
            <div className="bg-white/60 dark:bg-white/[0.10] rounded-xl p-4 flex flex-col min-h-full" data-testid="account-widget-basic">
              <p className="text-[18px] font-semibold font-heading text-foreground mb-3">{t("detail.overview")}</p>

              <InfoRow
                label={t("fields.status")}
                value={val("status")}
                editChild={isEditing ? <EditSelect value={val("status")} onChange={(v) => set("status", v)} options={STATUS_OPTIONS} /> : undefined}
              />
              <InfoRow
                label={t("fields.type")}
                value={val("type")}
                editChild={isEditing ? <EditSelect value={val("type")} onChange={(v) => set("type", v)} options={TYPE_OPTIONS} /> : undefined}
              />
              <InfoRow
                label={t("columns.niche")}
                value={val("business_niche")}
                editChild={isEditing ? <EditText value={val("business_niche")} onChange={(v) => set("business_niche", v)} placeholder={t("fields.businessNichePlaceholder")} /> : undefined}
              />

              <SectionHeader label={t("sections.contact")} icon={Phone} />

              <InfoRow
                label={t("fields.email")}
                value={val("owner_email")}
                editChild={isEditing ? <EditText value={val("owner_email")} onChange={(v) => set("owner_email", v)} type="email" placeholder={t("fields.ownerEmailPlaceholder")} /> : undefined}
              />
              <InfoRow
                label={t("fields.phone")}
                value={val("phone")}
                editChild={isEditing ? <EditText value={val("phone")} onChange={(v) => set("phone", v)} type="tel" placeholder={t("fields.phonePlaceholder")} /> : undefined}
              />
              <InfoRow
                label={t("fields.website")}
                value={val("website")}
                editChild={isEditing ? <EditText value={val("website")} onChange={(v) => set("website", v)} type="url" placeholder={t("fields.websitePlaceholder")} /> : undefined}
              />
              <InfoRow
                label={t("fields.address")}
                value={val("address")}
                editChild={isEditing ? <EditText value={val("address")} onChange={(v) => set("address", v)} placeholder="Street, City, Country" /> : undefined}
              />
              <InfoRow
                label={t("fields.taxId")}
                value={val("tax_id")}
                editChild={isEditing ? <EditText value={val("tax_id")} onChange={(v) => set("tax_id", v)} placeholder="Tax identifier" /> : undefined}
              />

              <SectionHeader label={t("sections.notes")} icon={FileText} />

              <InfoRow
                label={t("fields.description")}
                value={val("business_description")}
                editChild={isEditing ? <EditTextarea value={val("business_description")} onChange={(v) => set("business_description", v)} placeholder="Business description…" rows={3} /> : undefined}
              />
              <InfoRow
                label={t("columns.notes")}
                value={val("notes")}
                editChild={isEditing ? <EditTextarea value={val("notes")} onChange={(v) => set("notes", v)} placeholder="Internal notes…" rows={3} /> : undefined}
              />
              <InfoRow
                label={t("fields.serviceCategories")}
                value={
                  serviceCategories.length > 0 ? (
                    <span className="flex flex-wrap gap-1 mt-0.5">
                      {serviceCategories.map((cat, i) => (
                        <span key={i} className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary border border-primary/20">
                          {cat}
                        </span>
                      ))}
                    </span>
                  ) : undefined
                }
                editChild={isEditing ? <EditText value={val("service_categories")} onChange={(v) => set("service_categories", v)} placeholder="Comma-separated list" /> : undefined}
              />
            </div>
          </div>

          {/* Column 2: Campaigns & Contracts */}
          <div className={cn("overflow-y-auto rounded-xl", isMobile ? "min-h-[300px]" : "h-[720px]")} style={isMobile ? undefined : { height: 720 }}>
            <div className="bg-white/60 dark:bg-white/[0.10] rounded-xl p-4 min-h-full" data-testid="account-widget-campaigns">
              <p className="text-[18px] font-semibold font-heading text-foreground mb-3">{t("detail.campaignsAndContracts")}</p>
              <AccountCampaignsPanel accountId={accountId} routePrefix={routePrefix} />
            </div>
          </div>

          {/* Column 3: Users */}
          <div className={cn("overflow-y-auto rounded-xl", isMobile ? "min-h-[300px]" : "h-[720px]")} style={isMobile ? undefined : { height: 720 }}>
            <div className="bg-white/60 dark:bg-white/[0.10] rounded-xl p-4 min-h-full" data-testid="account-widget-users">
              <p className="text-[18px] font-semibold font-heading text-foreground mb-3">{t("related.users")}</p>
              <AccountUsersPanel accountId={accountId} routePrefix={routePrefix} />
            </div>
          </div>

        </div>

        {/* Bottom row: AI & Schedule | Twilio | Placeholder */}
        <div
          className={cn("grid gap-[3px]", isMobile ? "grid-cols-1" : "grid-cols-3", "max-w-[1386px] w-full mr-auto")}
          style={isMobile ? undefined : { gridTemplateColumns: "1fr 1fr 1fr" }}
        >

          {/* Bottom Col 1: AI & Schedule */}
          <div className={cn("overflow-y-auto rounded-xl", isMobile ? "min-h-[300px]" : "h-[720px]")} style={isMobile ? undefined : { height: 720 }}>
            <div className="bg-white/60 dark:bg-white/[0.10] rounded-xl p-4 flex flex-col min-h-full" data-testid="account-widget-ai">
              <p className="text-[18px] font-semibold font-heading text-foreground mb-3">{t("detail.aiAndSchedule")}</p>

              <SectionHeader label={t("sections.aiConfig")} icon={Bot} />

              <InfoRow
                label={t("fields.aiName")}
                value={val("default_ai_name")}
                editChild={isEditing ? <EditText value={val("default_ai_name")} onChange={(v) => set("default_ai_name", v)} placeholder="e.g. Alex" /> : undefined}
              />
              <InfoRow
                label={t("fields.aiRole")}
                value={val("default_ai_role")}
                editChild={isEditing ? <EditText value={val("default_ai_role")} onChange={(v) => set("default_ai_role", v)} placeholder="e.g. Sales Assistant" /> : undefined}
              />
              <InfoRow
                label={t("fields.aiStyle")}
                value={val("default_ai_style")}
                editChild={isEditing ? <EditText value={val("default_ai_style")} onChange={(v) => set("default_ai_style", v)} placeholder="e.g. Friendly, Professional" /> : undefined}
              />
              <InfoRow
                label={t("fields.typoFrequency")}
                value={val("default_typo_frequency")}
                editChild={isEditing ? <EditText value={val("default_typo_frequency")} onChange={(v) => set("default_typo_frequency", v)} placeholder="e.g. Low" /> : undefined}
              />
              <InfoRow
                label={t("fields.optOutKeyword")}
                value={val("opt_out_keyword")}
                editChild={isEditing ? <EditText value={val("opt_out_keyword")} onChange={(v) => set("opt_out_keyword", v)} placeholder="e.g. STOP" /> : undefined}
              />
              <InfoRow
                label={t("fields.terminology")}
                value={val("preferred_terminology")}
                editChild={isEditing ? <EditText value={val("preferred_terminology")} onChange={(v) => set("preferred_terminology", v)} placeholder="e.g. prospects, clients" /> : undefined}
              />

              <SectionHeader label={t("sections.schedule")} icon={Clock} />

              <InfoRow
                label={t("fields.timezone")}
                value={val("timezone")}
                editChild={isEditing ? <EditSelect value={val("timezone")} onChange={(v) => set("timezone", v)} options={TIMEZONE_OPTIONS} /> : undefined}
              />
              <InfoRow
                label={t("fields.hoursOpen")}
                value={formatTimeDisplay(val("business_hours_start")) || val("business_hours_start")}
                editChild={isEditing ? <EditText value={val("business_hours_start")} onChange={(v) => set("business_hours_start", v)} type="time" /> : undefined}
              />
              <InfoRow
                label={t("fields.hoursClose")}
                value={formatTimeDisplay(val("business_hours_end")) || val("business_hours_end")}
                editChild={isEditing ? <EditText value={val("business_hours_end")} onChange={(v) => set("business_hours_end", v)} type="time" /> : undefined}
              />
              <InfoRow
                label={t("fields.dailySends")}
                value={val("max_daily_sends")}
                editChild={isEditing ? <EditText value={val("max_daily_sends")} onChange={(v) => set("max_daily_sends", v)} type="number" placeholder="0" /> : undefined}
              />
            </div>
          </div>

          {/* Bottom Col 2: Integrations */}
          <div className={cn("overflow-y-auto rounded-xl", isMobile ? "min-h-[300px]" : "h-[720px]")} style={isMobile ? undefined : { height: 720 }}>
            <div className="bg-white/60 dark:bg-white/[0.10] rounded-xl p-4 flex flex-col min-h-full" data-testid="account-widget-twilio">
              <p className="text-[18px] font-semibold font-heading text-foreground mb-3">{t("detail.integrations")}</p>

              <SectionHeader label="Twilio" icon={Globe} />

              <InfoRow
                label={t("fields.accountSid")}
                value={<MonoValue value={val("twilio_account_sid")} />}
                editChild={isEditing ? <EditText value={val("twilio_account_sid")} onChange={(v) => set("twilio_account_sid", v)} placeholder="ACxxxxxxxxxxxxxxxx" /> : undefined}
              />
              <InfoRow
                label={t("fields.authToken")}
                value={<SecretDisplay value={val("twilio_auth_token")} />}
                editChild={isEditing ? <EditText value={val("twilio_auth_token")} onChange={(v) => set("twilio_auth_token", v)} type="password" placeholder="Auth token" /> : undefined}
              />
              <InfoRow
                label={t("fields.serviceSid")}
                value={<MonoValue value={val("twilio_messaging_service_sid")} />}
                editChild={isEditing ? <EditText value={val("twilio_messaging_service_sid")} onChange={(v) => set("twilio_messaging_service_sid", v)} placeholder="MGxxxxxxxxxxxxxxxx" /> : undefined}
              />
              <InfoRow
                label={t("fields.fromNumber")}
                value={<MonoValue value={val("twilio_default_from_number")} />}
                editChild={isEditing ? <EditText value={val("twilio_default_from_number")} onChange={(v) => set("twilio_default_from_number", v)} placeholder="+1xxxxxxxxxx" /> : undefined}
              />
              <InfoRow
                label={t("fields.webhookUrl")}
                value={<MonoValue value={val("webhook_url")} />}
                editChild={isEditing ? <EditText value={val("webhook_url")} onChange={(v) => set("webhook_url", v)} type="url" placeholder="https://..." /> : undefined}
              />
              <InfoRow
                label={t("fields.apiKeyIntake")}
                value={<SecretDisplay value={val("webhook_secret")} />}
                editChild={isEditing ? <EditText value={val("webhook_secret")} onChange={(v) => set("webhook_secret", v)} type="password" placeholder="Webhook secret" /> : undefined}
              />
              <InfoRow
                label={t("fields.intakeUrl")}
                value={<MonoValue value="https://webhooks.leadawaker.com/api/leads/intake" />}
              />

              <SectionHeader label="Instagram" icon={Globe} />
              <InfoRow
                label={t("fields.userId")}
                value={<MonoValue value={val("instagram_user_id")} />}
                editChild={isEditing ? <EditText value={val("instagram_user_id")} onChange={(v) => set("instagram_user_id", v)} placeholder="IG Business Account User ID" /> : undefined}
              />
              <InfoRow
                label={t("fields.accessToken")}
                value={<SecretDisplay value={val("instagram_access_token")} />}
                editChild={isEditing ? <EditText value={val("instagram_access_token")} onChange={(v) => set("instagram_access_token", v)} type="password" placeholder="Long-lived Page access token" /> : undefined}
              />
              {/* Instagram Sync */}
              {!isEditing && val("instagram_user_id") && val("instagram_access_token") && (
                <div className="mt-3 space-y-2">
                  <button
                    onClick={handleSyncInstagram}
                    disabled={syncing}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand-indigo text-white text-xs font-medium hover:bg-brand-indigo/90 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} />
                    {syncing ? t("detail.syncingContacts") : t("detail.syncInstagram")}
                  </button>
                  {syncResult && (
                    <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-800 space-y-1">
                      <p className="font-medium">{t("detail.contactsSynced", { count: syncResult.synced })}</p>
                      {syncResult.skipped_duplicates > 0 && (
                        <p className="text-emerald-600">{t("detail.alreadyExisted", { count: syncResult.skipped_duplicates })}</p>
                      )}
                      {syncResult.failed > 0 && (
                        <p className="text-amber-600">{t("detail.failedCount", { count: syncResult.failed })}</p>
                      )}
                      {syncResult.rate_limited && (
                        <p className="text-amber-600">{t("detail.rateLimited")}</p>
                      )}
                      <p className="text-emerald-600/70">{t("detail.conversationsScanned", { count: syncResult.total_conversations })}</p>
                    </div>
                  )}
                  {syncError && (
                    <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                      {syncError}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Bottom Col 3: Voice Clone */}
          <div className={cn("overflow-y-auto rounded-xl", isMobile ? "min-h-[300px]" : "h-[720px]")} style={isMobile ? undefined : { height: 720 }}>
            <VoiceCloneWidget
              voiceFileData={(account as any).voice_file_data ?? null}
              voiceFileName={(account as any).voice_file_name ?? null}
              accountId={(account as any).Id ?? (account as any).id ?? 0}
              onSave={onSave}
            />
          </div>

        </div>

      </div>

      {/* Logo crop modal */}
      {cropSrc && (
        <LogoCropModal
          srcUrl={cropSrc}
          onSave={handleCropSave}
          onCancel={handleCropCancel}
        />
      )}

    </div>
  );
}
