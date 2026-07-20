import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Building2, Bot, SlidersHorizontal, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { BusinessSectionFields } from "./BusinessSectionFields";
import { AISectionFields } from "./AISectionFields";
import { BehaviorSectionFields } from "./BehaviorSectionFields";
import { CampaignGenerateButton } from "./CampaignGenerateButton";

// Opens WhatsApp on a chat with the Lead Awaker AI line, "/start" prefilled.
// wa.me can only prefill the text box — the operator taps send and the AI replies.
const LAUNCH_WA_NUMBER = "31627458300";
const LAUNCH_WA_MESSAGE = "/start";

// Mirrors the engine's UNIVERSAL_DEMO_CAMPAIGN_ID (demo_recap.py). The universal
// demo generates its business persona per lead (gpt-4o-mini via the website
// widget), so the Business tab is hidden for it: only the opener template and
// agent name remain operator-editable, and they live in the AI tab instead.
const UNIVERSAL_DEMO_CAMPAIGN_ID = 60;

interface SectionDef {
  id: string;
  num: string;
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
  contracts?: any[];
  conversationPrompts?: any[];
  onNicheChange?: (niche: string) => void;
  /** Mobile / narrow: stack the section nav into horizontal tabs, shrink chrome. */
  compact?: boolean;
  onGenerated?: () => void;
}

