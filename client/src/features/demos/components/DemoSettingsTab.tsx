// Demos > Settings. One side tab (SectionRail) per service, from the same
// SERVICES list the New demo form and the sessions table read, so a new
// service gets its settings tab without anyone remembering to add it here.
//
// The AI receptionist comes first. Only DBR shows its campaign's full settings
// (Business, AI, Behavior); the other chat demos run on the shared demo setup,
// so their tiles hold only what is their own (the widget's agent photo).
// Quote follow-up runs on the DBR campaign and has no tile here.
import { useTranslation } from "react-i18next";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useLastTab } from "@/hooks/useLastTab";
import { SectionHeader, SectionLayout, SectionRail, type SectionRailItem } from "@/features/accounts/components/workspace/SectionRail";
import { SERVICES } from "../services";
import { DemoCampaignSettings, useDemoCampaigns } from "./DemoCampaignSettings";
import { ElevenDemoSettings } from "./ElevenDemoSettings";
import { VoiceCallsSettings } from "./VoiceCallsSettings";
import { PublicDemoSettings } from "./PublicDemoSettings";
import { WidgetSettings } from "./WidgetSettings";

/** The service whose campaign settings show here. */
const CAMPAIGN_TILE = "dbr";
/** Services without a tile: they run on another tile's campaign. */
const HIDDEN = new Set(["quote"]);

const TILES = [
  ...SERVICES.filter((s) => s.voice),
  ...SERVICES.filter((s) => !s.voice && !HIDDEN.has(s.key)),
];
const TILE_KEYS: readonly string[] = TILES.map((s) => s.key);

export function DemoSettingsTab() {
  const { t } = useTranslation("demos");
  const stacked = useIsMobile(768);
  // Reopens on the tile used last.
  const [service, setService] = useLastTab<string>("demos.settings", TILE_KEYS, TILES[0]!.key);
  const { data: demoCampaigns = [] } = useDemoCampaigns();
  const tile = TILES.find((s) => s.key === service) ?? TILES[0]!;
  const campaignId = tile.key === CAMPAIGN_TILE ? tile.campaignId : null;

  const detailOf = (key: string) => {
    if (key === "voice") return t("settings.rail.voice");
    if (key === "widget") return t("settings.widget.avatarTitle");
    if (key === CAMPAIGN_TILE) {
      const id = TILES.find((s) => s.key === key)?.campaignId;
      return demoCampaigns.find((c) => c.id === id)?.name || `#${id}`;
    }
    return t("settings.rail.shared");
  };
  const items: SectionRailItem<string>[] = TILES.map((s) => ({
    key: s.key, icon: <s.icon size={16} />, label: t(s.labelKey), detail: detailOf(s.key),
  }));
  const index = items.findIndex((i) => i.key === tile.key);

  return (
    <div
      className="h-full min-h-0 overflow-y-auto"
      // The menu sticks 18px under the top of this scroller, level with its padding (SectionLayout adds 32px).
      style={{ padding: "18px 24px 24px", ["--ws-sticky-top" as string]: "-14px" }}
    >
      <div className="la-page-center">
        <SectionLayout
          stacked={stacked}
          testId="demo-settings"
          rail={(layout) => (
            <SectionRail items={items} active={tile.key} onSelect={setService} layout={layout} testId="demo-settings-rail" ariaLabel={t("settings.rail.label")} />
          )}
        >
          <section style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>
            <SectionHeader
              index={index + 1}
              title={t(tile.labelKey)}
              help={campaignId != null ? t("settings.campaign.help") : detailOf(tile.key)}
            />
            {tile.voice ? (
              <>
                <ElevenDemoSettings />
                <VoiceCallsSettings />
                <PublicDemoSettings />
              </>
            ) : campaignId != null ? (
              <DemoCampaignSettings key={campaignId} campaignId={campaignId} />
            ) : tile.key === "widget" ? (
              <WidgetSettings />
            ) : (
              <span style={{ fontSize: 13, color: "var(--mute-2)" }}>{t("settings.empty")}</span>
            )}
          </section>
        </SectionLayout>
      </div>
    </div>
  );
}
