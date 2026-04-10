import { useState } from "react";
import { Globe, Copy, Check, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

interface CompanyTabProps {
  prospect: Record<string, any>;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <button
      onClick={handleCopy}
      className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted"
      title="Copy"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3 text-muted-foreground/50" />}
    </button>
  );
}

function parseJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    return raw.split("\n").filter(Boolean);
  }
}

export function CompanyTab({ prospect }: CompanyTabProps) {
  const { t } = useTranslation("prospects");
  const pageSummaries = parseJsonArray(prospect.page_summaries);
  const hasSummary = !!prospect.ai_summary;
  const hasPages = pageSummaries.length > 0;

  if (!hasSummary && !hasPages) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
        <Globe className="h-6 w-6 text-muted-foreground/20" />
        <p className="text-[11px] text-muted-foreground/40 italic">
          Enrich the website to see company insights
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {prospect.ai_summary && (
        <>
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
            {t("fields.companySummary", "Company Summary")}
          </h4>
          <p className="text-[11px] text-foreground/70 leading-relaxed">{prospect.ai_summary}</p>
        </>
      )}

      {pageSummaries.length > 0 && prospect.ai_summary && <div className="h-px bg-border/30" />}

      {pageSummaries.map((summary, i) => {
        const nlIdx = summary.indexOf("\n");
        const urlHeader = nlIdx !== -1 ? summary.slice(0, nlIdx).trim() : summary;
        const content = nlIdx !== -1 ? summary.slice(nlIdx + 1).trim() : "";
        return (
          <div key={i} className="group flex flex-col gap-1 p-2.5 rounded-lg bg-muted/40">
            <div className="flex items-start justify-between gap-1.5">
              <p className="text-[10px] font-medium text-muted-foreground/60 break-all leading-snug">{urlHeader}</p>
              <CopyButton text={summary} />
            </div>
            {content && <p className="text-[11px] text-foreground/70 leading-relaxed">{content}</p>}
          </div>
        );
      })}
    </div>
  );
}