export function CampaignSettingsLayout(props: CampaignSettingsLayoutProps) {
  const { t } = useTranslation("campaigns");
  const { compact = false } = props;
  const isUniversal =
    ((props.campaign?.id ?? props.campaign?.Id) as number | undefined) === UNIVERSAL_DEMO_CAMPAIGN_ID;
  const [active, setActive] = useState(isUniversal ? "ai" : "business");
  // Optional name typed live during a discovery-call screenshare. Rides along in
  // the Launch button's "/start <campaignId> <name>" message so the engine
  // switches the VIP lead to this campaign and sets first_name before replaying
  // the opener. Name empty → "/start <campaignId>"; both empty → plain "/start".
  const [launchName, setLaunchName] = useState("");
  const launchCampaignId = (props.campaign?.id || props.campaign?.Id) as number | undefined;
  const launchText = [LAUNCH_WA_MESSAGE, launchCampaignId, launchName.trim()]
    .filter((p) => p !== undefined && p !== "" && p !== null)
    .join(" ");

  const allSections: SectionDef[] = [
    { id: "business", num: "01", labelKey: "config.sections.business", titleKey: "config.sections.businessTitle", descKey: "config.sections.businessDesc", icon: Building2 },
    { id: "ai",       num: "02", labelKey: "config.sections.ai",       titleKey: "config.sections.aiTitle",       descKey: "config.sections.aiDesc",       icon: Bot },
    { id: "behavior", num: "03", labelKey: "config.sections.behavior", titleKey: "config.sections.behaviorTitle", descKey: "config.sections.behaviorDesc", icon: SlidersHorizontal },
  ];
  const sections = (isUniversal ? allSections.filter((s) => s.id !== "business") : allSections)
    .map((s, i) => ({ ...s, num: String(i + 1).padStart(2, "0") }));
  const sectionTotal = String(sections.length).padStart(2, "0");

  // `active` can point at the hidden Business tab when switching onto the
  // universal campaign with a stale selection — fall back to the first tab.
  const cur = sections.find((s) => s.id === active) ?? sections[0];
  const curIdx = sections.indexOf(cur);

  return (
    <div className="max-w-[1386px] mr-auto" style={compact
      ? { display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }
      : { display: 'flex', gap: 'var(--gap, 22px)', alignItems: 'flex-start', width: '100%' }}>

      {/* ── Section nav ── */}
      {compact ? (
        // Mobile: horizontal segmented tabs mirroring the page's la-seg switcher.
        <div className="la-seg la-seg--fill" style={{ flexShrink: 0 }}>
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setActive(s.id)}
              className={`la-seg-btn${s.id === cur.id ? ' on' : ''}`}
              style={{ padding: '9px 0', fontSize: 11, letterSpacing: '0.08em' }}
            >
              {t(s.labelKey)}
            </button>
          ))}
        </div>
      ) : (
        <div style={{ width: 190, flexShrink: 0, position: 'sticky', top: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {sections.map((s) => {
              const on = s.id === cur.id;
              return (
                <button key={s.id} onClick={() => setActive(s.id)} style={{
                  padding: '16px 24px', border: 'none', cursor: 'pointer', textAlign: 'left' as const, width: '100%',
                  borderRadius: 'var(--r-surface)', transition: 'all 150ms',
                  background: on ? 'var(--paper)' : 'transparent',
                  boxShadow: on ? 'var(--sh-raised-crisp)' : 'none',
                  borderLeft: `3px solid ${on ? 'var(--wine)' : 'transparent'}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                    <span style={{ fontFamily: 'Geist Mono, ui-monospace, monospace', fontSize: 11, letterSpacing: '0.1em', color: on ? 'var(--wine)' : 'var(--mute-2)' }}>{s.num}</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: on ? 'var(--ink)' : 'var(--ink-soft)' }}>{t(s.labelKey)}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--mute)', paddingLeft: 30, lineHeight: 1.4 }}>{t(s.descKey)}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Content card ── */}
      <div style={{ flex: 1, minWidth: 0, width: compact ? '100%' : undefined }}>
        <div className={cn("neu-raised", compact && "la-config-compact")} style={{ padding: compact ? 18 : 'var(--pad, 36px)', borderRadius: 'var(--r-card)' }}>

          {/* Editorial section heading */}
          <div style={{ position: 'relative', overflow: 'hidden', marginBottom: 'calc(var(--gap-form, 24px) + 10px)', paddingBottom: 'var(--gap-form, 24px)', borderBottom: '1px solid var(--line)' }}>
            {/* Abstract section symbol — large, faint watermark to lighten the text density */}
            <cur.icon
              aria-hidden
              style={{
                position: 'absolute', top: -13, right: -5,
                width: compact ? 96 : 150, height: compact ? 96 : 150, strokeWidth: 1,
                color: 'var(--wine)', opacity: 0.07, pointerEvents: 'none',
                transform: 'rotate(-8deg)',
              }}
            />
            <div className="eyebrow wine" style={{ marginBottom: 10 }}>{cur.num} / {sectionTotal}</div>
            <div className="serif italic" style={{ fontSize: compact ? 30 : 52, color: 'var(--ink)', lineHeight: 1, letterSpacing: '-0.02em', marginBottom: 10 }}>
              {t(cur.titleKey)}
            </div>
            <div style={{ fontSize: 14, color: 'var(--mute)' }}>{t(cur.descKey)}</div>
          </div>

          {cur.id === "business" && <BusinessSectionFields {...props} launchName={launchName} setLaunchName={setLaunchName} />}
          {cur.id === "ai" && (
            <>
              {/* Universal demo: the persona (company, service, USP, KB, style) is
                  generated per lead, so only the opener surface is shown here. */}
              {isUniversal && (
                <div style={{ marginBottom: 'var(--gap-form, 24px)' }}>
                  <BusinessSectionFields {...props} launchName={launchName} setLaunchName={setLaunchName} openerOnly />
                </div>
              )}
              <AISectionFields {...props} conversationPrompts={props.conversationPrompts ?? []} />
            </>
          )}
          {cur.id === "behavior" && <BehaviorSectionFields {...props} onNicheChange={props.onNicheChange} />}

          {/* Prev / Next nav */}
          <div style={{ display: 'flex', flexWrap: compact ? 'wrap' : 'nowrap', gap: compact ? 10 : undefined, justifyContent: compact ? 'center' : 'space-between', marginTop: 36, paddingTop: 24, borderTop: '1px solid var(--line)' }}>
            <CampaignGenerateButton campaign={props.campaign} onGenerated={props.onGenerated} />

            {/* Launch Campaign — opens WhatsApp on the Lead Awaker AI line with
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
              {curIdx < sections.length - 1 ? t(sections[curIdx + 1].labelKey) : "All done"} →
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
