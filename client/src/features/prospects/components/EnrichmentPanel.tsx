import { useState, useCallback } from "react";
import { Sparkles, ChevronDown, Building2, User, Users } from "lucide-react";
import { relativeTime, cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { EnrichDropdown, type EnrichTarget } from "./EnrichDropdown";
import { MessageGenerator } from "./MessageGenerator";
import { CompanyTab } from "./CompanyTab";
import { ContactTab } from "./ContactTab";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProspectRow {
  [key: string]: any;
}

interface EnrichmentPanelProps {
  prospect: ProspectRow;
  onRefresh?: () => void;
  hideMessageGenerator?: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseOffers(raw: string | null | undefined): Array<{ text: string; checked?: boolean }> {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item: any) =>
      typeof item === "string" ? { text: item, checked: false } : { text: item.text, checked: !!item.checked }
    );
  } catch {
    return raw.split("\n").filter(Boolean).map(t => ({ text: t, checked: false }));
  }
}

function parseMessages(raw: string | null | undefined): Array<{ title: string; text: string; saved?: boolean }> {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function EnrichmentPanel({ prospect, onRefresh, hideMessageGenerator = false }: EnrichmentPanelProps) {
  const { t } = useTranslation("prospects");
  const prospectId = prospect.Id ?? prospect.id ?? 0;
  const [activeTab, setActiveTab] = useState<"company" | "contact1" | "contact2">("company");
  const [enriching, setEnriching] = useState<Set<EnrichTarget>>(new Set());
  const [open, setOpen] = useState(true);

  const handleLoadingChange = useCallback((s: Set<EnrichTarget>) => {
    setEnriching(new Set(s));
  }, []);

  const offerIdeas = parseOffers(prospect.offer_ideas);
  const savedMessages = parseMessages(prospect.generated_messages);

  // Data indicators for green dots
  const companyHasData = !!(prospect.ai_summary || prospect.page_summaries);
  const contact1HasData = !!(prospect.headline || prospect.photo_url);
  const contact2HasData = !!(prospect.contact2_headline || prospect.contact2_photo_url);

  const tabs: Array<{ key: "company" | "contact1" | "contact2"; label: string; icon: React.ComponentType<{ className?: string }>; hasData: boolean }> = [
    { key: "company", label: t("tabs.company", "Company"), icon: Building2, hasData: companyHasData },
    { key: "contact1", label: t("tabs.contact1", "Contact 1"), icon: User, hasData: contact1HasData },
    { key: "contact2", label: t("tabs.contact2", "Contact 2"), icon: Users, hasData: contact2HasData },
  ];

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-1 shrink-0">
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="flex flex-1 items-center gap-2 select-none min-w-0"
        >
          <Sparkles className={cn("h-4 w-4 shrink-0", open ? "text-brand-indigo/60" : "text-foreground/60")} />
          <span className="text-sm font-medium text-foreground/80">{t("sections.enrichment", "Enrichment")}</span>
          {prospect.enriched_at && (
            <span className="text-[10px] text-muted-foreground/40 shrink-0" title={new Date(prospect.enriched_at).toLocaleString()}>
              {relativeTime(prospect.enriched_at)}
            </span>
          )}
          <span className="ml-auto shrink-0 flex items-center" onClick={(e) => e.stopPropagation()}>
            <EnrichDropdown
              prospectId={prospectId}
              onDone={onRefresh}
              enrichedAt={prospect.enriched_at}
              companyEnrichedAt={prospect.company_enriched_at}
              onLoadingChange={handleLoadingChange}
              highlight={!companyHasData && !contact1HasData}
            />
          </span>
          <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform duration-200 text-foreground/40", !open && "-rotate-90")} />
        </button>
      </div>

      {/* Collapsible: tabs + content */}
      <div className={cn("grid transition-[grid-template-rows] duration-200", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
      <div className="overflow-hidden flex flex-col">

      {/* Tab bar */}
      <div className="flex items-center gap-1 px-3 pb-2 shrink-0">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "relative inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors min-w-0 flex-shrink",
                "sm:flex-1", // Equal width on larger screens
                activeTab === tab.key
                  ? "bg-brand-indigo/10 text-brand-indigo"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline truncate">{tab.label}</span>
              {tab.hasData && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" aria-label="Has data" />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="px-3 pb-4">
        {activeTab === "company" && <CompanyTab prospect={prospect} loading={enriching.has("company")} />}
        {activeTab === "contact1" && (
          <ContactTab prospect={prospect} slot={1} prospectId={prospectId} onRefresh={onRefresh} loading={enriching.has("contact1")} />
        )}
        {activeTab === "contact2" && (
          <ContactTab prospect={prospect} slot={2} prospectId={prospectId} onRefresh={onRefresh} loading={enriching.has("contact2")} />
        )}

        {/* Message Generator (hidden when used standalone in Panel 2) */}
        {!hideMessageGenerator && (
          <div className="mt-3 pt-3 border-t border-border/30">
            <MessageGenerator
              key={prospectId}
              prospectId={prospectId}
              offerIdeas={offerIdeas}
              contactName={prospect.contact_name}
              contact2Name={prospect.contact2_name}
              savedMessages={savedMessages}
              onRefresh={onRefresh}
            />
          </div>
        )}
      </div>
      </div>
      </div>
    </div>
  );
}
