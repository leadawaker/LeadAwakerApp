// "Preview as": whose values the preview and the Variables panel show. Campaigns
// that run this prompt come first, then the rest by account, then the demo clients.
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { CampaignForPreview } from "../../utils/resolveVariables";
import { campaignKey, clientKey, type PreviewContextKey } from "../../utils/previewContext";
import type { DemoClientOption } from "./usePreviewContext";

const isActive = (c: CampaignForPreview) => String(c.status ?? "").toLowerCase().trim() === "active";

export function PreviewAsPicker({ value, onChange, campaigns, servingIds, accountNames, demoClients }: {
  value: PreviewContextKey;
  onChange: (key: PreviewContextKey) => void;
  campaigns: CampaignForPreview[];
  servingIds: number[];
  accountNames: Map<number, string>;
  demoClients: DemoClientOption[];
}) {
  const { t } = useTranslation("prompts");

  const { serving, byAccount } = useMemo(() => {
    const ids = new Set(servingIds);
    const groups = new Map<string, CampaignForPreview[]>();
    for (const c of campaigns) {
      if (ids.has(c.id)) continue;
      const name = (c.accountsId && accountNames.get(c.accountsId)) || t("usedBy.noAccount");
      groups.set(name, [...(groups.get(name) ?? []), c]);
    }
    const sorted = [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, list]) => [name, [...list].sort((a, b) => Number(isActive(b)) - Number(isActive(a)))] as const);
    return { serving: campaigns.filter((c) => ids.has(c.id)), byAccount: sorted };
  }, [campaigns, servingIds, accountNames, t]);

  const label = (c: CampaignForPreview) => {
    const account = c.accountsId ? accountNames.get(c.accountsId) : undefined;
    return account ? t("previewAs.campaignOf", { name: c.name, account }) : c.name;
  };

  return (
    <label className="flex items-center gap-2 min-w-0" style={{ flex: "1 1 170px", maxWidth: 340 }}>
      <span className="shrink-0" style={{ fontSize: 11.5, fontWeight: 600, color: "var(--mute)" }}>{t("previewAs.label")}</span>
      <select
        className="neu-inset-super-crisp outline-none cursor-pointer min-w-0 flex-1"
        style={{ fontSize: 12, color: "var(--ink)", borderRadius: "var(--r-pill)", padding: "3px 8px", border: "none" }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{t("previewAs.none")}</option>
        {serving.length > 0 && (
          <optgroup label={t("previewAs.uses")}>
            {serving.map((c) => <option key={c.id} value={campaignKey(c.id)}>{label(c)}</option>)}
          </optgroup>
        )}
        {byAccount.map(([name, list]) => (
          <optgroup key={name} label={name}>
            {list.map((c) => <option key={c.id} value={campaignKey(c.id)}>{c.name}</option>)}
          </optgroup>
        ))}
        {demoClients.length > 0 && (
          <optgroup label={t("previewAs.demoClients")}>
            {demoClients.map((d) => <option key={d.niche} value={clientKey(d.niche)}>{d.label}</option>)}
          </optgroup>
        )}
      </select>
    </label>
  );
}
