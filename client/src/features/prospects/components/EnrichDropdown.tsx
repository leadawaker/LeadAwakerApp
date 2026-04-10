import { useState, useRef, useEffect, useCallback } from "react";
import { RefreshCw, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/apiUtils";

interface EnrichDropdownProps {
  prospectId: number;
  onDone?: () => void;
  enrichedAt?: string | null;
}

const STORAGE_KEY = "enriching";
const POLL_INTERVAL = 5000;
const POLL_TIMEOUT = 90_000;

function getStoredEnriching(): { prospectId: number; baselineEnrichedAt: string | null; startedAt: number } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.startedAt > POLL_TIMEOUT) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function EnrichDropdown({ prospectId, onDone, enrichedAt }: EnrichDropdownProps) {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [checkWebsite, setCheckWebsite] = useState(false);
  const [checkContact1, setCheckContact1] = useState(false);
  const [checkContact2, setCheckContact2] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const cancelEnrichment = useCallback(() => {
    stopPolling();
    setLoading(false);
  }, [stopPolling]);

  function startPolling(baselineEnrichedAt: string | null | undefined) {
    stopPolling();

    const baseline = baselineEnrichedAt ?? null;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      prospectId,
      baselineEnrichedAt: baseline,
      startedAt: Date.now(),
    }));

    pollRef.current = setInterval(async () => {
      try {
        const res = await apiFetch(`/api/prospects/${prospectId}`);
        const data = await res.json();
        const newEnrichedAt = data.enriched_at ?? data.enrichedAt ?? null;
        if (newEnrichedAt !== baseline) {
          stopPolling();
          setLoading(false);
          onDone?.();
        }
      } catch {
        // ignore fetch errors during polling
      }
    }, POLL_INTERVAL);

    timeoutRef.current = setTimeout(() => {
      stopPolling();
      setLoading(false);
      onDone?.();
    }, POLL_TIMEOUT);
  }

  // Resume polling on mount if enrichment was in progress for this prospect
  useEffect(() => {
    const stored = getStoredEnriching();
    if (stored && stored.prospectId === prospectId) {
      setLoading(true);
      startPolling(stored.baselineEnrichedAt);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [prospectId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleStart() {
    if (!checkWebsite && !checkContact1 && !checkContact2) return;
    setOpen(false);
    setLoading(true);

    let needsPolling = false;

    try {
      // Execute enrichment calls sequentially
      if (checkWebsite) {
        await apiFetch(`/api/prospects/${prospectId}/enrich`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "website" }),
        });
        needsPolling = true;
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

      if (needsPolling) {
        startPolling(enrichedAt ?? null);
      } else {
        onDone?.();
        setLoading(false);
      }
    } catch {
      setLoading(false);
    }

    // Reset checkboxes
    setCheckWebsite(false);
    setCheckContact1(false);
    setCheckContact2(false);
  }

  const noneChecked = !checkWebsite && !checkContact1 && !checkContact2;

  return loading ? (
    <div className="inline-flex items-center gap-1">
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
        <RefreshCw className="h-3 w-3 animate-spin" />
        Enriching...
      </span>
      <button
        onClick={cancelEnrichment}
        className="inline-flex items-center justify-center h-4 w-4 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
        title="Stop enrichment polling"
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </div>
  ) : (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          title="Enrich prospect"
        >
          <RefreshCw className="h-3 w-3" />
          Enrich
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-48 p-3">
        <div className="flex flex-col gap-2.5">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={checkWebsite} onCheckedChange={(v) => setCheckWebsite(!!v)} />
            <span className="text-[12px]">Website</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={checkContact1} onCheckedChange={(v) => setCheckContact1(!!v)} />
            <span className="text-[12px]">Contact 1</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={checkContact2} onCheckedChange={(v) => setCheckContact2(!!v)} />
            <span className="text-[12px]">Contact 2</span>
          </label>
          <Button size="sm" className="h-7 text-[12px] mt-1" onClick={handleStart} disabled={noneChecked}>
            Start
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
