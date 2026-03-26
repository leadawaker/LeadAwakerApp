import { useTranslation } from "react-i18next";
import { CheckCircle2, XCircle, ListChecks } from "lucide-react";

/** Renders qualification criteria in a structured, readable format */
export function QualificationCriteriaDisplay({ raw }: { raw: string | null | undefined }) {
  const { t } = useTranslation("campaigns");
  if (!raw) {
    return (
      <div
        className="flex flex-col items-center justify-center py-6 text-center"
        data-testid="campaign-detail-qualification-empty"
      >
        <ListChecks className="w-6 h-6 text-muted-foreground/30 mb-2" />
        <p className="text-[12px] text-muted-foreground italic">{t("panel.noQualificationCriteria")}</p>
      </div>
    );
  }

  // Try to parse as JSON
  let parsed: Record<string, unknown> | null = null;
  try {
    const p = JSON.parse(raw);
    if (typeof p === "object" && p !== null && !Array.isArray(p)) {
      parsed = p as Record<string, unknown>;
    }
  } catch {
    // Not valid JSON — fall through to plain text
  }

  if (parsed) {
    return (
      <div
        className="space-y-2"
        data-testid="campaign-detail-qualification-criteria"
      >
        {Object.entries(parsed).map(([key, value]) => {
          const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
          let displayValue: React.ReactNode;

          if (typeof value === "boolean") {
            displayValue = value ? (
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {t("confirm.yes")}
              </span>
            ) : (
              <span className="flex items-center gap-1 text-slate-500">
                <XCircle className="w-3.5 h-3.5" />
                {t("confirm.no")}
              </span>
            );
          } else if (Array.isArray(value)) {
            displayValue = (
              <div className="flex flex-wrap gap-1 justify-end">
                {(value as unknown[]).map((item, i) => (
                  <span
                    key={i}
                    className="inline-block bg-muted rounded-md px-1.5 py-0.5 text-[10px] font-medium text-foreground"
                  >
                    {String(item)}
                  </span>
                ))}
              </div>
            );
          } else if (typeof value === "number") {
            displayValue = (
              <span className="font-mono text-[11px] text-foreground">
                {value.toLocaleString()}
              </span>
            );
          } else {
            displayValue = (
              <span className="text-[12px] text-foreground break-words text-right max-w-[60%]">
                {String(value ?? "—")}
              </span>
            );
          }

          return (
            <div
              key={key}
              className="flex items-start justify-between gap-3 py-1.5 border-b border-border/40 last:border-0"
            >
              <span className="text-[11px] text-muted-foreground shrink-0 pt-0.5">{label}</span>
              <span className="text-right">{displayValue}</span>
            </div>
          );
        })}
      </div>
    );
  }

  // Plain text fallback
  return (
    <div
      className="rounded-lg bg-muted/30 p-3"
      data-testid="campaign-detail-qualification-criteria"
    >
      <p className="text-[12px] text-foreground leading-relaxed whitespace-pre-wrap break-words">
        {raw}
      </p>
    </div>
  );
}
