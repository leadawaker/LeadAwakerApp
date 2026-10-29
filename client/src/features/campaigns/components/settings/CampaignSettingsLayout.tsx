import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Building2, Bot, SlidersHorizontal, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionHeader, SectionLayout, SectionRail, type SectionRailItem } from "@/features/accounts/components/workspace/SectionRail";
import { BusinessSectionFields } from "./BusinessSectionFields";
import { AISectionFields } from "./AISectionFields";
import { BehaviorSectionFields } from "./BehaviorSectionFields";
import { CampaignGenerateButton } from "./CampaignGenerateButton";
import { isServiceDemoCampaign, type DemoMode } from "../../demoMode";

// Opens WhatsApp on a chat with the Lead Awaker AI line, "/start" prefilled.
// wa.me can only prefill the text box — the operator taps send and the AI replies.
const LAUNCH_WA_NUMBER = "31627458300";
const LAUNCH_WA_MESSAGE = "/start";

// Every service demo (universal DBR, speed to lead, ...) generates its business
// persona per lead, so the Business tab is hidden for all of them: only the
// opener template and agent name remain operator-editable, and they live in the
// AI tab instead. See isServiceDemoCampaign for the shared list.

type SettingsSection = "business" | "ai" | "behavior";

interface SectionDef {
  id: SettingsSection;
  labelKey: string;
  titleKey: string;
  descKey: string;
  icon: React.ElementType;
}

interface CampaignSettingsLayoutProps {
  campaign: any;
  isEditing: boolean;
  draft: Record<string, unknown>;
  setDraft: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  focusField?: string | null;
  onStartEditField?: (field: string) => void;
  isAgency?: boolean;
  /** Section to open first (deep link from the Automations tab). */
  initialSection?: "business" | "ai" | "behavior";
  contracts?: any[];
  conversationPrompts?: any[];
  onNicheChange?: (niche: string) => void;
  /** Mobile / narrow: the section tiles sit in a grid above the open section, chrome shrinks.
   * Wide: the tiles stand in a sticky column; the host scroller sets --ws-sticky-top
   * (see SectionLayout) so the column sticks under its own header. */
  compact?: boolean;
  onGenerated?: () => void;
  /** Merge a /generate response's filled fields into draft + originalDraft
   * (see useCampaignDetail.applyGeneratedFields). Passed to both callers of
   * that endpoint: NicheSelect (create-niche) and CampaignGenerateButton. */
  onFieldsGenerated?: (fields: Record<string, unknown>) => void;
}

