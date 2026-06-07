import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { BusinessSectionFields } from "./BusinessSectionFields";
import { AISectionFields } from "./AISectionFields";
import { BehaviorSectionFields } from "./BehaviorSectionFields";

interface SectionDef {
  id: string;
  num: string;
  labelKey: string;
  titleKey: string;
  descKey: string;
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
}

export function CampaignSettingsLayout(props: CampaignSettingsLayoutProps) {
  const { t } = useTranslation("campaigns");
  const [active, setActive] = useState("business");

  const sections: SectionDef[] = [
    { id: "business", num: "01", labelKey: "config.sections.business", titleKey: "config.sections.businessTitle", descKey: "config.sections.businessDesc" },
    { id: "ai",       num: "02", labelKey: "config.sections.ai",       titleKey: "config.sections.aiTitle",       descKey: "config.sections.aiDesc" },
    { id: "behavior", num: "03", labelKey: "config.sections.behavior", titleKey: "config.sections.behaviorTitle", descKey: "config.sections.behaviorDesc" },
  ];

  const cur = sections.find((s) => s.id === active)!;
  const curIdx = sections.indexOf(cur);

  return (
    <div style={{ display: 'flex', gap: 'var(--gap, 22px)', alignItems: 'flex-start' }}>

      {/* ── Left section nav ── */}
      <div style={{ width: 262, flexShrink: 0, position: 'sticky', top: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {sections.map((s) => {
            const on = s.id === active;
            return (
              <button key={s.id} onClick={() => setActive(s.id)} style={{
                padding: '18px 20px', border: 'none', cursor: 'pointer', textAlign: 'left' as const, width: '100%',
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

        {/* Auto-save indicator */}
        <div style={{
          marginTop: 24,
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '13px 16px', borderRadius: 'var(--r-surface)',
          background: 'var(--good-tint)',
          border: '1px solid rgba(47,148,97,0.18)',
        }}>
          <span style={{
            width: 26, height: 26, borderRadius: 'var(--r-button)', flexShrink: 0,
            background: 'var(--card)', boxShadow: 'var(--sh-raised-crisp)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--good)',
          }}><Check size={14} strokeWidth={3} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{t("config.autoSave.saved")}</div>
            <div style={{ fontFamily: 'Geist Mono, ui-monospace, monospace', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: 'var(--mute)', marginTop: 2 }}>{t("config.autoSave.justNow")}</div>
          </div>
        </div>
      </div>

      {/* ── Content card ── */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="neu-raised" style={{ padding: 'var(--pad, 36px)', borderRadius: 'var(--r-card)' }}>

          {/* Editorial section heading */}
          <div style={{ marginBottom: 'calc(var(--gap-form, 24px) + 10px)', paddingBottom: 'var(--gap-form, 24px)', borderBottom: '1px solid var(--line)' }}>
            <div className="eyebrow wine" style={{ marginBottom: 10 }}>{cur.num} / 03</div>
            <div className="serif italic" style={{ fontSize: 52, color: 'var(--ink)', lineHeight: 1, letterSpacing: '-0.02em', marginBottom: 10 }}>
              {t(cur.titleKey)}
            </div>
            <div style={{ fontSize: 14, color: 'var(--mute)' }}>{t(cur.descKey)}</div>
          </div>

          {active === "business" && <BusinessSectionFields {...props} />}
          {active === "ai"       && <AISectionFields {...props} />}
          {active === "behavior" && <BehaviorSectionFields {...props} />}

          {/* Prev / Next nav */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 36, paddingTop: 24, borderTop: '1px solid var(--line)' }}>
            <button
              onClick={() => curIdx > 0 && setActive(sections[curIdx - 1].id)}
              disabled={curIdx === 0}
              className={cn("la-btn", curIdx > 0 ? "la-btn--soft" : "")}
              style={{ fontFamily: 'Geist Mono, ui-monospace, monospace', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase' as const, gap: 8, opacity: curIdx === 0 ? 0.3 : undefined }}
            >
              ← {curIdx > 0 ? t(sections[curIdx - 1].labelKey) : "Start"}
            </button>
            <button
              onClick={() => curIdx < sections.length - 1 && setActive(sections[curIdx + 1].id)}
              disabled={curIdx === sections.length - 1}
              className={cn("la-btn", curIdx < sections.length - 1 ? "la-btn--wine" : "la-btn--soft")}
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
