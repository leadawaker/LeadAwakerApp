import { useTranslation } from "react-i18next";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DemoLang } from "@/features/campaigns/api/demoClientsApi";
import type { AiDisclosure, DemoMarket } from "@shared/demoProspects";
import { DISCLOSURES, MARKETS, fromOption, marketApplies, toOption } from "../../settingsOptions";
import { TOUCH_ROW } from "../../touchTargets";
import { FormField } from "./FormField";

/**
 * The two settings most demos leave alone, always on show: how the AI announces itself, and the
 * English market (which picks the currency and the accent). The market only matters for English,
 * so for the other languages it stays visible but disabled, with a line saying why.
 */
export function DisclosureMarketFields({ language, aiDisclosure, market, onChange }: {
  language: DemoLang;
  aiDisclosure: AiDisclosure;
  market: DemoMarket;
  onChange: (patch: { aiDisclosure?: AiDisclosure; market?: DemoMarket }) => void;
}) {
  const { t } = useTranslation("demos");
  const marketOn = marketApplies(language);
  return (
    <div className="space-y-4">
      <FormField label={t("create.disclosure")}>
        <Select value={toOption(aiDisclosure)} onValueChange={(v) => onChange({ aiDisclosure: fromOption(v) as AiDisclosure })}>
          <SelectTrigger className={TOUCH_ROW} aria-label={t("create.disclosure")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={toOption("")}>{t("create.disclosureDefault")}</SelectItem>
            {DISCLOSURES.map((d) => (
              <SelectItem key={d} value={d}>
                {t(`disclosure.${d}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>
      <FormField label={t("create.market")} hint={marketOn ? undefined : t("createPanel.marketEnglishOnly")}>
        <Select disabled={!marketOn} value={toOption(market)} onValueChange={(v) => onChange({ market: fromOption(v) as DemoMarket })}>
          <SelectTrigger className={TOUCH_ROW} aria-label={t("create.market")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={toOption("")}>{t("create.marketDefault")}</SelectItem>
            {MARKETS.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>
    </div>
  );
}
