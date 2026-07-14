import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Building2, Bot, SlidersHorizontal, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { BusinessSectionFields } from "./BusinessSectionFields";
import { AISectionFields } from "./AISectionFields";
import { BehaviorSectionFields } from "./BehaviorSectionFields";

// Opens WhatsApp on a chat with the Lead Awaker AI line, "/start" prefilled.
// wa.me can only prefill the text box — the operator taps send and the AI replies.
const LAUNCH_WA_NUMBER = "31627458300";
const LAUNCH_WA_MESSAGE = "/start";

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
}

export function CampaignSettingsLayout(props: CampaignSettingsLayoutProps) {
  const { t } = useTranslation("campaigns");
  const { compact = false } = props;
  const [active, setActive] = useState("business");
  // Optional name typed live during a discovery-call screenshare. Rides along in
  // the Launch button's "/start <campaignId> <name>" message so the engine
  // switches the VIP lead to this campaign and sets first_name before replaying
  // the opener. Name empty → "/start <campaignId>"; both empty → plain "/start".
  const [launchName, setLaunchName] = useState("");
  const launchCampaignId = (props.campaign?.id || props.campaign?.Id) as number | undefined;
  const launchText = [LAUNCH_WA_MESSAGE, launchCampaignId, launchName.trim()]
    .filter((p) => p !== undefined && p !== "" && p !== null)
    .join(" ");

  const sections: SectionDef[] = [
    { id: "business", num: "01", labelKey: "config.sections.business", titleKey: "config.sections.businessTitle", descKey: "config.sections.businessDesc", icon: Building2 },
    { id: "ai",       num: "02", labelKey: "config.sections.ai",       titleKey: "config.sections.aiTitle",       descKey: "config.sections.aiDesc",       icon: Bot },
    { id: "behavior", num: "03", labelKey: "config.sections.behavior", titleKey: "config.sections.behaviorTitle", descKey: "config.sections.behaviorDesc", icon: SlidersHorizontal },
  ];

  const cur = sections.find((s) => s.id === active)!;
  const curIdx = sections.indexOf(cur);

  return (
    <div className="max-w-[1386px] mr-auto" style={compact
      ? { display: 'flex', flexDirection: 'column', gap: 16 }
      : { display: 'flex', gap: 'var(--gap, 22px)', alignItems: 'flex-start' }}>

      {/* ── Section nav ── */}
      {compact ? (
        // Mobile: horizontal segmented tabs mirroring the page's la-seg switcher.
        <div className="la-seg la-seg--fill" style={{ flexShrink: 0 }}>
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setActive(s.id)}
              className={`la-seg-btn${s.id === active ? ' on' : ''}`}
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
              const on = s.id === active;
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
            <div className="eyebrow wine" style={{ marginBottom: 10 }}>{cur.num} / 03</div>
            <div className="serif italic" style={{ fontSize: compact ? 30 : 52, color: 'var(--ink)', lineHeight: 1, letterSpacing: '-0.02em', marginBottom: 10 }}>
              {t(cur.titleKey)}
            </div>
            <div style={{ fontSize: 14, color: 'var(--mute)' }}>{t(cur.descKey)}</div>
          </div>

          {active === "business" && <BusinessSectionFields {...props} launchName={launchName} setLaunchName={setLaunchName} />}
          {active === "ai"       && <AISectionFields {...props} conversationPrompts={props.conversationPrompts ?? []} />}
          {active === "behavior" && <BehaviorSectionFields {...props} onNicheChange={props.onNicheChange} />}

          {/* Prev / Next nav */}
          <div style={{ display: 'flex', flexWrap: compact ? 'wrap' : 'nowrap', gap: compact ? 10 : undefined, justifyContent: compact ? 'center' : 'space-between', marginTop: 36, paddingTop: 24, borderTop: '1px solid var(--line)' }}>
            <button
              onClick={() => curIdx > 0 && setActive(sections[curIdx - 1].id)}
              disabled={curIdx === 0}
              className={cn("la-btn", curIdx > 0 ? "la-btn--soft" : "")}
              style={{ fontFamily: 'Geist Mono, ui-monospace, monospace', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase' as const, gap: 8, opacity: curIdx === 0 ? 0.3 : undefined }}
            >
              ← {curIdx > 0 ? t(sections[curIdx - 1].labelKey) : "Start"}
            </button>

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
