import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { Plus, ChevronRight, MoreHorizontal, MessageCircle, Check, Trash2, ExternalLink, Tag } from "lucide-react";
import { CAMPAIGN_STATUS_HEX } from "@/lib/avatarUtils";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteCampaign, bulkDeleteCampaigns, bulkUpdateCampaigns } from "@/features/campaigns/api/campaignsApi";
import { Panel, PanelAction, Stat } from "./atoms";
import type { CampaignRowData } from "./types";

const ROUTE_PREFIX = "/platform";
const BULK_STATUS_OPTIONS = ["Active", "Paused", "Draft", "Archived"];

function CampaignStatusPill({ status }: { status: string }) {
  if (!status) return null;
  const hex = CAMPAIGN_STATUS_HEX[status] || "var(--mute-2)";
  return (
    <span className="row" style={{ gap: 5, fontFamily: "var(--mono)", fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--mute)" }}>
      <span className="dot" style={{ background: hex }} />{status}
    </span>
  );
}

function CampaignRow({ c, onOpen, selected, onToggleSelect, onDelete, leadsLabel, respLabel, openLabel, deleteLabel, confirmLabel }: {
  c: CampaignRowData; onOpen: () => void; selected: boolean; onToggleSelect: () => void; onDelete: () => void;
  leadsLabel: string; respLabel: string; openLabel: string; deleteLabel: string; confirmLabel: string;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const handleDelete = () => {
    if (confirmDelete) { onDelete(); setConfirmDelete(false); }
    else { setConfirmDelete(true); setTimeout(() => setConfirmDelete(false), 3000); }
  };
  return (
    <div
      onClick={onOpen}
      style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 14px", borderRadius: "var(--r-surface)", cursor: "pointer", transition: "background 130ms", background: selected ? "var(--wine-tint)" : "transparent" }}
      onMouseEnter={(e) => { if (!selected) e.currentTarget.style.background = "var(--wine-tint)"; }}
      onMouseLeave={(e) => { if (!selected) e.currentTarget.style.background = "transparent"; }}
    >
      {/* Avatar tile — click to toggle selection */}
      <div
        className="la-mono-tile"
        onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
        role="checkbox"
        aria-checked={selected}
        style={{
          width: 38, height: 38, fontFamily: "var(--mono)", fontSize: 12, cursor: "pointer",
          background: selected ? "var(--surface)" : "var(--bg)",
          boxShadow: selected ? "none" : "var(--sh-inset-crisp)",
          border: selected ? "2px solid var(--wine)" : "none",
          color: selected ? "var(--wine)" : "var(--mute)",
        }}
      >
        {selected ? <Check size={18} /> : c.mono}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 4 }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <CampaignStatusPill status={c.status} />
          <span className="row" style={{ gap: 5, fontFamily: "var(--mono)", fontSize: 10, color: "var(--mute)", letterSpacing: "0.06em" }}><MessageCircle size={12} />{c.channel}</span>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 22, flexShrink: 0 }}>
        <Stat n={c.leads} l={leadsLabel} />
        <Stat n={`${c.resp}%`} l={respLabel} accent />
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="la-btn la-btn--inset la-btn--icon" style={{ flexShrink: 0 }} onClick={(e) => e.stopPropagation()}><MoreHorizontal size={14} /></button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40 bg-white" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem onClick={(e) => { e.preventDefault(); onOpen(); }} className="flex items-center gap-2 text-[12px]">
            <ExternalLink className="h-3.5 w-3.5" />{openLabel}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={(e) => { e.preventDefault(); handleDelete(); }} className="flex items-center gap-2 text-[12px] text-destructive">
            <Trash2 className="h-3.5 w-3.5" />{confirmDelete ? confirmLabel : deleteLabel}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function CampaignsPanel({ campaigns, loading, onRefresh }: { campaigns: CampaignRowData[]; loading?: boolean; onRefresh?: () => void }) {
  const { t } = useTranslation("accounts");
  const [, setLocation] = useLocation();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkConfirmDelete, setBulkConfirmDelete] = useState(false);

  const toggleSelect = (id: number) => setSelected((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const clearSelection = () => { setSelected(new Set()); setBulkConfirmDelete(false); };

  const openCampaign = (id: number) => {
    if (id) { try { localStorage.setItem("selected-campaign-id", String(id)); } catch {} }
    setLocation(`${ROUTE_PREFIX}/campaigns`);
  };

  const handleDeleteOne = async (id: number) => {
    try { await deleteCampaign(id); onRefresh?.(); } catch (e) { console.error("Delete campaign failed", e); }
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    if (!bulkConfirmDelete) { setBulkConfirmDelete(true); setTimeout(() => setBulkConfirmDelete(false), 3000); return; }
    setBulkBusy(true);
    try { await bulkDeleteCampaigns(Array.from(selected)); clearSelection(); onRefresh?.(); }
    catch (e) { console.error("Bulk delete failed", e); }
    finally { setBulkBusy(false); }
  };

  const handleBulkStatus = async (status: string) => {
    if (selected.size === 0) return;
    setBulkBusy(true);
    try { await bulkUpdateCampaigns(Array.from(selected), { status }); clearSelection(); onRefresh?.(); }
    catch (e) { console.error("Bulk status change failed", e); }
    finally { setBulkBusy(false); }
  };

  return (
    <Panel eyebrow="02" title={t("panels.campaigns")} count={t("metrics.nActive", { count: campaigns.length })}
      action={<PanelAction wine icon={<Plus size={12} />} onClick={() => setLocation(`${ROUTE_PREFIX}/campaigns`)}>{t("panels.actions.new")}</PanelAction>}>

      {selected.size > 0 && (
        <div className="row" style={{ gap: 8, padding: "9px 12px", marginBottom: 8, borderRadius: "var(--r-surface)", background: "var(--wine-tint)", flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.08em", color: "var(--wine)", fontWeight: 700 }}>
            {t("panels.bulk.selected", { count: selected.size })}
          </span>
          <div style={{ flex: 1 }} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="la-btn la-btn--soft" disabled={bulkBusy}><Tag size={12} />{t("panels.bulk.setStatus")}</button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40 bg-white">
              {BULK_STATUS_OPTIONS.map((s) => (
                <DropdownMenuItem key={s} onClick={(e) => { e.preventDefault(); handleBulkStatus(s); }} className="flex items-center gap-2 text-[12px]">
                  <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: CAMPAIGN_STATUS_HEX[s] || "#94A3B8" }} />
                  {t(`panels.bulk.status.${s}`, { defaultValue: s })}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <button className="la-btn la-btn--soft" style={{ color: "var(--wine)" }} disabled={bulkBusy} onClick={handleBulkDelete}>
            <Trash2 size={12} />{bulkConfirmDelete ? t("detail.confirm") : t("panels.bulk.delete")}
          </button>
          <button className="la-btn la-btn--soft" disabled={bulkBusy} onClick={clearSelection}>{t("panels.bulk.clear")}</button>
        </div>
      )}

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[0, 1, 2].map((i) => <div key={i} style={{ height: 56, borderRadius: "var(--r-surface)", background: "var(--bg)", boxShadow: "var(--sh-inset-crisp)" }} className="animate-pulse" />)}
        </div>
      ) : campaigns.length === 0 ? (
        <p style={{ fontSize: 12, color: "var(--mute-2)", fontStyle: "italic", padding: "6px 2px" }}>{t("related.noCampaigns")}</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {campaigns.map((c, i) => (
            <div key={c.id}>
              {i > 0 && <div className="rule" style={{ margin: "0 14px" }} />}
              <CampaignRow
                c={c}
                onOpen={() => openCampaign(c.id)}
                selected={selected.has(c.id)}
                onToggleSelect={() => toggleSelect(c.id)}
                onDelete={() => handleDeleteOne(c.id)}
                leadsLabel={t("panels.leads")}
                respLabel={t("panels.response")}
                openLabel={t("panels.actions.open", { defaultValue: "Open" })}
                deleteLabel={t("toolbar.delete")}
                confirmLabel={t("detail.confirm")}
              />
            </div>
          ))}
        </div>
      )}
      <button className="la-btn la-btn--soft" style={{ alignSelf: "center", marginTop: 12 }} onClick={() => setLocation(`${ROUTE_PREFIX}/campaigns`)}>
        {t("panels.actions.viewAllCampaigns")}<ChevronRight size={12} />
      </button>
    </Panel>
  );
}
