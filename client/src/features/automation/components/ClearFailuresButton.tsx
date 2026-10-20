import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { ResolveFailuresBody } from "@shared/automationTypes";
import { useResolveFailures } from "../api";

/**
 * "Clear failures" for a category or one automation, with an inline confirm.
 * Clearing marks the open failures as fixed (resolved_at); the diary keeps every line.
 */
export function ClearFailuresButton({ count, scope, compact = false }: {
  count: number;
  scope: ResolveFailuresBody;
  compact?: boolean;
}) {
  const { t } = useTranslation("automation");
  const { toast } = useToast();
  const m = useResolveFailures();
  const [confirming, setConfirming] = useState(false);
  if (count <= 0) return null;

  const run = () => m.mutate(scope, {
    onSuccess: (r) => { setConfirming(false); toast({ title: t("clear.done", { count: r.resolved }) }); },
    onError: () => toast({ title: t("clear.error"), variant: "destructive" }),
  });

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  if (confirming) {
    return (
      <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }} onClick={stop}>
        <button type="button" className="la-btn la-btn--soft" onClick={run} disabled={m.isPending} data-testid="automation-clear-confirm">
          {m.isPending ? t("clear.working") : compact ? t("clear.confirmAll") : t("clear.confirm", { count })}
        </button>
        <button type="button" className="la-btn la-btn--plain" onClick={() => setConfirming(false)} disabled={m.isPending}>
          {t("clear.cancel")}
        </button>
      </span>
    );
  }
  return (
    <button
      type="button"
      className="la-btn la-btn--soft"
      onClick={(e) => { stop(e); setConfirming(true); }}
      title={t("clear.hint")}
      data-testid="automation-clear"
      style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
    >
      <CheckCheck className="h-3.5 w-3.5" />
      {compact ? t("clear.short") : t("clear.label", { count })}
    </button>
  );
}
