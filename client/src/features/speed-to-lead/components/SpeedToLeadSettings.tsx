import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Zap, MessageCircle, Smartphone, Mail, Clock, Sparkles, GripVertical } from "lucide-react";
import { PanelShell, SectionHead } from "@/features/campaigns/components/metricsWidgets/panelPrimitives";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { SpeedToLeadCampaign } from "../data/mockMetrics";

const TONES = ["warm", "professional", "concise"] as const;
type Tone = (typeof TONES)[number];

const PROMPT_VARS = ["lead_name", "business_name", "source", "agent_name"] as const;

/**
 * Speed-to-Lead settings (mockup): the per-campaign config that decides how a
 * fresh lead is greeted instantly. Centerpiece is the first-touch message the AI
 * fires the moment a lead lands. No data wiring yet — local state only.
 */
export function SpeedToLeadSettings({ campaign }: { campaign: SpeedToLeadCampaign }) {
  const { t } = useTranslation("speedToLead");

  const [targetSec, setTargetSec] = useState(campaign.responseTargetSec);
  const [fallbackSec, setFallbackSec] = useState(120);
  const [smsEnabled, setSmsEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [tone, setTone] = useState<Tone>("warm");
  const [aiDisclosure, setAiDisclosure] = useState(true);
  const [alwaysOn, setAlwaysOn] = useState(true);
  const [message, setMessage] = useState(t("settings.message.default"));

  return (
    <div className="flex flex-col gap-6 max-w-[860px] pt-6">
      {/* ── Instant first message (the prompt) — centerpiece ─────────────── */}
      <PanelShell testId="settings-message">
        <SectionHead
          eyebrow={
            <span className="flex items-center gap-1.5">
              <Sparkles size={12} />
              {t("settings.message.eyebrow")}
            </span>
          }
          title={t("settings.message.title")}
          titleSize={22}
          marginBottom={8}
        />
        <p style={{ fontSize: 13.5, color: "var(--mute)", lineHeight: 1.55, marginBottom: 16 }}>
          {t("settings.message.body")}
        </p>

        <textarea
          className="la-input"
          style={{ minHeight: 150, resize: "vertical", lineHeight: 1.55 }}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          data-testid="settings-message-input"
        />

        {/* Variable chips */}
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <span style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--mute-2)" }}>
            {t("settings.message.variables")}
          </span>
          {PROMPT_VARS.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setMessage((m) => `${m} {{${v}}}`)}
              className="la-btn la-btn--inset"
              style={{ fontFamily: "var(--mono)", fontSize: 11, padding: "4px 10px" }}
              data-testid={`settings-var-${v}`}
            >
              {`{{${v}}}`}
            </button>
          ))}
        </div>

        {/* Tone + AI disclosure */}
        <div className="flex flex-wrap items-center justify-between gap-4 mt-5 pt-5" style={{ borderTop: "1px solid var(--line)" }}>
          <div className="flex items-center gap-3">
            <span style={{ fontSize: 13, color: "var(--ink-soft)", fontWeight: 600 }}>{t("settings.message.tone")}</span>
            <div className="la-seg" role="tablist">
              {TONES.map((tn) => (
                <button
                  key={tn}
                  role="tab"
                  aria-selected={tone === tn}
                  className={cn("la-seg-btn", tone === tn && "on")}
                  onClick={() => setTone(tn)}
                  data-testid={`settings-tone-${tn}`}
                >
                  {t(`settings.message.tones.${tn}`)}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <Switch checked={aiDisclosure} onCheckedChange={setAiDisclosure} data-testid="settings-ai-disclosure" />
            <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>{t("settings.message.aiDisclosure")}</span>
          </label>
        </div>
      </PanelShell>

      {/* ── Two-up: response target + channel order ──────────────────────── */}
      <div className="grid gap-6" style={{ gridTemplateColumns: "1fr 1fr" }}>
        {/* Response target / SLA */}
        <PanelShell testId="settings-sla">
          <SectionHead
            eyebrow={<span className="flex items-center gap-1.5"><Zap size={12} />{t("settings.sla.eyebrow")}</span>}
            title={t("settings.sla.title")}
            titleSize={18}
            marginBottom={14}
          />
          <NumberField
            label={t("settings.sla.targetLabel")}
            suffix={t("settings.sla.seconds")}
            value={targetSec}
            onChange={setTargetSec}
            testId="settings-target"
          />
          <div className="mt-4">
            <NumberField
              label={t("settings.sla.fallbackLabel")}
              suffix={t("settings.sla.seconds")}
              value={fallbackSec}
              onChange={setFallbackSec}
              testId="settings-fallback-delay"
            />
          </div>
          <p style={{ fontSize: 12.5, color: "var(--mute)", lineHeight: 1.5, marginTop: 14 }}>
            {t("settings.sla.help")}
          </p>
        </PanelShell>

        {/* Channel order */}
        <PanelShell testId="settings-channels">
          <SectionHead
            eyebrow={<span className="flex items-center gap-1.5"><MessageCircle size={12} />{t("settings.channels.eyebrow")}</span>}
            title={t("settings.channels.title")}
            titleSize={18}
            marginBottom={14}
          />
          <div className="flex flex-col gap-2.5">
            <ChannelRow icon={MessageCircle} color="var(--good)" label={t("channels.whatsapp")} badge={t("settings.channels.primary")} />
            <ChannelRow
              icon={Smartphone}
              color="var(--warn)"
              label={t("channels.smsFallback")}
              toggle={<Switch checked={smsEnabled} onCheckedChange={setSmsEnabled} data-testid="settings-sms-toggle" />}
            />
            <ChannelRow
              icon={Mail}
              color="var(--wine)"
              label={t("channels.emailFallback")}
              toggle={<Switch checked={emailEnabled} onCheckedChange={setEmailEnabled} data-testid="settings-email-toggle" />}
            />
          </div>
          <p style={{ fontSize: 12.5, color: "var(--mute)", lineHeight: 1.5, marginTop: 14 }}>
            {t("settings.channels.help")}
          </p>
        </PanelShell>
      </div>

      {/* ── Coverage ─────────────────────────────────────────────────────── */}
      <PanelShell testId="settings-coverage">
        <SectionHead
          eyebrow={<span className="flex items-center gap-1.5"><Clock size={12} />{t("settings.coverage.eyebrow")}</span>}
          title={t("settings.coverage.title")}
          titleSize={18}
          marginBottom={14}
        />
        <label className="flex items-center justify-between gap-4 cursor-pointer">
          <div className="min-w-0">
            <div style={{ fontSize: 14, color: "var(--ink-soft)", fontWeight: 600 }}>
              {t(alwaysOn ? "settings.coverage.alwaysOn" : "settings.coverage.businessHours")}
            </div>
            <div style={{ fontSize: 12.5, color: "var(--mute)", marginTop: 3, lineHeight: 1.5 }}>
              {t(alwaysOn ? "settings.coverage.alwaysOnHelp" : "settings.coverage.businessHoursHelp")}
            </div>
          </div>
          <Switch checked={alwaysOn} onCheckedChange={setAlwaysOn} data-testid="settings-always-on" />
        </label>
      </PanelShell>
    </div>
  );
}

function NumberField({
  label,
  suffix,
  value,
  onChange,
  testId,
}: {
  label: string;
  suffix: string;
  value: number;
  onChange: (n: number) => void;
  testId: string;
}) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span style={{ fontSize: 13.5, color: "var(--ink-soft)" }}>{label}</span>
      <span className="flex items-center gap-2 shrink-0">
        <input
          type="number"
          className="la-input"
          style={{ width: 84, textAlign: "right", padding: "8px 12px", fontFamily: "var(--mono)" }}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          data-testid={testId}
        />
        <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--mute)" }}>{suffix}</span>
      </span>
    </label>
  );
}

function ChannelRow({
  icon: Icon,
  color,
  label,
  badge,
  toggle,
}: {
  icon: typeof MessageCircle;
  color: string;
  label: string;
  badge?: string;
  toggle?: React.ReactNode;
}) {
  return (
    <div
      className="flex items-center gap-3"
      style={{ background: "var(--bg)", boxShadow: "var(--sh-inset-crisp)", borderRadius: "var(--r-button)", padding: "11px 14px" }}
    >
      <GripVertical size={14} style={{ color: "var(--mute-2)" }} />
      <span style={{ color, display: "flex" }}><Icon size={16} /></span>
      <span className="flex-1 truncate" style={{ fontSize: 13.5, color: "var(--ink-soft)", fontWeight: 500 }}>{label}</span>
      {badge && (
        <span style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--good)", background: "var(--good-tint)", padding: "3px 8px", borderRadius: "var(--r-pill)" }}>
          {badge}
        </span>
      )}
      {toggle}
    </div>
  );
}
