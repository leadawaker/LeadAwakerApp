// LeadFilterBottomSheet — extracted from MobileViews.tsx

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveColor } from "@/features/tags/types";

import type {
  LeadFilterBottomSheetProps,
  SortByOption,
} from "./types";
import {
  STATUS_COLORS,
  ALL_LEAD_FILTER_STAGES,
  LEAD_SORT_OPTIONS,
} from "./constants";

export function LeadFilterBottomSheet({
  open, onClose,
  filterStatus, filterTags, sortBy, filterCampaign, filterAccount,
  allTags, availableCampaigns,
  onApply, onReset,
}: LeadFilterBottomSheetProps) {
  const [mounted, setMounted] = useState(false);
  const [pendingStatus,   setPendingStatus]   = useState<string[]>([...filterStatus]);
  const [pendingTags,     setPendingTags]     = useState<string[]>([...filterTags]);
  const [pendingSort,     setPendingSort]     = useState<SortByOption>(sortBy);
  const [pendingCampaign, setPendingCampaign] = useState<string>(filterCampaign);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (open) {
      setPendingStatus([...filterStatus]);
      setPendingTags([...filterTags]);
      setPendingSort(sortBy);
      setPendingCampaign(filterCampaign);
    }
  }, [open, filterStatus, filterTags, sortBy, filterCampaign]);

  if (!mounted) return null;

  const toggleStatus = (s: string) =>
    setPendingStatus((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);

  const toggleTag = (name: string) =>
    setPendingTags((prev) => prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]);

  const handleApply = () => {
    onApply({
      filterStatus:  pendingStatus,
      filterTags:    pendingTags,
      sortBy:        pendingSort,
      filterCampaign: pendingCampaign,
      filterAccount:  filterAccount, // unchanged from parent
    });
    onClose();
  };

  const handleReset = () => {
    onReset();
    onClose();
  };

  const activeCount =
    pendingStatus.length + pendingTags.length +
    (pendingCampaign ? 1 : 0) + (pendingSort !== "recent" ? 1 : 0);

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="lead-filter-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden fixed inset-0 z-[300] bg-black/50"
            onClick={onClose}
          />
          {/* Sheet */}
          <motion.div
            key="lead-filter-sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "tween", duration: 0.3, ease: [0.0, 0.0, 0.2, 1] }}
            data-testid="lead-filter-sheet"
            className="lg:hidden fixed inset-x-0 bottom-0 z-[301] bg-background rounded-t-3xl border-t border-border/30 flex flex-col max-h-[88dvh]"
            style={{ paddingBottom: "calc(1.5rem + var(--safe-bottom, env(safe-area-inset-bottom, 0px)))" }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-foreground/20" />
            </div>
            {/* Header */}
            <div className="flex items-center justify-between px-5 pb-3 pt-1 shrink-0">
              <h2 className="text-[17px] font-semibold text-foreground">
                Filters &amp; Sort
                {activeCount > 0 && (
                  <span className="ml-2 inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-brand-indigo text-white text-[10px] font-bold">
                    {activeCount}
                  </span>
                )}
              </h2>
              <button onClick={onClose} className="h-8 w-8 rounded-full bg-muted grid place-items-center" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-5 pb-4 flex flex-col gap-5">
              {/* Sort */}
              <div>
                <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Sort By</p>
                <div className="flex flex-col gap-1">
                  {LEAD_SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      className={cn(
                        "flex items-center justify-between px-3 py-2.5 rounded-xl border text-[14px] min-h-[44px] transition-colors",
                        pendingSort === opt.value
                          ? "border-brand-indigo bg-brand-indigo/8 text-brand-indigo font-semibold"
                          : "border-border/40 text-foreground"
                      )}
                      onClick={() => setPendingSort(opt.value)}
                    >
                      <span>{opt.label}</span>
                      {pendingSort === opt.value && <Check className="h-4 w-4 text-brand-indigo" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status filter */}
              <div>
                <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Pipeline Stage</p>
                <div className="flex flex-wrap gap-2">
                  {ALL_LEAD_FILTER_STAGES.map((s) => {
                    const colors = STATUS_COLORS[s];
                    const active = pendingStatus.includes(s);
                    return (
                      <button
                        key={s}
                        onClick={() => toggleStatus(s)}
                        className={cn(
                          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[13px] font-medium min-h-[36px] transition-colors",
                          active
                            ? (colors?.badge ?? "bg-brand-indigo/10 text-brand-indigo border-brand-indigo/30")
                            : "border-border/40 text-muted-foreground"
                        )}
                      >
                        {active && <Check className="h-3 w-3 shrink-0" />}
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Campaign filter */}
              {availableCampaigns.length > 0 && (
                <div>
                  <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Campaign</p>
                  <div className="flex flex-col gap-1">
                    <button
                      className={cn(
                        "flex items-center justify-between px-3 py-2.5 rounded-xl border text-[14px] min-h-[44px] transition-colors",
                        !pendingCampaign
                          ? "border-brand-indigo bg-brand-indigo/8 text-brand-indigo font-semibold"
                          : "border-border/40 text-foreground"
                      )}
                      onClick={() => setPendingCampaign("")}
                    >
                      <span>All Campaigns</span>
                      {!pendingCampaign && <Check className="h-4 w-4 text-brand-indigo" />}
                    </button>
                    {availableCampaigns.map((c) => (
                      <button
                        key={c.id}
                        className={cn(
                          "flex items-center justify-between px-3 py-2.5 rounded-xl border text-[14px] min-h-[44px] transition-colors",
                          pendingCampaign === c.id
                            ? "border-brand-indigo bg-brand-indigo/8 text-brand-indigo font-semibold"
                            : "border-border/40 text-foreground"
                        )}
                        onClick={() => setPendingCampaign(pendingCampaign === c.id ? "" : c.id)}
                      >
                        <span className="truncate text-left">{c.name}</span>
                        {pendingCampaign === c.id && <Check className="h-4 w-4 text-brand-indigo shrink-0" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Tags filter */}
              {allTags.length > 0 && (
                <div>
                  <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Tags</p>
                  <div className="flex flex-wrap gap-2">
                    {allTags.map((tag) => {
                      const hex    = resolveColor(tag.color);
                      const active = pendingTags.includes(tag.name);
                      return (
                        <button
                          key={tag.name}
                          onClick={() => toggleTag(tag.name)}
                          className={cn(
                            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[13px] font-medium min-h-[36px] transition-colors",
                            active ? "border-transparent text-white" : "border-border/40 text-muted-foreground"
                          )}
                          style={active ? { backgroundColor: hex } : undefined}
                        >
                          {!active && <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: hex }} />}
                          {active && <Check className="h-3 w-3 shrink-0" />}
                          {tag.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="shrink-0 flex gap-3 px-5 pt-3 border-t border-border/20">
              <button
                onClick={handleReset}
                className="flex-1 h-12 rounded-2xl border border-border/40 text-[15px] font-semibold text-muted-foreground active:bg-muted"
                data-testid="lead-filter-reset"
              >
                Reset
              </button>
              <button
                onClick={handleApply}
                className="flex-1 h-12 rounded-2xl bg-brand-indigo text-white text-[15px] font-semibold active:brightness-90"
                data-testid="lead-filter-apply"
              >
                Apply{activeCount > 0 && ` (${activeCount})`}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
