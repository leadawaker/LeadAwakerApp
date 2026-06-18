// AI Activity panel — "Just happened" feed of recent messages (in/out).
// Bumps Today section was split into a separate BumpsTodayPanel.
// Mirrors the Claude design's AIActivityCard. neu-raised surface.
//
// Each row is clickable → opens that lead's chat on the Leads page (same
// localStorage + route handoff the rest of the app uses). A compact/expanded
// toggle (top-right) stacks consecutive messages from the same lead into a
// single row with a "+N" badge so a busy thread doesn't flood the feed.
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { ArrowDownLeft, ArrowUpRight, Layers, List } from "lucide-react";
import type { Campaign } from "@/types/models";
import { useConversationsData } from "@/features/conversations/hooks/useConversationsData";
import { SectionHead } from "../panelPrimitives";
import { recentMessages, type RecentMsg } from "./utils";

interface FeedRow extends RecentMsg {
  stacked: number; // how many consecutive same-lead messages this row represents (1 = none)
}

// Collapse consecutive same-lead messages (newest-first list) into one row each.
function stackByLead(rows: RecentMsg[]): FeedRow[] {
  const out: FeedRow[] = [];
  for (const r of rows) {
    const prev = out[out.length - 1];
    if (prev && prev.leadId && prev.leadId === r.leadId) prev.stacked += 1;
    else out.push({ ...r, stacked: 1 });
  }
  return out;
}

export function AIActivityPanel({ campaign, accountId }: { campaign: Campaign; accountId: number }) {
  const { t } = useTranslation("campaigns");
  const [, setLocation] = useLocation();
  const [compact, setCompact] = useState(false);
  const campaignId = campaign.id || (campaign as any).Id;
  const { leads, interactions } = useConversationsData(accountId, campaignId);

  const nameById = useMemo(() => {
    const m = new Map<number, string>();
    for (const l of leads as any[]) {
      const id = Number(l.id ?? l.Id ?? 0);
      const composed = [l.first_name, l.last_name].filter(Boolean).join(" ").trim();
      m.set(id, l.full_name || l.fullName || composed || l.name || "—");
    }
    return m;
  }, [leads]);

  const recent = useMemo(
    () => recentMessages(interactions as any[], campaignId, (id) => nameById.get(id) || "", 40),
    [interactions, campaignId, nameById],
  );

  const rows = useMemo(() => (compact ? stackByLead(recent) : recent.map((r) => ({ ...r, stacked: 1 }))), [recent, compact]);

  const openChat = (leadId: number) => {
    if (!leadId) return;
    try {
      localStorage.setItem("selected-lead-id", String(leadId));
      localStorage.setItem("leads-view-mode", "list");
    } catch { /* ignore */ }
    setLocation("/platform/contacts");
  };

  return (
    <div className="surface-panel" style={{
      height: "100%",
      display: "flex",
      flexDirection: "column",
      padding: "20px 18px"
    }} data-testid="campaign-detail-view-activity">
      <SectionHead
        eyebrow={
          <span className="row" style={{ gap: 7 }}>
            <span className="la-pulse" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--good)" }} />
            {t("summary.eyebrows.live")}
          </span>
        }
        title={t("summary.justHappened", "Just Happened")}
        titleSize={32}
        marginBottom={20}
        action={
          <button
            type="button"
            onClick={() => setCompact((v) => !v)}
            title={compact ? t("summary.feedExpand", "Expand") : t("summary.feedCompact", "Stack by lead")}
            aria-label={compact ? t("summary.feedExpand", "Expand") : t("summary.feedCompact", "Stack by lead")}
            className="row"
            style={{
              width: 30, height: 30, borderRadius: "var(--r-button)", flexShrink: 0,
              alignItems: "center", justifyContent: "center", cursor: "pointer",
              background: "var(--bg)", boxShadow: "var(--sh-inset-crisp)",
              color: compact ? "var(--wine)" : "var(--mute)", border: "none",
            }}
          >
            {compact ? <Layers className="h-3.5 w-3.5" /> : <List className="h-3.5 w-3.5" />}
          </button>
        }
      />
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column" }}>
        {rows.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--mute)", padding: "8px 0" }}>{t("summary.noMessages")}</div>
        ) : rows.map((r) => {
          const inbound = r.direction === "in";
          const color = inbound ? "var(--good)" : "var(--wine)";
          const Icon = inbound ? ArrowDownLeft : ArrowUpRight;
          return (
            <button
              type="button"
              key={r.id}
              onClick={() => openChat(r.leadId)}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              className="row"
              style={{ gap: 14, padding: "11px 6px", borderBottom: "1px solid var(--line)", alignItems: "flex-start", textAlign: "left", background: "transparent", border: "none", borderBottomWidth: 1, borderRadius: "var(--r-button)", cursor: "pointer", width: "100%", transition: "background 0.12s" }}
            >
              <div style={{ position: "relative", width: 30, height: 30, borderRadius: "var(--r-button)", flexShrink: 0, marginTop: 1, background: "var(--bg)", boxShadow: "var(--sh-inset-crisp)", display: "flex", alignItems: "center", justifyContent: "center", color }}>
                <Icon className="h-3.5 w-3.5" />
                {r.stacked > 1 && (
                  <span style={{ position: "absolute", top: -6, right: -6, minWidth: 16, height: 16, padding: "0 4px", borderRadius: 8, background: "var(--wine)", color: "#fff", fontSize: 9, fontWeight: 700, fontFamily: "var(--mono)", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>
                    +{r.stacked - 1}
                  </span>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "baseline" }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{r.name}</span>
                  {r.leadId > 0 && (
                    <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--mute-2)", letterSpacing: "0.04em" }}>#{r.leadId}</span>
                  )}
                  <span className="row" style={{ gap: 4, fontSize: 11, color, fontWeight: 600 }}>
                    <Icon className="h-3 w-3" />
                    {inbound ? t("summary.replied") : t("summary.sent")}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "var(--mute)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.preview}</div>
              </div>
              <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--mute-2)", letterSpacing: "0.06em", whiteSpace: "nowrap", marginTop: 2 }}>{r.ago}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
