import { useTranslation } from "react-i18next";
import { CheckCircle2, Lightbulb, AlertTriangle, Sparkles, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

type Item = { title?: string; detail?: string; quick_win?: boolean };
type Fit = { fit_score?: "high" | "medium" | "low"; angle?: string; pitch_hook?: string };
type AuditInsights = {
  strengths?: Item[];
  opportunities?: Item[];
  gaps?: Item[];
  lead_awaker_fit?: Fit;
  generated_at?: string;
};

interface Props {
  insights?: AuditInsights | null;
}

export function CompanyAuditSection({ insights }: Props) {
  const { t } = useTranslation("prospects");

  if (!insights || (
    !insights.strengths?.length &&
    !insights.opportunities?.length &&
    !insights.gaps?.length &&
    !insights.lead_awaker_fit
  )) {
    return (
      <div className="py-4 px-3 text-center">
        <p className="text-[11px] text-muted-foreground/40 italic">
          {t("audit.empty", "Audit not yet generated. Re-run enrichment.")}
        </p>
      </div>
    );
  }

  const { strengths, opportunities, gaps, lead_awaker_fit } = insights;

  return (
    <div className="flex flex-col gap-2.5">
      {!!strengths?.length && (
        <AuditCard
          icon={CheckCircle2}
          iconClass="text-emerald-500"
          title={t("audit.strengths", "Strengths")}
          items={strengths}
        />
      )}
      {!!opportunities?.length && (
        <AuditCard
          icon={Lightbulb}
          iconClass="text-amber-500"
          title={t("audit.opportunities", "Opportunities")}
          items={opportunities}
          showQuickWin
        />
      )}
      {!!gaps?.length && (
        <AuditCard
          icon={AlertTriangle}
          iconClass="text-rose-500"
          title={t("audit.gaps", "Gaps")}
          items={gaps}
        />
      )}
      {lead_awaker_fit && (lead_awaker_fit.angle || lead_awaker_fit.pitch_hook) && (
        <FitCard fit={lead_awaker_fit} />
      )}
    </div>
  );
}

function AuditCard({
  icon: Icon,
  iconClass,
  title,
  items,
  showQuickWin,
}: {
  icon: React.ElementType;
  iconClass: string;
  title: string;
  items: Item[];
  showQuickWin?: boolean;
}) {
  return (
    <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-border/60 shadow-sm">
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className={cn("h-3.5 w-3.5 shrink-0", iconClass)} />
        <div className="text-[9px] font-bold uppercase tracking-widest text-brand-indigo dark:text-blue-400">
          {title}
        </div>
      </div>
      <div className="space-y-1.5">
        {items.map((it, i) => (
          <div key={i} className="text-[12px] text-foreground/80 leading-relaxed">
            {it.title && (
              <span className="font-medium text-foreground">
                {it.title}
                {showQuickWin && it.quick_win && (
                  <Zap className="inline h-3 w-3 ml-1 text-amber-500" />
                )}
                {it.detail ? ": " : ""}
              </span>
            )}
            {it.detail && <span className="text-foreground/70">{it.detail}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function FitCard({ fit }: { fit: Fit }) {
  const { t } = useTranslation("prospects");
  const score = fit.fit_score;
  const scoreClass =
    score === "high"
      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
      : score === "medium"
        ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
        : score === "low"
          ? "bg-rose-500/10 text-rose-600 border-rose-500/30"
          : "bg-muted text-muted-foreground border-border";

  return (
    <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-border/60 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-brand-indigo" />
          <div className="text-[9px] font-bold uppercase tracking-widest text-brand-indigo dark:text-blue-400">
            {t("audit.leadAwakerFit", "Lead Awaker Fit")}
          </div>
        </div>
        {score && (
          <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded border uppercase tracking-wide", scoreClass)}>
            {score}
          </span>
        )}
      </div>
      <div className="space-y-1.5">
        {fit.angle && (
          <div className="text-[12px] text-foreground/80 leading-relaxed">
            <span className="font-medium text-foreground">{t("audit.angle", "Angle")}: </span>
            <span className="text-foreground/70">{fit.angle}</span>
          </div>
        )}
        {fit.pitch_hook && (
          <div className="text-[12px] text-foreground/80 leading-relaxed">
            <span className="font-medium text-foreground">{t("audit.pitchHook", "Pitch hook")}: </span>
            <span className="text-foreground/70">{fit.pitch_hook}</span>
          </div>
        )}
      </div>
    </div>
  );
}
