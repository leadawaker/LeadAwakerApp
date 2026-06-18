import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle, RefreshCw, Rocket } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { fetchCampaignPreflight, type PreflightResult } from "../../api/campaignsApi";

interface CampaignPreflightProps {
  campaignId: number;
  refreshKey?: unknown;
  t: (key: string, fallback?: string, opts?: Record<string, unknown>) => string;
}

const STATUS_ICON = {
  ok: CheckCircle2,
  warn: AlertTriangle,
  error: XCircle,
} as const;

const STATUS_COLOR = {
  ok: "var(--ok, #2e7d4f)",
  warn: "var(--warn, #b8860b)",
  error: "var(--danger, #b3261e)",
} as const;

export function CampaignPreflight({ campaignId, refreshKey, t }: CampaignPreflightProps) {
  const [data, setData] = useState<PreflightResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchCampaignPreflight(campaignId));
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => { load(); }, [load, refreshKey]);

  // Derive badge info
  const blockers = data ? data.checks.filter((c) => c.critical && c.status === "error").length : 0;
  const warnings = data ? data.checks.filter((c) => !c.critical && c.status === "warn").length : 0;
  const ready = data?.ready ?? false;
  const active = data?.active ?? false;

  // For a running active campaign with 0 queued, it's "caught up" — show neutral
  const isCaughtUp = active && ready && data?.checks.find((c) => c.key === "queuedLeads")?.count === 0;

  const badgeCount = blockers > 0 ? blockers : warnings > 0 ? warnings : 0;
  const badgeStyle: React.CSSProperties =
    blockers > 0
      ? { background: "var(--danger, #b3261e)", color: "#fff" }
      : warnings > 0
      ? { background: "var(--warn, #b8860b)", color: "#fff" }
      : { background: "var(--ok, #2e7d4f)", color: "#fff" };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all",
            "border hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
          style={{
            fontFamily: "'Geist Mono', ui-monospace, monospace",
            background: "var(--card)",
            border: "1px solid var(--line)",
            color: "var(--fg, inherit)",
            boxShadow: "var(--sh-raised, none)",
          }}
          data-testid="campaign-preflight-trigger"
        >
          {loading && !data ? (
            <RefreshCw className="h-3 w-3 animate-spin" style={{ color: "var(--mute)" }} />
          ) : (
            <Rocket className="h-3 w-3" style={{ color: ready ? "var(--ok, #2e7d4f)" : "var(--danger, #b3261e)" }} />
          )}

          <span style={{ color: ready ? "var(--ok, #2e7d4f)" : "var(--danger, #b3261e)", letterSpacing: "0.03em" }}>
            {loading && !data
              ? t("preflight.checking", "…")
              : ready
              ? isCaughtUp
                ? t("preflight.caughtUp", "All sent")
                : t("preflight.ready", "Ready")
              : t("preflight.notReady", "{{count}} issue(s)", { count: blockers || warnings })}
          </span>

          {!loading && badgeCount > 0 && (
            <span
              className="inline-flex items-center justify-center rounded-full text-[10px] font-bold tabular-nums"
              style={{ ...badgeStyle, minWidth: 16, height: 16, padding: "0 4px", lineHeight: 1 }}
            >
              {badgeCount}
            </span>
          )}

          {!loading && badgeCount === 0 && ready && (
            <span
              className="inline-flex items-center justify-center rounded-full"
              style={{ background: "var(--ok, #2e7d4f)", color: "#fff", width: 14, height: 14 }}
            >
              <CheckCircle2 className="h-2.5 w-2.5" />
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[240px] p-0 overflow-hidden"
        style={{
          background: "var(--card)",
          border: "1px solid var(--line)",
          borderRadius: "var(--r-panel, 12px)",
          boxShadow: "var(--sh-raised-large, var(--sh-raised))",
        }}
      >
        {/* Popover header */}
        <div
          className="flex items-center justify-between px-3 py-2 border-b"
          style={{ borderColor: "var(--line)" }}
        >
          <span
            className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
            style={{ fontFamily: "'Geist Mono', ui-monospace, monospace", color: "var(--mute)" }}
          >
            <Rocket className="h-3 w-3" />
            {t("preflight.title", "Launch readiness")}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); load(); }}
            className="h-6 w-6 grid place-items-center rounded-full hover:bg-black/[0.04] transition-colors"
            title={t("preflight.recheck", "Re-check")}
          >
            <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} style={{ color: "var(--mute)" }} />
          </button>
        </div>

        {/* Summary line */}
        {data && (
          <div
            className="px-3 py-1.5 text-[11.5px] font-semibold border-b"
            style={{
              borderColor: "var(--line)",
              color: ready ? "var(--ok, #2e7d4f)" : "var(--danger, #b3261e)",
            }}
          >
            {ready
              ? isCaughtUp
                ? t("preflight.caughtUpFull", "All leads sent — campaign is caught up")
                : t("preflight.readyFull", "Ready to activate")
              : t("preflight.notReadyFull", "{{count}} blocker(s) to fix", { count: blockers })}
          </div>
        )}

        {/* Checklist */}
        {data && (
          <ul className="flex flex-col gap-1 px-3 py-2">
            {data.checks.map((c) => {
              const Icon = STATUS_ICON[c.status];
              const label =
                c.key === "phoneFormat" && c.status === "ok"
                  ? t("preflight.checks.phoneFormatOk", "Phone numbers valid")
                  : t(
                      `preflight.checks.${c.key}`,
                      c.key,
                      c.count !== undefined ? { count: c.count } : undefined,
                    );
              return (
                <li key={c.key} className="flex items-start gap-2 text-[11.5px] leading-tight text-foreground">
                  <Icon className="h-3.5 w-3.5 shrink-0 mt-[1px]" style={{ color: STATUS_COLOR[c.status] }} />
                  <span className={cn(c.status === "ok" && "text-muted-foreground")}>{label}</span>
                </li>
              );
            })}
          </ul>
        )}

        {!data && !loading && (
          <div className="px-3 py-3 text-[11.5px] text-muted-foreground italic">
            {t("preflight.error", "Could not load readiness")}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
