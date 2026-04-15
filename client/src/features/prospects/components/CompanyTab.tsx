import { useState } from "react";
import { Globe, Building2, Boxes, Package, Clock, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { StructuredBrief } from "./StructuredBrief";
import { PostsCarousel } from "./PostsCarousel";

interface CompanyTabProps {
  prospect: Record<string, any>;
  loading?: boolean;
}

type SubTab = "summary" | "services" | "products" | "history";

export function CompanyTab({ prospect, loading }: CompanyTabProps) {
  const { t } = useTranslation("prospects");
  const [sub, setSub] = useState<SubTab>("summary");

  const companyName = prospect.company || prospect.name || "Company";

  // New structured fields
  const summary = prospect.company_summary as string | undefined;
  const services = prospect.company_services as string | undefined;
  const products = prospect.company_products as string | undefined;
  const history = prospect.company_history as string | undefined;
  const posts = prospect.company_top_post_data;

  // Legacy fallback fields
  const legacyAiSummary = prospect.ai_summary as string | undefined;
  const legacyPageSummaries = prospect.page_summaries as string | undefined;

  const hasAny = !!(summary || services || products || history || posts || legacyAiSummary || legacyPageSummaries);

  if (!hasAny) {
    return (
      <div className="relative flex flex-col items-center justify-center py-8 text-center gap-2">
        <Globe className="h-6 w-6 text-muted-foreground/20" />
        <p className="text-[11px] text-muted-foreground/40 italic">
          {t("company.emptyHint", "Enrich the website to see company insights")}
        </p>
        {loading && <LoadingOverlay label={t("companyTab.loadingCompany", "Enriching company...")} />}
      </div>
    );
  }

  const subTabs: Array<{ key: SubTab; label: string; icon: React.ElementType; enabled: boolean }> = [
    { key: "summary", label: t("companyTab.summary", "Summary"), icon: Building2, enabled: true },
    { key: "services", label: t("companyTab.services", "Services"), icon: Boxes, enabled: !!services },
    { key: "products", label: t("companyTab.products", "Products"), icon: Package, enabled: !!products },
    { key: "history", label: t("companyTab.history", "History"), icon: Clock, enabled: !!history },
  ];

  return (
    <div className="relative flex flex-col gap-2.5">
      {loading && <LoadingOverlay label={t("companyTab.loadingCompany", "Enriching company...")} />}
      {/* Sub-tab bar */}
      <div className="flex items-center gap-1 p-0.5 bg-muted/40 rounded-lg">
        {subTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => tab.enabled && setSub(tab.key)}
            disabled={!tab.enabled}
            className={cn(
              "flex-1 inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded-md text-[11px] font-medium transition-colors",
              sub === tab.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
              !tab.enabled && "opacity-30 cursor-not-allowed hover:text-muted-foreground",
            )}
          >
            <tab.icon className="w-3 h-3" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {sub === "summary" && (
        <div className="flex flex-col gap-2.5">
          {posts && <PostsCarousel posts={posts} label={t("companyTab.topCompanyPosts", "Top Company Posts")} />}
          {summary ? (
            <StructuredBrief text={summary} title={t("companyTab.aboutCompany", "About {{name}}", { name: companyName })} />
          ) : legacyAiSummary ? (
            <div className="p-2.5 rounded-lg bg-muted/40">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-1.5">
                {t("fields.companySummary", "Company Summary")}
              </h4>
              <p className="text-[11px] text-foreground/70 leading-relaxed">{legacyAiSummary}</p>
            </div>
          ) : null}
          {!summary && !posts && !legacyAiSummary && (
            <EmptyHint text={t("companyTab.noSummary", "No summary yet. Run enrichment to populate.")} />
          )}
        </div>
      )}

      {sub === "services" && (
        services
          ? <StructuredBrief text={services} />
          : <EmptyHint text={t("companyTab.noServices", "No services data yet.")} />
      )}

      {sub === "products" && (
        products
          ? <StructuredBrief text={products} />
          : <EmptyHint text={t("companyTab.noProducts", "No products data yet.")} />
      )}

      {sub === "history" && (
        history
          ? <StructuredBrief text={history} />
          : <EmptyHint text={t("companyTab.noHistory", "No history data yet.")} />
      )}
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="py-4 px-3 text-center">
      <p className="text-[11px] text-muted-foreground/40 italic">{text}</p>
    </div>
  );
}

function LoadingOverlay({ label }: { label: string }) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 backdrop-blur-[1px] rounded-md">
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white dark:bg-slate-900 border border-border/60 shadow-sm">
        <Loader2 className="h-3 w-3 animate-spin text-brand-indigo" />
        <span className="text-[11px] font-medium text-foreground/70">{label}</span>
      </div>
    </div>
  );
}
