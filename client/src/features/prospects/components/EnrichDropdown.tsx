import { useState, useRef, useEffect, useCallback } from "react";
import { RefreshCw, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/apiUtils";

export type EnrichTarget = "company" | "contact1" | "contact2";

interface EnrichDropdownProps {
  prospectId: number;
  onDone?: () => void;
  /** Baseline timestamps used for polling completion. */
  enrichedAt?: string | null;
  companyEnrichedAt?: string | null;
  /** Called whenever the set of actively-enriching targets changes. */
  onLoadingChange?: (loading: Set<EnrichTarget>) => void;
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
}: EnrichDropdownProps) {
  const [open, setOpen] = useState(false);
  const [checkCompany, setCheckCompany] = useState(false);
  const [checkContact1, setCheckContact1] = useState(false);
  const [checkContact2, setCheckContact2] = useState(false);
  const [active, setActive] = useState<Set<EnrichTarget>>(new Set());
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
        setActive(new Set());
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
    if (targets.length === 0) return;

    setOpen(false);
    setActive(new Set(targets));

    try {
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
    } catch {
      setActive(new Set());
    }

    setCheckCompany(false);
    setCheckContact1(false);
    setCheckContact2(false);
  }

  const { t } = useTranslation("prospects");
  const noneChecked = !checkCompany && !checkContact1 && !checkContact2;
  const loading = active.size > 0;

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

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
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
  return t("tabs.contact2", "Contact 2");
}
