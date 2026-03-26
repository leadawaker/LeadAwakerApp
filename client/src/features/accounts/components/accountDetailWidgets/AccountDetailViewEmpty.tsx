import type { ReactNode } from "react";
import { Building2 } from "lucide-react";
import { useTranslation } from "react-i18next";

// ── Empty state ────────────────────────────────────────────────────────────────

export function AccountDetailViewEmpty({ toolbarPrefix }: { toolbarPrefix?: ReactNode }) {
  const { t } = useTranslation("accounts");
  return (
    <div className="flex-1 flex flex-col">
      {toolbarPrefix && (
        <div className="shrink-0 px-4 pt-5 pb-3">
          <div className="flex items-center gap-1 flex-wrap">
            {toolbarPrefix}
          </div>
        </div>
      )}
      <div className="flex-1 flex flex-col items-center justify-center gap-5 p-8 text-center">
        <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-stone-50 to-gray-100 flex items-center justify-center ring-1 ring-stone-200/50">
          <Building2 className="h-10 w-10 text-stone-400" />
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-semibold text-foreground/70">{t("empty.title")}</p>
          <p className="text-xs text-muted-foreground max-w-[180px] leading-relaxed">
            {t("empty.description")}
          </p>
        </div>
        <div className="text-[11px] text-stone-400 font-medium">{t("empty.chooseFromList")}</div>
      </div>
    </div>
  );
}
