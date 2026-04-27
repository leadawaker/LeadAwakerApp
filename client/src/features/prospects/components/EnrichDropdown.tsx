import { useState, useRef, useEffect, useCallback } from "react";
import { RefreshCw, X, AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/apiUtils";

export type EnrichTarget = "company" | "contact1" | "contact2" | "website";

interface EnrichDropdownProps {
  prospectId: number;
  onDone?: () => void;
  /** Baseline timestamps used for polling completion. */
  enrichedAt?: string | null;
  companyEnrichedAt?: string | null;
  /** Called whenever the set of actively-enriching targets changes. */
  onLoadingChange?: (loading: Set<EnrichTarget>) => void;
  /** When true, the trigger button is shown in blue (not yet enriched). */
  highlight?: boolean;
}

const STORAGE_KEY = "enriching-v2";
const POLL_INTERVAL = 5000;
const POLL_TIMEOUT = 5 * 60_000; // 5 min — company agent can run 1-3 min

interface StoredState {
  prospectId: number;
  active: EnrichTarget[];
  baselines: { enrichedAt: string | null; companyEnrichedAt: string | null };
  startedAt: number;
}

function loadStored(): StoredState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredState;
    if (Date.now() - parsed.startedAt > POLL_TIMEOUT) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveStored(s: StoredState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function EnrichDropdown({
  prospectId,
  onDone,
  enrichedAt,
  companyEnrichedAt,
  onLoadingChange,
  highlight,
}: EnrichDropdownProps) {
  const [open, setOpen] = useState(false);
  const [checkCompany, setCheckCompany] = useState(false);
  const [checkContact1, setCheckContact1] = useState(false);
  const [checkContact2, setCheckContact2] = useState(false);
  const [checkWebsite, setCheckWebsite] = useState(false);
  const [websiteStarted, setWebsiteStarted] = useState(false);
  const [active, setActive] = useState<Set<EnrichTarget>>(new Set());
  const [timedOut, setTimedOut] = useState(false);
  const [timedOutTargets, setTimedOutTargets] = useState<EnrichTarget[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef<Set<EnrichTarget>>(active);
  activeRef.current = active;

  // Notify parent whenever active set changes
  useEffect(() => {
    onLoadingChange?.(active);
  }, [active, onLoadingChange]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const cancelAll = useCallback(() => {
    stopPolling();
    setActive(new Set());
  }, [stopPolling]);

  const startPolling = useCallback(
    (targets: EnrichTarget[], baselines: { enrichedAt: string | null; companyEnrichedAt: string | null }) => {
      stopPolling();

      saveStored({
        prospectId,
        active: targets,
        baselines,
        startedAt: Date.now(),
      });

      pollRef.current = setInterval(async () => {
        try {
          const res = await apiFetch(`/api/prospects/${prospectId}`);
          const data = await res.json();
          const newEnrichedAt = data.enriched_at ?? data.enrichedAt ?? null;
          const newCompanyEnrichedAt = data.company_enriched_at ?? data.companyEnrichedAt ?? null;

          const stillActive = new Set(activeRef.current);

          // Company target clears when company_enriched_at advances
          if (stillActive.has("company") && newCompanyEnrichedAt !== baselines.companyEnrichedAt) {
            stillActive.delete("company");
          }
          // Contact targets clear when enriched_at advances (shared timestamp for both contacts)
          if (
            (stillActive.has("contact1") || stillActive.has("contact2")) &&
            newEnrichedAt !== baselines.enrichedAt
          ) {
            stillActive.delete("contact1");
            stillActive.delete("contact2");
          }

          if (stillActive.size === 0) {
            stopPolling();
            setActive(new Set());
            onDone?.();
          } else if (stillActive.size !== activeRef.current.size) {
            setActive(stillActive);
            onDone?.();
          }
        } catch {
          // silent
        }
      }, POLL_INTERVAL);

      timeoutRef.current = setTimeout(() => {
        stopPolling();
        setTimedOutTargets(Array.from(activeRef.current));
        setActive(new Set());
        setTimedOut(true);
        setErrorMsg(`Enrichment took longer than ${Math.round(POLL_TIMEOUT / 60000)} min with no update. The server may still finish in the background.`);
        onDone?.();
      }, POLL_TIMEOUT);
    },
    [prospectId, stopPolling, onDone],
  );

  // Resume polling on mount if enrichment was in progress
  useEffect(() => {
    const stored = loadStored();
    if (stored && stored.prospectId === prospectId && stored.active.length > 0) {
      setActive(new Set(stored.active));
      startPolling(stored.active, stored.baselines);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [prospectId, startPolling]);

  async function handleStart() {
    const targets: EnrichTarget[] = [];
    if (checkCompany) targets.push("company");
    if (checkContact1) targets.push("contact1");
    if (checkContact2) targets.push("contact2");

    setOpen(false);
    setTimedOut(false);
    setErrorMsg(null);
    setTimedOutTargets([]);

    try {
      if (checkWebsite) {
        await apiFetch(`/api/prospects/${prospectId}/enrich`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "website" }),
        });
        setWebsiteStarted(true);
        setTimeout(() => setWebsiteStarted(false), 5000);
      }

      if (targets.length > 0) {
        setActive(new Set(targets));
        if (checkCompany) {
          await apiFetch(`/api/prospects/${prospectId}/enrich`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "company" }),
          });
        }
        if (checkContact1) {
          await apiFetch(`/api/prospects/${prospectId}/enrich`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "linkedin", contactSlot: 1 }),
          });
        }
        if (checkContact2) {
          await apiFetch(`/api/prospects/${prospectId}/enrich`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "linkedin", contactSlot: 2 }),
          });
        }
        startPolling(targets, {
          enrichedAt: enrichedAt ?? null,
          companyEnrichedAt: companyEnrichedAt ?? null,
        });
      }
    } catch (e: any) {
      setActive(new Set());
      setTimedOut(true);
      setTimedOutTargets(targets);
      setErrorMsg(e?.message || "Failed to start enrichment. Check connection and try again.");
    }

    setCheckCompany(false);
    setCheckContact1(false);
    setCheckContact2(false);
    setCheckWebsite(false);
  }

  const { t } = useTranslation("prospects");
  const noneChecked = !checkCompany && !checkContact1 && !checkContact2 && !checkWebsite;
  const loading = active.size > 0;

  if (websiteStarted && !loading) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-sky-500/15 text-sky-600 dark:text-sky-400">
        <RefreshCw className="h-3 w-3 animate-spin" />
        {t("enrich.websiteStarted", "Website scrape started...")}
      </span>
    );
  }

  if (loading) {
    const targetLabels = Array.from(active).map((tgt) => labelFor(tgt, t)).join(", ");
    return (
      <div className="inline-flex items-center gap-1">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
          <RefreshCw className="h-3 w-3 animate-spin" />
          {t("enrich.enriching", "Enriching {{targets}}...", { targets: targetLabels })}
        </span>
        <button
          onClick={cancelAll}
          className="inline-flex items-center justify-center h-4 w-4 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          title={t("enrich.stopPolling", "Stop enrichment polling")}
        >
          <X className="h-2.5 w-2.5" />
        </button>
      </div>
    );
  }

  if (timedOut) {
    const retry = async () => {
      if (timedOutTargets.length === 0) {
        setTimedOut(false);
        setErrorMsg(null);
        return;
      }
      setTimedOut(false);
      setErrorMsg(null);
      setActive(new Set(timedOutTargets));
      try {
        for (const tgt of timedOutTargets) {
          const body = tgt === "company"
            ? { type: "company" }
            : { type: "linkedin", contactSlot: tgt === "contact1" ? 1 : 2 };
          await apiFetch(`/api/prospects/${prospectId}/enrich`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
        }
        startPolling(timedOutTargets, {
          enrichedAt: enrichedAt ?? null,
          companyEnrichedAt: companyEnrichedAt ?? null,
        });
      } catch (e: any) {
        setActive(new Set());
        setTimedOut(true);
        setErrorMsg(e?.message || "Retry failed. Please try again.");
      }
    };
    return (
      <div className="inline-flex items-center gap-1">
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/15 text-amber-600 dark:text-amber-400 max-w-[220px]"
          title={errorMsg || ""}
        >
          <AlertTriangle className="h-3 w-3 shrink-0" />
          <span className="truncate">{errorMsg || t("enrich.timedOut", "Enrichment timed out")}</span>
        </span>
        <button
          onClick={retry}
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-brand-indigo/10 text-brand-indigo hover:bg-brand-indigo/20 transition-colors"
          title={t("enrich.retry", "Retry enrichment")}
        >
          <RefreshCw className="h-3 w-3" />
          {t("enrich.retryShort", "Retry")}
        </button>
        <button
          onClick={() => { setTimedOut(false); setErrorMsg(null); setTimedOutTargets([]); }}
          className="inline-flex items-center justify-center h-4 w-4 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          title={t("enrich.dismiss", "Dismiss")}
        >
          <X className="h-2.5 w-2.5" />
        </button>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={highlight
            ? "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-brand-indigo/10 text-brand-indigo hover:bg-brand-indigo/20 transition-colors"
            : "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"}
          title={t("enrich.enrichProspect", "Enrich prospect")}
        >
          <RefreshCw className="h-3 w-3" />
          {t("enrich.enrich", "Enrich")}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-48 p-3">
        <div className="flex flex-col gap-2.5">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={checkCompany} onCheckedChange={(v) => setCheckCompany(!!v)} />
            <span className="text-[12px]">{t("tabs.company", "Company")}</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={checkContact1} onCheckedChange={(v) => setCheckContact1(!!v)} />
            <span className="text-[12px]">{t("tabs.contact1", "Contact 1")}</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={checkContact2} onCheckedChange={(v) => setCheckContact2(!!v)} />
            <span className="text-[12px]">{t("tabs.contact2", "Contact 2")}</span>
          </label>
          <div className="border-t border-border/50 pt-2 mt-0.5">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={checkWebsite} onCheckedChange={(v) => setCheckWebsite(!!v)} />
              <span className="text-[12px] text-muted-foreground">{t("enrich.websiteScrape", "Website scrape")}</span>
            </label>
          </div>
          <Button size="sm" className="h-7 text-[12px] mt-1" onClick={handleStart} disabled={noneChecked}>
            {t("enrich.start", "Start")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function labelFor(tgt: EnrichTarget, t: ReturnType<typeof import("react-i18next").useTranslation>["t"]): string {
  if (tgt === "company") return t("tabs.company", "Company");
  if (tgt === "contact1") return t("tabs.contact1", "Contact 1");
  if (tgt === "contact2") return t("tabs.contact2", "Contact 2");
  return t("enrich.websiteScrape", "Website scrape");
}
