import { useState } from "react";
import { Sparkles } from "lucide-react";
import { relativeTime, cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { EnrichDropdown } from "./EnrichDropdown";
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

export function EnrichmentPanel({ prospect, onRefresh }: EnrichmentPanelProps) {
  const { t } = useTranslation("prospects");
  const prospectId = prospect.Id ?? prospect.id ?? 0;
  const [activeTab, setActiveTab] = useState<"company" | "contact1" | "contact2">("company");

  const offerIdeas = parseOffers(prospect.offer_ideas);
  const savedMessages = parseMessages(prospect.generated_messages);

  // Data indicators for green dots
  const companyHasData = !!(prospect.ai_summary || prospect.page_summaries);
  const contact1HasData = !!(prospect.headline || prospect.photo_url);
  const contact2HasData = !!(prospect.contact2_headline || prospect.contact2_photo_url);

  const tabs: Array<{ key: "company" | "contact1" | "contact2"; label: string; hasData: boolean }> = [
    { key: "company", label: t("tabs.company", "Company"), hasData: companyHasData },
    { key: "contact1", label: t("tabs.contact1", "Contact 1"), hasData: contact1HasData },
    { key: "contact2", label: t("tabs.contact2", "Contact 2"), hasData: contact2HasData },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-3 pt-3 pb-1 shrink-0">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-brand-indigo/60" />
          <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">
            {t("sections.enrichment", "Enrichment")}
          </h4>
          {prospect.enriched_at && (
            <span className="text-[10px] text-muted-foreground/40" title={new Date(prospect.enriched_at).toLocaleString()}>
              {relativeTime(prospect.enriched_at)}
            </span>
          )}
        </div>
        <EnrichDropdown prospectId={prospectId} onDone={onRefresh} enrichedAt={prospect.enriched_at} />
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 px-3 pb-2 shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors",
              activeTab === tab.key
                ? "bg-brand-indigo/10 text-brand-indigo"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {tab.hasData && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
            )}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-6 scroll-fade-bottom">
        {activeTab === "company" && <CompanyTab prospect={prospect} />}
        {activeTab === "contact1" && (
          <ContactTab prospect={prospect} slot={1} prospectId={prospectId} onRefresh={onRefresh} />
        )}
        {activeTab === "contact2" && (
          <ContactTab prospect={prospect} slot={2} prospectId={prospectId} onRefresh={onRefresh} />
        )}

        {/* Message Generator (always visible, below tab content) */}
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
      </div>
    </div>
  );
}
