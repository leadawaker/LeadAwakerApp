import { useId } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DemoLang } from "@/features/campaigns/api/demoClientsApi";
import type { AiDisclosure, DemoMarket } from "@shared/demoProspects";
import { TOUCH_ROW } from "../../touchTargets";
import { FormField } from "./FormField";

// A Select needs a non-empty item value, so the "" settings (campaign default, language default) travel as this.
const DEFAULT = "default";
const DISCLOSURES: readonly Exclude<AiDisclosure, "">[] = ["off", "opener", "second_message"];
const MARKETS: readonly { id: Exclude<DemoMarket, "">; label: string }[] = [
  { id: "uk", label: "UK (£)" },
  { id: "us", label: "US ($)" },
  { id: "nl", label: "NL (€)" },
];

/**
 * The settings most demos leave alone, behind a disclosure: how the AI announces itself, and the
 * English market (which picks the currency and the accent). The market only matters for English.
 */
export function MoreOptions({ open, onOpenChange, language, aiDisclosure, market, onChange }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  language: DemoLang;
  aiDisclosure: AiDisclosure;
  market: DemoMarket;
  onChange: (patch: { aiDisclosure?: AiDisclosure; market?: DemoMarket }) => void;
}) {
  const { t } = useTranslation("demos");
  const bodyId = useId();
  return (
    <div className="space-y-3">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => onOpenChange(!open)}
        className={`flex items-center gap-1.5 ${TOUCH_ROW}`}
        style={{ fontSize: 12.5, fontWeight: 600, color: "var(--mute)" }}
      >
        <ChevronDown size={14} className="transition-transform" style={{ transform: open ? "none" : "rotate(-90deg)" }} />
        {t("create.moreOptions")}
      </button>
      {open && (
        <div id={bodyId} className="space-y-4">
          <FormField label={t("create.disclosure")}>
            <Select value={aiDisclosure || DEFAULT} onValueChange={(v) => onChange({ aiDisclosure: v === DEFAULT ? "" : (v as AiDisclosure) })}>
              <SelectTrigger className={TOUCH_ROW} aria-label={t("create.disclosure")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={DEFAULT}>{t("create.disclosureDefault")}</SelectItem>
                {DISCLOSURES.map((d) => (
                  <SelectItem key={d} value={d}>
                    {t(`disclosure.${d}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          {language === "en" && (
            <FormField label={t("create.market")}>
              <Select value={market || DEFAULT} onValueChange={(v) => onChange({ market: v === DEFAULT ? "" : (v as DemoMarket) })}>
                <SelectTrigger className={TOUCH_ROW} aria-label={t("create.market")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={DEFAULT}>{t("create.marketDefault")}</SelectItem>
                  {MARKETS.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          )}
        </div>
      )}
    </div>
  );
}
