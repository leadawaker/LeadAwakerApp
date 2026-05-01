import { useState } from "react";
import { Globe, Building2, ClipboardCheck, Loader2, MapPin, Mail, Phone, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { StructuredBrief } from "./StructuredBrief";
import { PostsCarousel } from "./PostsCarousel";
import { CompanyAuditSection } from "./CompanyAuditSection";
import { useRotatingLabel } from "@/hooks/useRotatingLabel";

interface CompanyTabProps {
  prospect: Record<string, any>;
  loading?: boolean;
}

type SubTab = "summary" | "audit";

export function CompanyTab({ prospect, loading }: CompanyTabProps) {
  const { t } = useTranslation("prospects");
  const [sub, setSub] = useState<SubTab>("summary");

  const steps = t("companyTab.loadingCompanySteps", { returnObjects: true, defaultValue: [] }) as unknown;
  const stepLabels = Array.isArray(steps) ? (steps as string[]) : [];
  const fallbackLabel = t("companyTab.loadingCompany", "Enriching company...");
  const rotating = useRotatingLabel(stepLabels.length > 0 ? stepLabels : [fallbackLabel], !!loading);

  const companyName = prospect.company || prospect.name || "Company";

  const summary = prospect.company_summary as string | undefined;
  const audit = prospect.audit_insights as Record<string, any> | undefined;
  const posts = prospect.company_top_post_data;
  const legacyAiSummary = prospect.ai_summary as string | undefined;

  const hasAudit = !!(audit && (
    audit.strengths?.length ||
    audit.opportunities?.length ||
    audit.gaps?.length ||
    audit.lead_awaker_fit
  ));
  const hasAny = !!(summary || audit || posts || legacyAiSummary);

  if (!hasAny) {
    return (
      <div className="relative flex flex-col items-center justify-center py-8 text-center gap-2">
        <Globe className="h-6 w-6 text-muted-foreground/20" />
        <p className="text-[11px] text-muted-foreground/40 italic">
          {t("company.emptyHint", "Enrich the website to see company insights")}
        </p>
        {loading && <LoadingOverlay label={rotating} />}
      </div>
    );
  }

  const subTabs: Array<{ key: SubTab; label: string; icon: React.ElementType; enabled: boolean }> = [
    { key: "summary", label: t("companyTab.summary", "Summary"), icon: Building2, enabled: true },
    { key: "audit", label: t("companyTab.audit", "Audit"), icon: ClipboardCheck, enabled: hasAudit },
  ];

  const city = prospect.city as string | undefined;
  const website = prospect.website as string | undefined;
  const email = prospect.email as string | undefined;
  const phone = prospect.phone as string | undefined;

  return (
    <div className="relative flex flex-col gap-2.5">
      {loading && <LoadingOverlay label={rotating} />}

      {/* Company header */}
      <CompanyLogoSection website={website} companyName={companyName} />
      {(city || website || email || phone) && (
        <div className="flex flex-col gap-1 pb-2 border-b border-border/30">
          <div className="flex flex-col gap-0.5">
            {city && (
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                <span className="text-[11px] text-foreground/70">{city}</span>
              </div>
            )}
            {website && (
              <div className="flex items-center gap-1.5">
                <Globe className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                <a href={website} target="_blank" rel="noopener noreferrer" className="text-[11px] text-foreground/70 hover:text-foreground truncate">{website}</a>
              </div>
            )}
            {email && (
              <div className="flex items-center gap-1.5">
                <Mail className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                <a href={`mailto:${email}`} className="text-[11px] text-foreground/70 hover:text-foreground truncate">{email}</a>
              </div>
            )}
            {phone && (
              <div className="flex items-center gap-1.5">
                <Phone className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                <a href={`tel:${phone}`} className="text-[11px] text-foreground/70 hover:text-foreground">{phone}</a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sub-tab bar */}
      <div className="flex items-center gap-1 p-0.5 bg-muted/40 rounded-lg">
        {subTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => tab.enabled && setSub(tab.key)}
            disabled={!tab.enabled}
            className={cn(
              "inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded-md text-[11px] font-medium transition-colors min-w-0 flex-shrink",
              "sm:flex-1", // Equal width on larger screens
              sub === tab.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
              !tab.enabled && "opacity-30 cursor-not-allowed hover:text-muted-foreground",
            )}
          >
            <tab.icon className="w-3 h-3 shrink-0" />
            <span className="hidden sm:inline truncate">{tab.label}</span>
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

      {sub === "audit" && (
        <CompanyAuditSection insights={audit as any} />
      )}

    </div>
  );
}

function CompanyLogoSection({ website, companyName }: { website?: string; companyName: string }) {
  const [logoFailed, setLogoFailed] = useState(false);
  const [zoomed, setZoomed] = useState(false);

  let domain: string | null = null;
  if (website) {
    try {
      domain = new URL(website.startsWith("http") ? website : `https://${website}`).hostname.replace(/^www\./, "");
    } catch {
      domain = null;
    }
  }

  const logoUrl = domain && !logoFailed ? `https://logo.clearbit.com/${domain}` : null;

  return (
    <div className="flex items-start gap-3.5">
      {logoUrl && (
        <>
          <img
            src={logoUrl}
            alt={companyName}
            className="w-20 h-20 rounded-full object-contain p-1 bg-white shrink-0 border border-border/30 cursor-zoom-in"
            onClick={() => setZoomed(true)}
            onError={() => setLogoFailed(true)}
            title="Click to enlarge"
          />
          {zoomed && (
            <div
              className="fixed inset-0 z-50 flex items-end justify-center pb-16 pt-24"
              onClick={() => setZoomed(false)}
            >
              <div className="relative max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
                <img
                  src={logoUrl}
                  alt={companyName}
                  className="w-full rounded-2xl object-contain bg-white p-4 shadow-2xl"
                />
                <p className="text-center text-foreground/70 text-[13px] font-medium mt-2">{companyName}</p>
                <button
                  onClick={() => setZoomed(false)}
                  className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-white border border-border text-foreground flex items-center justify-center hover:bg-muted transition-colors shadow-sm"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
      <div className="flex-1 min-w-0 flex flex-col justify-center pt-1">
        <p className="text-[16px] font-semibold text-foreground">{companyName}</p>
      </div>
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
    <div className="absolute inset-0 z-10 flex flex-col gap-2 bg-background/85 backdrop-blur-[1px] rounded-md p-2 overflow-hidden">
      <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-brand-indigo/5 border border-brand-indigo/20 text-brand-indigo text-[11px] font-medium">
        <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
        <span className="truncate">{label}</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="w-16 h-16 rounded-full bg-brand-indigo/10 border border-dashed border-brand-indigo/30 animate-pulse shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="h-2.5 w-1/2 rounded bg-brand-indigo/20 animate-pulse" />
          <div className="h-2 w-2/3 rounded bg-brand-indigo/10 animate-pulse" />
        </div>
      </div>
      <div className="space-y-1.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="w-full p-2 rounded-lg border border-dashed border-brand-indigo/30 bg-brand-indigo/5 animate-pulse">
            <div className="h-2.5 w-1/3 rounded bg-brand-indigo/20 mb-1.5" />
            <div className="h-2 w-full rounded bg-brand-indigo/10 mb-1" />
            <div className="h-2 w-2/3 rounded bg-brand-indigo/10" />
          </div>
        ))}
      </div>
    </div>
  );
}
