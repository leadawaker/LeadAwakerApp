import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { ArrowUpDown, ChevronDown, Filter, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CampaignSortBy } from "../pages/CampaignsPage";

const SORT_FILTER_OPTIONS: { value: CampaignSortBy; optKey: string }[] = [
  { value: "recent",        optKey: "sortOptions.recent" },
  { value: "name_asc",      optKey: "sortOptions.nameAsc" },
  { value: "name_desc",     optKey: "sortOptions.nameDesc" },
  { value: "leads_desc",    optKey: "sortOptions.leadsDesc" },
  { value: "response_desc", optKey: "sortOptions.responseDesc" },
];

const STATUS_FILTER_OPTIONS = ["Active", "Paused", "Draft", "Completed", "Inactive"];

const STATUS_COLOR: Record<string, string> = {
  Active:    "var(--good)",
  Paused:    "var(--warn)",
  Completed: "#6C5A8C",
  Draft:     "var(--mute-2)",
  Inactive:  "var(--mute-2)",
};

interface CampaignFilterSheetProps {
  open: boolean;
  onClose: () => void;
  sortBy: CampaignSortBy;
  onSortByChange: (v: CampaignSortBy) => void;
  filterStatus: string[];
  onFilterStatusSet: (v: string[]) => void;
  onReset: () => void;
}

export function CampaignFilterSheet({
  open,
  onClose,
  sortBy,
  onSortByChange,
  filterStatus,
  onFilterStatusSet,
  onReset,
}: CampaignFilterSheetProps) {
  const { t } = useTranslation("campaigns");
  const [mounted, setMounted] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [pendingSortBy, setPendingSortBy] = useState<CampaignSortBy>(sortBy);
  const [pendingStatus, setPendingStatus] = useState<string[]>([...filterStatus]);

  useEffect(() => {
    if (open) {
      setPendingSortBy(sortBy);
      setPendingStatus([...filterStatus]);
      setExpandedSection(null);
    }
  }, [open, sortBy, filterStatus]);

  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  const toggleStatus = (s: string) =>
    setPendingStatus((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);

  const toggleSection = (name: string) =>
    setExpandedSection((prev) => (prev === name ? null : name));

  const handleApply = () => {
    onSortByChange(pendingSortBy);
    onFilterStatusSet(pendingStatus);
    onClose();
  };

  const handleReset = () => {
    setPendingSortBy("recent");
    setPendingStatus([]);
    onReset();
    onClose();
  };

  const isModified = pendingStatus.length > 0 || pendingSortBy !== "recent";

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="campaign-filter-backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden fixed inset-0 z-[300] bg-black/50"
            onClick={onClose}
          />
          <motion.div
            key="campaign-filter-sheet"
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "tween", duration: 0.3, ease: [0.0, 0.0, 0.2, 1] }}
            data-testid="campaign-filter-sheet"
            className="md:hidden fixed inset-x-0 bottom-0 z-[301] bg-background rounded-t-3xl border-t border-border/30 flex flex-col max-h-[85dvh]"
            style={{ paddingBottom: "calc(1.5rem + var(--safe-bottom, env(safe-area-inset-bottom, 0px)))" }}
          >
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-foreground/20" />
            </div>
            <div className="flex items-center justify-between px-5 pb-3 pt-1 shrink-0">
              <h2 className="text-[17px] font-semibold text-foreground">
                {t("toolbar.filter")}
                {isModified && (
                  <span className="ml-2 inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-brand-indigo text-white text-[10px] font-bold">
                    {pendingStatus.length + (pendingSortBy !== "recent" ? 1 : 0)}
                  </span>
                )}
              </h2>
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label={t("toolbar.cancel")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 space-y-2 min-h-0">
              <div className="rounded-2xl overflow-hidden border border-border/40">
                <button
                  onClick={() => toggleSection("sort")}
                  className="w-full flex items-center justify-between min-h-[48px] px-4 bg-card text-foreground/80 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-[13px] font-semibold">{t("toolbar.sortBy")}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {pendingSortBy !== "recent" && (
                      <span className="h-4 min-w-4 px-1 rounded-full bg-brand-indigo text-white text-[9px] font-bold flex items-center justify-center">1</span>
                    )}
                    <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", expandedSection === "sort" && "rotate-180")} />
                  </div>
                </button>
                {expandedSection === "sort" && (
                  <div className="px-2 pb-2 space-y-1 bg-card border-t border-border/30">
                    {SORT_FILTER_OPTIONS.map(({ value, optKey }) => (
                      <button
                        key={value}
                        onClick={() => setPendingSortBy(value)}
                        className={cn(
                          "w-full flex items-center justify-between min-h-[44px] px-4 rounded-xl text-[14px] font-medium transition-colors",
                          pendingSortBy === value ? "bg-brand-indigo/10 text-brand-indigo" : "text-foreground/80 hover:bg-muted"
                        )}
                      >
                        <span>{t(optKey)}</span>
                        {pendingSortBy === value && <Check className="h-4 w-4 text-brand-indigo shrink-0" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-2xl overflow-hidden border border-border/40">
                <button
                  onClick={() => toggleSection("status")}
                  className="w-full flex items-center justify-between min-h-[48px] px-4 bg-card text-foreground/80 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-[13px] font-semibold">{t("filter.status")}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {pendingStatus.length > 0 && (
                      <span className="h-4 min-w-4 px-1 rounded-full bg-brand-indigo text-white text-[9px] font-bold flex items-center justify-center">{pendingStatus.length}</span>
                    )}
                    <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", expandedSection === "status" && "rotate-180")} />
                  </div>
                </button>
                {expandedSection === "status" && (
                  <div className="px-2 pb-2 space-y-1 bg-card border-t border-border/30">
                    {STATUS_FILTER_OPTIONS.map((status) => {
                      const active = pendingStatus.includes(status);
                      return (
                        <button
                          key={status}
                          onClick={() => toggleStatus(status)}
                          className={cn(
                            "w-full flex items-center gap-3 min-h-[44px] px-4 rounded-xl text-[14px] font-medium transition-colors",
                            active ? "bg-brand-indigo/10 text-brand-indigo" : "text-foreground/80 hover:bg-muted"
                          )}
                        >
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: STATUS_COLOR[status] ?? "var(--mute-2)" }} />
                          <span className="flex-1 text-left">{t(`statusLabels.${status}`, status)}</span>
                          {active && <Check className="h-4 w-4 text-brand-indigo shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="px-5 pt-4 flex items-center gap-3 shrink-0">
              <button
                onClick={handleReset}
                className="flex-1 min-h-[44px] rounded-2xl border border-border/50 text-[14px] font-semibold text-foreground/70 hover:text-foreground hover:bg-muted transition-colors"
              >
                {t("filter.reset")}
              </button>
              <button
                onClick={handleApply}
                className="flex-1 min-h-[44px] rounded-2xl bg-brand-indigo text-white text-[14px] font-semibold hover:opacity-90 transition-opacity"
              >
                {t("filter.apply")}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
