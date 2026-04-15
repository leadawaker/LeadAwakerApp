import { useState } from "react";
import { Building2, Package, Boxes, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StructuredBrief } from "./StructuredBrief";
import { PostsCarousel } from "./PostsCarousel";
import type { ProspectRow } from "./ProspectListView";

/**
 * Company-level enrichment section. Renders AI-generated summary, posts carousel,
 * and tabs for Services / Products / History.
 *
 * Returns null if there's no company enrichment data at all (not even a company name).
 */
export function CompanySummarySection({
  prospect,
  label,
}: {
  prospect: ProspectRow;
  label: string;
}) {
  const hasAny =
    prospect.company_summary ||
    prospect.company_services ||
    prospect.company_products ||
    prospect.company_history ||
    prospect.company_top_post_data;

  if (!hasAny) return null;

  const { t } = useTranslation("prospects");
  const [tab, setTab] = useState("summary");
  const companyName = prospect.company || prospect.name || "Company";

  return (
    <div className="pt-3 mt-1">
      <div className="flex items-center gap-1.5 mb-2">
        <Building2 className="w-3 h-3 text-foreground/40" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">
          {label}
        </span>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="h-auto p-0.5 bg-slate-100 dark:bg-slate-800/40 rounded-lg flex w-full">
          <TabTrigger value="summary" icon={Building2}>{t("companyTab.summary", "Summary")}</TabTrigger>
          <TabTrigger value="services" icon={Boxes} disabled={!prospect.company_services}>
            {t("companyTab.services", "Services")}
          </TabTrigger>
          <TabTrigger value="products" icon={Package} disabled={!prospect.company_products}>
            {t("companyTab.products", "Products")}
          </TabTrigger>
          <TabTrigger value="history" icon={Clock} disabled={!prospect.company_history}>
            {t("companyTab.history", "History")}
          </TabTrigger>
        </TabsList>

        <TabsContent value="summary" className="mt-2 space-y-2">
          {prospect.company_top_post_data && (
            <PostsCarousel posts={prospect.company_top_post_data} label={t("companyTab.topCompanyPosts", "Top Company Posts")} />
          )}
          <StructuredBrief text={prospect.company_summary} title={t("companyTab.aboutCompany", "About {{name}}", { name: companyName })} />
          {!prospect.company_summary && !prospect.company_top_post_data && (
            <EmptyHint text={t("companyTab.noSummary", "No summary yet. Run enrichment to populate.")} />
          )}
        </TabsContent>

        <TabsContent value="services" className="mt-2">
          <StructuredBrief text={prospect.company_services} />
          {!prospect.company_services && <EmptyHint text={t("companyTab.noServices", "No services data yet.")} />}
        </TabsContent>

        <TabsContent value="products" className="mt-2">
          <StructuredBrief text={prospect.company_products} />
          {!prospect.company_products && <EmptyHint text={t("companyTab.noProducts", "No products data yet.")} />}
        </TabsContent>

        <TabsContent value="history" className="mt-2">
          <StructuredBrief text={prospect.company_history} />
          {!prospect.company_history && <EmptyHint text={t("companyTab.noHistory", "No history data yet.")} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TabTrigger({
  value,
  icon: Icon,
  disabled,
  children,
}: {
  value: string;
  icon: React.ElementType;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <TabsTrigger
      value={value}
      disabled={disabled}
      className="flex-1 flex items-center justify-center gap-1 text-[11px] font-medium py-1.5 px-2 rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm data-[state=active]:text-foreground text-foreground/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
    >
      <Icon className="w-3 h-3" />
      {children}
    </TabsTrigger>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="py-4 px-3 text-center">
      <div className="text-[11px] text-foreground/40 italic">{text}</div>
    </div>
  );
}
