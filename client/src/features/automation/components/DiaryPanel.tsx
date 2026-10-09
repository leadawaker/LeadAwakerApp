import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { X, NotebookPen } from "lucide-react";
import { IconBtn } from "@/components/ui/icon-btn";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { setPersistedSelection } from "@/hooks/usePersistedSelection";
import { useWorkspace } from "@/hooks/useWorkspace";
import { cn } from "@/lib/utils";
import { findEntry } from "@shared/automationCatalogue";
import type { DiaryLine, OverviewRow } from "@shared/automationTypes";
import { useAutomationDiary } from "../api";
import { automationName, automationDescription, triggerLabel } from "../labels";
import { BUCKET_COLOR, SERVICE_ICON, bucketOf } from "../status";
import { DiaryTimeline } from "./DiaryTimeline";
import "../automation.css";

export function DiaryPanel({ automationId, accountId: fixedAccountId, row, onClose }: {
  automationId: string;
  accountId?: number;
  /** Overview row, when opened from the Automations page: adds status + 24h numbers to the header. */
  row?: OverviewRow;
  onClose: () => void;
}) {
  const { t } = useTranslation("automation");
  const { accounts } = useWorkspace();
  // Global page (no fixed account): the header offers a client filter.
  const [pickedAccountId, setPickedAccountId] = useState<number | undefined>(undefined);
  const accountId = fixedAccountId ?? pickedAccountId;
  const [, setLocation] = useLocation();
  const [failedOnly, setFailedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [lines, setLines] = useState<DiaryLine[]>([]);
  const q = useAutomationDiary(automationId, { accountId, failedOnly, page });

  // Accumulate pages; reset when the filter or automation changes.
  const combined = page === 1 ? (q.data?.lines ?? []) : [...lines, ...(q.data?.page === page ? q.data.lines : [])];
  // An offset page can overlap the snapshot, so keep only the first occurrence of each line.
  const seen = new Set<DiaryLine["id"]>();
  const shown = combined.filter((l) => (seen.has(l.id) ? false : (seen.add(l.id), true)));

  const resetPaging = () => { setPage(1); setLines([]); };
  const openLead = (leadId: number) => {
    setPersistedSelection("selected-lead-id", leadId);
    setLocation("/platform/leads");
  };

  const entry = findEntry(automationId);
  const Icon = SERVICE_ICON[entry?.service ?? "unlisted"];
  const description = automationDescription(t, automationId);
  const c = row?.counts24h;
  const bucket = row ? bucketOf(row.health) : null;

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: "var(--surface)", borderLeft: "1px solid var(--line)" }} data-testid="automation-diary-panel">
      <div className="shrink-0" style={{ padding: "18px 20px 14px", borderBottom: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <span className="am-icon-tile"><Icon className="h-4 w-4" /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="serif" style={{ fontSize: 21, lineHeight: 1.2, color: "var(--ink)" }}>{automationName(t, automationId)}</div>
            {description && <div style={{ fontSize: 13, color: "var(--mute)", marginTop: 3, lineHeight: 1.45 }}>{description}</div>}
            {(row || entry) && (
              <div className="am-mono" style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", marginTop: 8 }}>
                {row && bucket && <span style={{ color: BUCKET_COLOR[bucket], fontWeight: 600 }}>{t(`health.${row.health}`)}</span>}
                {entry && <span>{triggerLabel(t, entry.trigger)}</span>}
              </div>
            )}
          </div>
          <IconBtn onClick={onClose} title={t("diary.close")} aria-label={t("diary.close")}><X className="h-4 w-4" /></IconBtn>
        </div>

        {c && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
            {([
              ["success", c.success, "var(--ink)"],
              ["failed", c.failed, c.failed ? "hsl(var(--destructive))" : "var(--ink)"],
              ["skipped", c.skipped, "var(--ink)"],
            ] as const).map(([k, n, color]) => (
              <div key={k} className="am-stat">
                <b style={{ color }}>{n}</b>
                <span className="am-mono" style={{ fontSize: 10.5 }}>{t(`diary.stat.${k}`)}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div className="la-seg" role="tablist" aria-label={t("diary.title")}>
            {[false, true].map((f) => (
              <button key={String(f)} type="button" role="tab" aria-selected={failedOnly === f} className={cn("la-seg-btn", failedOnly === f && "on")} onClick={() => { setFailedOnly(f); resetPaging(); }}>
                {f ? t("diary.failures") : t("diary.everything")}
              </button>
            ))}
          </div>
          {fixedAccountId === undefined && (
            <div style={{ marginLeft: "auto", minWidth: 0, flex: "0 1 190px" }}>
              <Select value={pickedAccountId ? String(pickedAccountId) : "all"} onValueChange={(v) => { setPickedAccountId(v === "all" ? undefined : Number(v)); resetPaging(); }}>
                <SelectTrigger className="h-9 text-sm" data-testid="automation-diary-client-filter" aria-label={t("diary.allClients")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("diary.allClients")}</SelectItem>
                  {accounts.map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto" style={{ padding: "0 20px 20px" }}>
        {q.isError && <div style={{ color: "hsl(var(--destructive))", fontSize: 13, paddingTop: 16 }}>{t("diary.error")}</div>}
        {q.isLoading && page === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 16 }}>
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-[44px] bg-primary/10 rounded-lg animate-pulse" />)}
          </div>
        )}
        {shown.length === 0 && !q.isLoading && !q.isError && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 10, padding: "48px 12px" }}>
            <span className="am-icon-tile" style={{ width: 48, height: 48, color: "var(--mute)" }}><NotebookPen className="h-5 w-5" /></span>
            <div className="serif" style={{ fontSize: 18, color: "var(--ink)" }}>{failedOnly ? t("diary.emptyFailedTitle") : t("diary.emptyTitle")}</div>
            <p style={{ fontSize: 13, color: "var(--mute)", maxWidth: 300, lineHeight: 1.5, margin: 0 }}>
              {failedOnly ? t("diary.emptyFailedBody") : t("diary.emptyBody")}
            </p>
          </div>
        )}
        {shown.length > 0 && <DiaryTimeline lines={shown} showClient={!accountId} onOpenLead={openLead} />}
        {q.data?.hasMore && (
          <button type="button" className="la-btn la-btn--soft" style={{ width: "100%", marginTop: 4 }} onClick={() => { setLines(shown); setPage((p) => p + 1); }}>
            {t("diary.loadMore")}
          </button>
        )}
      </div>
    </div>
  );
}