export function CampaignSettingsLayout(props: CampaignSettingsLayoutProps) {
  const { t } = useTranslation("campaigns");
  const { compact = false } = props;
  const isUniversal = isServiceDemoCampaign(
    (props.campaign?.id ?? props.campaign?.Id) as number | undefined,
  );
  const [active, setActive] = useState<SettingsSection>(props.initialSection ?? (isUniversal ? "ai" : "business"));
  // Optional name typed live during a discovery-call screenshare. Rides along in
  // the Launch button's "/start <campaignId> <name>" message so the engine
  // switches the VIP lead to this campaign and sets first_name before replaying
  // the opener. Name empty → "/start <campaignId>"; both empty → plain "/start".
  const [launchName, setLaunchName] = useState("");
  // Which conversation type to run THIS demo as. Transient on purpose, exactly
  // like launchName above: conversation_mode_override is a column on the
  // Campaigns row, so setting it on campaign 60 would repoint the public
  // homepage demo for every visitor at once, permanently. This rides along in
  // the /start payload instead and the engine writes it per lead.
  // Defaults to "scoping" because that is what the engine already derives for a
  // lead with no stage set (derive_conversation_mode("") -> "scoping"), so the
  // control starts by describing what would happen anyway.
  const [demoMode, setDemoMode] = useState<DemoMode>("scoping");
  const launchCampaignId = (props.campaign?.id || props.campaign?.Id) as number | undefined;
  // "scoping"/"decision" are accepted verbatim by the engine's /scenario alias
  // table, so the token is the same word end to end: UI, launch payload, engine.
  const launchText = [LAUNCH_WA_MESSAGE, launchCampaignId, isUniversal ? demoMode : "", launchName.trim()]
    .filter((p) => p !== undefined && p !== "" && p !== null)
    .join(" ");

  const allSections: SectionDef[] = [
    { id: "business", labelKey: "config.sections.business", titleKey: "config.sections.businessTitle", descKey: "config.sections.businessDesc", icon: Building2 },
    { id: "ai",       labelKey: "config.sections.ai",       titleKey: "config.sections.aiTitle",       descKey: "config.sections.aiDesc",       icon: Bot },
    { id: "behavior", labelKey: "config.sections.behavior", titleKey: "config.sections.behaviorTitle", descKey: "config.sections.behaviorDesc", icon: SlidersHorizontal },
  ];
  const sections = isUniversal ? allSections.filter((s) => s.id !== "business") : allSections;

  // `active` can point at the hidden Business tab when switching onto the
  // universal campaign with a stale selection: fall back to the first tab.
  const cur = sections.find((s) => s.id === active) ?? sections[0];
  const curIdx = sections.indexOf(cur);

  const items: SectionRailItem<SettingsSection>[] = sections.map((s) => ({
    key: s.id,
    icon: <s.icon size={16} />,
    label: t(s.labelKey),
    detail: t(s.descKey),
  }));

  return (
    <div className="max-w-[1386px] mr-auto" style={{ width: '100%' }}>
      <SectionLayout
        stacked={compact}
        testId="campaign-settings"
        rail={(layout) => (
          <SectionRail items={items} active={cur.id} onSelect={setActive} layout={layout} testId="campaign-settings-rail" />
        )}
      >
      <section style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
        <SectionHeader index={curIdx + 1} title={t(cur.titleKey)} help={t(cur.descKey)} />

        <div className={cn("neu-raised", compact && "la-config-compact")} style={{ padding: compact ? 18 : 'var(--pad, 36px)', borderRadius: 'var(--r-card)' }}>
          {cur.id === "business" && <BusinessSectionFields {...props} launchName={launchName} setLaunchName={setLaunchName} />}
          {cur.id === "ai" && (
            <>
              {/* Universal demo: the persona (company, service, USP, KB, style) is
                  generated per lead, so only the opener surface is shown here. */}
              {isUniversal && (
                <div style={{ marginBottom: 'var(--gap-form, 24px)' }}>
                  <BusinessSectionFields
                    {...props}
                    launchName={launchName} setLaunchName={setLaunchName}
                    demoMode={demoMode} setDemoMode={setDemoMode}
                    openerOnly
                  />
                </div>
              )}
              <AISectionFields {...props} conversationPrompts={props.conversationPrompts ?? []} />
            </>
          )}
          {cur.id === "behavior" && <BehaviorSectionFields {...props} onNicheChange={props.onNicheChange} />}

          {/* Generate / Launch / Next */}
          <div style={{ display: 'flex', flexWrap: compact ? 'wrap' : 'nowrap', gap: compact ? 10 : undefined, justifyContent: compact ? 'center' : 'space-between', marginTop: 36, paddingTop: 24, borderTop: '1px solid var(--line)' }}>
            <CampaignGenerateButton campaign={props.campaign} onGenerated={props.onGenerated} onFieldsGenerated={props.onFieldsGenerated} />

            {/* Test on my phone: opens WhatsApp on the Lead Awaker AI line with
                "/start <campaignId> <name>" prefilled. The name comes from the
                "Demo lead name" field in the Business section above. */}
            <a
              href={`https://wa.me/${LAUNCH_WA_NUMBER}?text=${encodeURIComponent(launchText)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="la-btn la-btn--wine la-btn--lg la-btn--pill"
              style={{ fontSize: 12, letterSpacing: '0.16em', padding: '15px 34px', gap: 11 }}
            >
              <MessageCircle style={{ width: 18, height: 18 }} strokeWidth={2.25} />
              {t("config.launchCampaign")}
            </a>

            <button
              onClick={() => curIdx < sections.length - 1 && setActive(sections[curIdx + 1].id)}
              disabled={curIdx === sections.length - 1}
              className={cn("la-btn", curIdx < sections.length - 1 ? "la-btn--plain" : "la-btn--soft")}
              style={{ fontFamily: 'Geist Mono, ui-monospace, monospace', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase' as const, gap: 8, opacity: curIdx === sections.length - 1 ? 0.5 : undefined }}
            >
              {curIdx < sections.length - 1 ? t(sections[curIdx + 1].labelKey) : t("config.allDone")} →
            </button>
          </div>
        </div>
      </section>
      </SectionLayout>
    </div>
  );
}
