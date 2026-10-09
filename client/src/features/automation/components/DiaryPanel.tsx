import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { X } from "lucide-react";
import { Pill } from "@/components/crm/primitives";
import { setPersistedSelection } from "@/hooks/usePersistedSelection";
import type { DiaryLine } from "@shared/automationTypes";
import { useAutomationDiary } from "../api";
import { actionLabel, automationName, timeAgo } from "../labels";

const OUTCOME_COLOR = { success: "var(--good)", failed: "var(--destructive)", skipped: "var(--mute)" } as const;

export function DiaryPanel({ automationId, accountId, onClose }: { automationId: string; accountId?: number; onClose: () => void }) {
  const { t } = useTranslation("automation");
  const [, setLocation] = useLocation();
  const [failedOnly, setFailedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [lines, setLines] = useState<DiaryLine[]>([]);
  const q = useAutomationDiary(automationId, { accountId, failedOnly, page });

  // Accumulate pages; reset when the filter or automation changes.
  const shown = page === 1 ? (q.data?.lines ?? []) : [...lines, ...(q.data?.page === page ? q.data.lines : [])];

  const openLead = (leadId: number) => {
    setPersistedSelection("selected-lead-id", leadId);
    setLocation("/platform/leads");
  };

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: "var(--surface)", borderLeft: "1px solid var(--line)" }} data-testid="automation-diary-panel">
      <div className="shrink-0 flex items-center gap-2 px-5" style={{ height: 60, borderBottom: "1px solid var(--line)" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.13em", textTransform: "uppercase", color: "var(--mute)" }}>{t("diary.title")}</div>
          <div style={{ fontWeight: 600, color: "var(--ink)" }}>{automationName(t, automationId)}</div>
        </div>
        <label style={{ fontSize: 12, color: "var(--mute)", display: "flex", alignItems: "center", gap: 6 }}>
          <input type="checkbox" checked={failedOnly} onChange={(e) => { setFailedOnly(e.target.checked); setPage(1); setLines([]); }} />
          {t("diary.failedOnly")}
        </label>
        <button className="la-btn la-btn--soft la-btn--icon" onClick={onClose} title={t("diary.close")}><X className="h-4 w-4" /></button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {shown.length === 0 && !q.isLoading && <div style={{ color: "var(--mute)", fontSize: 13 }}>{t("diary.empty")}</div>}
        {shown.map((l) => (
          <div key={l.id} style={{ borderBottom: "1px solid var(--line)", paddingBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <Pill color={OUTCOME_COLOR[l.outcome]}>{t(`outcome.${l.outcome}`)}</Pill>
              <span style={{ color: "var(--ink)", fontSize: 13 }}>{actionLabel(t, l.action)}</span>
              <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--mute-2)" }} title={new Date(l.createdAt).toLocaleString()}>{timeAgo(t, l.createdAt)}</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--mute)", marginTop: 3, display: "flex", gap: 10, flexWrap: "wrap" }}>
              {l.accountName && !accountId && <span>{l.accountName}</span>}
              {l.campaignName && <span>{l.campaignName}</span>}
              {l.leadId && (
                <button type="button" onClick={() => openLead(l.leadId!)} style={{ color: "var(--wine)", textDecoration: "underline" }}>
                  {l.leadName || t("diary.openLead")}
                </button>
              )}
            </div>
            {l.reason && l.outcome !== "success" && (
              <div style={{ fontSize: 12, color: l.outcome === "failed" ? "var(--destructive)" : "var(--mute)", marginTop: 3, wordBreak: "break-word" }}>{l.reason}</div>
            )}
          </div>
        ))}
        {q.data?.hasMore && (
          <button className="la-btn la-btn--soft" onClick={() => { setLines(shown); setPage((p) => p + 1); }}>{t("diary.loadMore")}</button>
        )}
      </div>
    </div>
  );
}
