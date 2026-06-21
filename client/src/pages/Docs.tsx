/**
 * DocsPage: in-app documentation for LeadAwaker.
 * Agency Documentation (Admin/Operator) and User Documentation (Manager/Viewer).
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CrmShell } from "@/components/crm/CrmShell";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import {
  BookOpen,
  Users,
  Megaphone,
  Zap,
  BarChart2,
  Settings,
  MessageSquare,
  CalendarCheck,
  AlertCircle,
  ChevronRight,
  Wrench,
  Globe,
  Star,
  Copy,
  Check,
  Sparkles,
  ExternalLink,
  FileText,
  Receipt,
  User,
} from "lucide-react";
import { PIPELINE_HEX } from "@/lib/avatarUtils";
import { Pill } from "@/components/crm/primitives";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

// ── Role detection ────────────────────────────────────────────────────────────

function isOperatorRole(): boolean {
  const role = localStorage.getItem("leadawaker_user_role") || "Viewer";
  return role === "Admin";
}

// ── Status colors ─────────────────────────────────────────────────────────────
// Pipeline-stage colors come from the shared PIPELINE_HEX map so the docs match
// the live app. The locale uses lowercase keys; bridge them to PIPELINE_HEX's
// TitleCase keys here, then read everything through STAGE_HEX.
const STAGE_KEYS = [
  "new", "contacted", "responded", "multipleResponses",
  "qualified", "booked", "closed", "lost", "dnd",
] as const;

const STAGE_KEY_TO_HEX: Record<string, string> = {
  new:               PIPELINE_HEX.New,
  contacted:         PIPELINE_HEX.Contacted,
  responded:         PIPELINE_HEX.Responded,
  multipleResponses: PIPELINE_HEX["Multiple Responses"],
  qualified:         PIPELINE_HEX.Qualified,
  booked:            PIPELINE_HEX.Booked,
  closed:            PIPELINE_HEX.Closed,
  lost:              PIPELINE_HEX.Lost,
  dnd:               PIPELINE_HEX.DND,
};

// Automation-status colors have no shared constant: keep one local map.
const AUTOMATION_HEX: Record<string, string> = {
  paused:    PIPELINE_HEX.Closed,
  queued:    PIPELINE_HEX.Contacted,
  active:    PIPELINE_HEX["Multiple Responses"],
  completed: PIPELINE_HEX.Qualified,
  dnd:       PIPELINE_HEX.Lost,
};

// Calendar-illustration accents, mapped onto the shared palette.
const CAL_HEX = {
  booked:    PIPELINE_HEX.Booked,
  confirmed: PIPELINE_HEX["Multiple Responses"],
  upcoming:  "hsl(var(--brand-indigo))",
};

// Highlighted day cell: soft tint bg + ring, full-strength text.
const calDayStyle = (hex: string): React.CSSProperties => ({
  backgroundColor: `color-mix(in srgb, ${hex} 18%, transparent)`,
  color: hex,
  boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${hex} 30%, transparent)`,
});

// Legend swatch: slightly stronger tint + ring.
const calSwatchStyle = (hex: string): React.CSSProperties => ({
  backgroundColor: `color-mix(in srgb, ${hex} 30%, transparent)`,
  boxShadow: `0 0 0 1px color-mix(in srgb, ${hex} 40%, transparent)`,
});

// ── Changelog data ────────────────────────────────────────────────────────────

const CHANGELOG_KEYS = [
  { version: "v1.5", key: "v15" },
  { version: "v1.4", key: "v14" },
  { version: "v1.3", key: "v13" },
  { version: "v1.2", key: "v12" },
];

// ── Shared sub-components ─────────────────────────────────────────────────────

function DocSection({
  id,
  icon: Icon,
  title,
  children,
}: {
  id?: string;
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div id={id} className="neu-raised overflow-hidden scroll-mt-6" style={{ borderRadius: "var(--r-card)" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-foreground/[0.03] transition-colors text-left"
      >
        <Icon className="h-4 w-4 text-brand-indigo shrink-0" />
        <span className="font-semibold text-sm flex-1">{title}</span>
        <ChevronRight
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform duration-150",
            open && "rotate-90"
          )}
        />
      </button>
      {open && (
        <div
          style={{ borderTop: "1px solid var(--line)" }}
          className="px-5 py-5 space-y-4 text-sm text-foreground/80 leading-relaxed"
        >
          {children}
        </div>
      )}
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-indigo/10 text-brand-indigo text-xs font-bold flex items-center justify-center mt-0.5">
        {n}
      </span>
      {typeof children === "string"
        ? <span dangerouslySetInnerHTML={{ __html: children }} />
        : <span>{children}</span>}
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 p-3 rounded-[var(--r-button)] bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 text-xs text-amber-800 dark:text-amber-200">
      <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-500" />
      {typeof children === "string"
        ? <span dangerouslySetInnerHTML={{ __html: children }} />
        : <span>{children}</span>}
    </div>
  );
}

function SettingsLink({ children }: { children: React.ReactNode }) {
  return (
    <Link href="/settings">
      <span className="inline-flex items-center gap-0.5 text-brand-indigo hover:underline cursor-pointer font-medium">
        {children}
        <ExternalLink className="h-3 w-3 inline" />
      </span>
    </Link>
  );
}

function CopyableBlock({ label, text }: { label: string; text: string }) {
  const { t } = useTranslation("docs");
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="rounded-[var(--r-button)] bg-popover px-4 py-3 flex items-start gap-3 group">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-xs mb-1">{label}</p>
        <code className="text-[11px] text-muted-foreground break-all font-mono">{text}</code>
      </div>
      <button
        onClick={handleCopy}
        className="flex-shrink-0 h-7 w-7 rounded-[var(--r-button)] flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors mt-0.5 opacity-0 group-hover:opacity-100"
        title={t("copy")}
      >
        {copied
          ? <Check className="h-3.5 w-3.5 text-emerald-500" />
          : <Copy className="h-3.5 w-3.5" />
        }
      </button>
    </div>
  );
}

// ── Permissions table ─────────────────────────────────────────────────────────

function RolesTable() {
  const { t } = useTranslation("docs");
  const roleKeys = ["admin", "operator", "manager", "viewer"] as const;
  return (
    <div className="rounded-[var(--r-button)] overflow-hidden border border-black/[0.06] dark:border-white/[0.06]">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-popover">
            <th className="text-left px-3 py-2 font-semibold">{t("roles.role")}</th>
            <th className="text-left px-3 py-2 font-semibold">{t("roles.view")}</th>
            <th className="text-left px-3 py-2 font-semibold">{t("roles.access")}</th>
          </tr>
        </thead>
        <tbody>
          {roleKeys.map((key) => (
            <tr key={key} className="border-t border-black/[0.04] dark:border-white/[0.04]">
              <td className="px-3 py-2 font-medium">{t(`roles.${key}.role`)}</td>
              <td className="px-3 py-2 text-muted-foreground">{t(`roles.${key}.view`)}</td>
              <td className="px-3 py-2 text-muted-foreground">{t(`roles.${key}.access`)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Operator Manual (Agency Documentation) ───────────────────────────────────

function OperatorManual() {
  const { t } = useTranslation("docs");

  return (
    <div className="space-y-6 pb-8">
      {/* 1 - Account Setup */}
      <DocSection
        id="sec-setup"
        icon={Settings}
        title={t("operator.setup.title")}
      >
        <Step n={1}>{t("operator.setup.step1")}</Step>
        <Step n={2}>{t("operator.setup.step2")}</Step>
        <Step n={3}>{t("operator.setup.step3")}</Step>
        <Step n={4}>{t("operator.setup.step4")}</Step>
        <Step n={5}>{t("operator.setup.step5")}</Step>
        <Step n={6}>{t("operator.setup.step6")}</Step>
        <Tip>{t("operator.setup.tip")}</Tip>
      </DocSection>

      {/* 2 - Creating a Campaign */}
      <DocSection
        id="sec-campaign"
        icon={Megaphone}
        title={t("operator.campaign.title")}
      >
        <Step n={1}>{t("operator.campaign.step1")}</Step>
        <div className="rounded-[var(--r-button)] bg-popover px-4 py-3 text-xs space-y-1.5">
          <p className="font-semibold">{t("operator.campaign.smsVsWhatsapp.title")}</p>
          <p className="text-muted-foreground">{t("operator.campaign.smsVsWhatsapp.sms")}</p>
          <p className="text-muted-foreground">{t("operator.campaign.smsVsWhatsapp.whatsapp")}</p>
        </div>
        <Step n={2}>{t("operator.campaign.step2")}</Step>
        <Step n={3}>{t("operator.campaign.step3")}</Step>
        <Step n={4}>{t("operator.campaign.step4")}</Step>
        <Step n={5}>{t("operator.campaign.step5")}</Step>
        <Step n={6}>{t("operator.campaign.step6")}</Step>
        <Tip>{t("operator.campaign.tip")}</Tip>
      </DocSection>

      {/* 3 - Lead Lifecycle */}
      <DocSection
        id="sec-lifecycle"
        icon={Zap}
        title={t("operator.lifecycle.title")}
      >
        <p className="font-semibold">{t("operator.lifecycle.pipelineTitle")}</p>
        <p>{t("operator.lifecycle.pipelineDescription")}</p>
        <div className="space-y-1.5 mt-2">
          {STAGE_KEYS.map((key) => {
            const hex = STAGE_KEY_TO_HEX[key];
            return (
              <div key={key} className="flex gap-3 items-center">
                <Pill color={hex} tone="soft" className="gap-1.5 font-semibold shrink-0">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: hex }} />
                  {t(`operator.lifecycle.stageLabels.${key}`)}
                </Pill>
                <span className="text-xs text-muted-foreground">{t(`operator.lifecycle.stages.${key}`)}</span>
              </div>
            );
          })}
        </div>

        <p className="font-semibold mt-4">{t("operator.lifecycle.automationTitle")}</p>
        <p>{t("operator.lifecycle.automationDescription")}</p>
        <div className="space-y-1.5 mt-2">
          {(["paused", "queued", "active", "completed", "dnd"] as const).map((key) => {
            const hex = AUTOMATION_HEX[key];
            return (
              <div key={key} className="flex gap-3 items-center">
                <Pill color={hex} tone="soft" className="gap-1.5 font-semibold shrink-0">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: hex }} />
                  {key}
                </Pill>
                <span className="text-xs text-muted-foreground">{t(`operator.lifecycle.${key}`)}</span>
              </div>
            );
          })}
        </div>
        <Tip>{t("operator.lifecycle.tip")}</Tip>
      </DocSection>

      {/* 4 - CRM Webhooks */}
      <DocSection
        id="sec-webhooks"
        icon={Globe}
        title={t("operator.webhooks.title")}
      >
        <p>{t("operator.webhooks.description")}</p>
        <div className="space-y-2 mt-1">
          {[
            ["GoHighLevel",       "POST",     "/api/leads/intake/ghl?key=YOUR_KEY&campaign_id=ID"],
            ["Facebook Lead Ads", "GET+POST", "/api/leads/intake/facebook?key=YOUR_KEY&campaign_id=ID"],
            ["HubSpot",           "POST",     "/api/leads/intake/hubspot?key=YOUR_KEY&campaign_id=ID"],
            ["Generic / Custom",  "POST",     "/api/leads/intake"],
          ].map(([crm, method, path]) => (
            <CopyableBlock
              key={crm}
              label={crm}
              text={`${method} https://webhooks.leadawaker.com${path}`}
            />
          ))}
        </div>
        <Tip>{t("operator.webhooks.tip")}</Tip>
      </DocSection>

      {/* 5 - Instagram */}
      <DocSection
        id="sec-instagram"
        icon={Globe}
        title={t("operator.instagram.title")}
      >
        <p>{t("operator.instagram.description")}</p>
        <Step n={1}>{t("operator.instagram.step1")}</Step>
        <Step n={2}>{t("operator.instagram.step2")}</Step>
        <Step n={3}>{t("operator.instagram.step3")}</Step>
        <Tip>{t("operator.instagram.tip")}</Tip>
      </DocSection>

      {/* 6 - Analytics */}
      <DocSection
        id="sec-analytics"
        icon={BarChart2}
        title={t("operator.analytics.title")}
      >
        <Step n={1}>{t("operator.analytics.step1")}</Step>
        <Step n={2}>{t("operator.analytics.step2")}</Step>
        <Step n={3}>{t("operator.analytics.step3")}</Step>
        <Tip>{t("operator.analytics.tip")}</Tip>
      </DocSection>

      {/* 7 - User Management & Roles */}
      <DocSection
        id="sec-users"
        icon={Users}
        title={t("operator.users.title")}
      >
        <p>{t("operator.users.description")}</p>
        <RolesTable />
        <Step n={1}>{t("operator.users.step1")}</Step>
        <Step n={2}>{t("operator.users.step2")}</Step>
        <Step n={3}>{t("operator.users.step3")}</Step>
        <Tip>{t("operator.users.tip")}</Tip>
      </DocSection>

      {/* 8 - Prompt Library */}
      <DocSection
        id="sec-prompts"
        icon={FileText}
        title={t("operator.prompts.title")}
      >
        <p>{t("operator.prompts.description")}</p>
        <Step n={1}>{t("operator.prompts.step1")}</Step>
        <Step n={2}>{t("operator.prompts.step2")}</Step>
        <Step n={3}>{t("operator.prompts.step3")}</Step>
        <Step n={4}>{t("operator.prompts.step4")}</Step>
        <Tip>{t("operator.prompts.tip")}</Tip>
      </DocSection>

      {/* 9 - Billing */}
      <DocSection
        id="sec-billing"
        icon={Receipt}
        title={t("operator.billing.title")}
      >
        <p>{t("operator.billing.description")}</p>
        <Step n={1}>{t("operator.billing.step1")}</Step>
        <Step n={2}>{t("operator.billing.step2")}</Step>
        <Step n={3}>{t("operator.billing.step3")}</Step>
        <Tip>{t("operator.billing.tip")}</Tip>
      </DocSection>

      {/* 10 - Troubleshoot */}
      <DocSection
        id="sec-troubleshoot"
        icon={Wrench}
        title={t("operator.troubleshoot.title")}
      >
        <div className="space-y-2.5">
          {(["1", "2", "3", "4", "5", "6", "7", "8"] as const).map((num) => (
            <div key={num} className="rounded-[var(--r-button)] bg-popover px-4 py-3">
              <p className="font-semibold text-xs mb-1">{t(`operator.troubleshoot.items.${num}.problem`)}</p>
              <p className="text-xs text-muted-foreground">{t(`operator.troubleshoot.items.${num}.solution`)}</p>
            </div>
          ))}
        </div>
      </DocSection>
    </div>
  );
}

// ── Client Guide (User Documentation) ────────────────────────────────────────

function ClientGuide() {
  const { t } = useTranslation("docs");

  return (
    <div className="space-y-6 pb-8">

      {/* Getting Started */}
      <DocSection
        id="sec-getting-started"
        icon={Sparkles}
        title={t("client.gettingStarted.title")}
      >
        <p>{t("client.gettingStarted.description")}</p>
        <Step n={1}>{t("client.gettingStarted.step1")}</Step>
        <Step n={2}>{t("client.gettingStarted.step2")}</Step>
        <Step n={3}>{t("client.gettingStarted.step3")}</Step>
        <Tip>{t("client.gettingStarted.tip")}</Tip>
      </DocSection>

      {/* What is LeadAwaker? */}
      <DocSection
        id="sec-what"
        icon={BookOpen}
        title={t("client.what.title")}
      >
        <p>{t("client.what.p1")}</p>
        <p>{t("client.what.p2")}</p>
      </DocSection>

      {/* Your Leads */}
      <DocSection
        id="sec-leads"
        icon={Users}
        title={t("client.leads.title")}
      >
        <p>{t("client.leads.description")}</p>
        <div className="space-y-1.5 mt-2">
          {STAGE_KEYS.map((key) => {
            const hex = STAGE_KEY_TO_HEX[key];
            return (
              <div key={key} className="flex gap-3 items-center">
                <Pill color={hex} tone="soft" className="gap-1.5 font-semibold shrink-0">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: hex }} />
                  {t(`client.leads.stageLabels.${key}`)}
                </Pill>
                <span className="text-xs text-muted-foreground">{t(`client.leads.stages.${key}`)}</span>
              </div>
            );
          })}
        </div>
      </DocSection>

      {/* Campaign Dashboard */}
      <DocSection
        id="sec-campaign-dashboard"
        icon={Megaphone}
        title={t("client.campaignDashboard.title")}
      >
        <p>{t("client.campaignDashboard.description")}</p>
        <Step n={1}>{t("client.campaignDashboard.step1")}</Step>
        <Step n={2}>{t("client.campaignDashboard.step2")}</Step>
        <Step n={3}>{t("client.campaignDashboard.step3")}</Step>
        <Step n={4}>{t("client.campaignDashboard.step4")}</Step>
        <Step n={5}>{t("client.campaignDashboard.step5")}</Step>
        <Step n={6}>{t("client.campaignDashboard.step6")}</Step>
        <Tip>{t("client.campaignDashboard.tip")}</Tip>
      </DocSection>

      {/* Lead Summaries */}
      <DocSection
        id="sec-conversations"
        icon={MessageSquare}
        title={t("client.conversations.title")}
      >
        <p>{t("client.conversations.intro")}</p>
        <Step n={1}>{t("client.conversations.step1")}</Step>
        <Step n={2}>{t("client.conversations.step2")}</Step>
        <Step n={3}>{t("client.conversations.step3")}</Step>
        <Step n={4}>{t("client.conversations.step4")}</Step>
        <Step n={5}>{t("client.conversations.step5")}</Step>
        <Tip>{t("client.conversations.tip")}</Tip>
      </DocSection>

      {/* Lead Score */}
      <DocSection
        id="sec-score"
        icon={Star}
        title={t("client.score.title")}
      >
        <p>{t("client.score.description")}</p>
        <ul className="list-disc pl-4 space-y-1 mt-1">
          <li>{t("client.score.factor1")}</li>
          <li>{t("client.score.factor2")}</li>
          <li>{t("client.score.factor3")}</li>
        </ul>

        {/* Score ring examples (card view) */}
        <p className="font-semibold mt-2">{t("client.score.scoreRingsTitle")}</p>
        <p>{t("client.score.scoreRingsDescription")}</p>
        <div className="flex items-center gap-4 mt-2 flex-wrap">
          {[
            { score: 15, labelKey: "cold" as const, color: PIPELINE_HEX.Closed },
            { score: 45, labelKey: "warming" as const, color: PIPELINE_HEX.Responded },
            { score: 72, labelKey: "hot" as const, color: PIPELINE_HEX["Multiple Responses"] },
            { score: 93, labelKey: "onFire" as const, color: PIPELINE_HEX.Booked },
          ].map(({ score, labelKey, color }) => {
            const r = 18;
            const circ = 2 * Math.PI * r;
            const offset = circ - (score / 100) * circ;
            return (
              <div key={labelKey} className="flex flex-col items-center gap-1">
                <svg width="48" height="48" viewBox="0 0 48 48">
                  <circle cx="24" cy="24" r={r} fill="none" stroke="currentColor" strokeWidth="3" className="text-border/30" />
                  <circle
                    cx="24" cy="24" r={r} fill="none"
                    stroke={color} strokeWidth="3" strokeLinecap="round"
                    strokeDasharray={circ} strokeDashoffset={offset}
                    transform="rotate(-90 24 24)"
                  />
                  <text x="24" y="24" textAnchor="middle" dominantBaseline="central" fontSize="12" fontWeight="700" fill="currentColor" className="text-foreground">
                    {score}
                  </text>
                </svg>
                <span className="text-[10px] font-medium text-muted-foreground">{t(`client.score.${labelKey}`)}</span>
              </div>
            );
          })}
        </div>

        {/* Score gauges (detail panel view) */}
        <p className="font-semibold mt-4">{t("client.score.scoreBreakdownTitle")}</p>
        <p>{t("client.score.scoreBreakdownDescription")}</p>
        <div className="rounded-[var(--r-button)] border border-border/40 bg-muted/20 px-4 py-4 flex flex-col gap-3 mt-2">
          {[
            { labelKey: "gaugeLeadScore" as const, value: 72, bar: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
            { labelKey: "gaugeEngagement" as const, value: 58, bar: "bg-amber-400", text: "text-amber-600 dark:text-amber-400" },
            { labelKey: "gaugeActivityScore" as const, value: 85, bar: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
          ].map(({ labelKey, value, bar, text }) => (
            <div key={labelKey} className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">{t(`client.score.${labelKey}`)}</span>
                <span className={cn("text-[12px] font-bold tabular-nums", text)}>
                  {value}<span className="text-[10px] font-normal text-muted-foreground ml-0.5">/100</span>
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={cn("h-full rounded-full", bar)}
                  style={{ width: `${value}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {t("client.score.gaugeExplanation")}
        </p>

        <Tip>{t("client.score.tip")}</Tip>
      </DocSection>

      {/* Bookings */}
      <DocSection
        id="sec-bookings"
        icon={CalendarCheck}
        title={t("client.bookings.title")}
      >
        <p>{t("client.bookings.p1")}</p>
        <p>{t("client.bookings.p2")}</p>

        {/* Mini calendar illustration */}
        <div className="rounded-[var(--r-button)] border border-border/40 bg-muted/20 p-4 mt-1">
          <div className="grid grid-cols-7 gap-1 text-center">
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
              <span key={i} className="text-[10px] font-bold text-muted-foreground/50 pb-1">{d}</span>
            ))}
            {/* Row 1 */}
            {[null, null, null, 1, 2, 3, 4].map((d, i) => (
              <span key={`r1-${i}`} className={cn("text-[11px] rounded-md h-7 flex items-center justify-center", d ? "text-muted-foreground" : "")}>{d || ""}</span>
            ))}
            {/* Row 2 */}
            {[5, 6, 7, 8, 9, 10, 11].map((d) => (
              <span key={d} className={cn("text-[11px] rounded-md h-7 flex items-center justify-center", d === 9 ? "font-bold" : "text-muted-foreground")} style={d === 9 ? calDayStyle(CAL_HEX.booked) : undefined}>{d}</span>
            ))}
            {/* Row 3 */}
            {[12, 13, 14, 15, 16, 17, 18].map((d) => (
              <span key={d} className={cn("text-[11px] rounded-md h-7 flex items-center justify-center", d === 14 || d === 17 ? "font-bold" : "text-muted-foreground")} style={d === 14 ? calDayStyle(CAL_HEX.confirmed) : d === 17 ? calDayStyle(CAL_HEX.booked) : undefined}>{d}</span>
            ))}
            {/* Row 4 */}
            {[19, 20, 21, 22, 23, 24, 25].map((d) => (
              <span key={d} className={cn("text-[11px] rounded-md h-7 flex items-center justify-center", d === 22 ? "font-bold" : "text-muted-foreground")} style={d === 22 ? calDayStyle(CAL_HEX.confirmed) : undefined}>{d}</span>
            ))}
            {/* Row 5 */}
            {[26, 27, 28, 29, 30, null, null].map((d, i) => (
              <span key={`r5-${i}`} className={cn("text-[11px] rounded-md h-7 flex items-center justify-center", d === 28 ? "font-bold" : d ? "text-muted-foreground" : "")} style={d === 28 ? calDayStyle(CAL_HEX.upcoming) : undefined}>{d || ""}</span>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-3 pt-2 border-t border-border/20">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={calSwatchStyle(CAL_HEX.booked)} />
              <span className="text-[10px] text-muted-foreground">{t("client.bookings.legendBooked")}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={calSwatchStyle(CAL_HEX.confirmed)} />
              <span className="text-[10px] text-muted-foreground">{t("client.bookings.legendConfirmed")}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={calSwatchStyle(CAL_HEX.upcoming)} />
              <span className="text-[10px] text-muted-foreground">{t("client.bookings.legendUpcoming")}</span>
            </div>
          </div>
        </div>

        <Tip>{t("client.bookings.tip")}</Tip>
      </DocSection>

      {/* Managing Your Account */}
      <DocSection
        id="sec-account-mgmt"
        icon={User}
        title={t("client.accountMgmt.title")}
      >
        <p>{t("client.accountMgmt.description")}</p>
        <Step n={1}>{t("client.accountMgmt.step1")}</Step>
        <Step n={2}>{t("client.accountMgmt.step2")}</Step>
        <Step n={3}>{t("client.accountMgmt.step3")}</Step>
        <Tip>{t("client.accountMgmt.tip")}</Tip>
      </DocSection>

      {/* Reports & Insights */}
      <DocSection
        id="sec-reports"
        icon={BarChart2}
        title={t("client.reports.title")}
      >
        <p>{t("client.reports.description")}</p>

        {/* Key metrics */}
        <div className="space-y-2 mt-2">
          {([
            ["responseRate", "responseRateDesc"],
            ["bookingRate", "bookingRateDesc"],
            ["costPerLead", "costPerLeadDesc"],
            ["avgReplyTime", "avgReplyTimeDesc"],
          ] as const).map(([metricKey, descKey]) => (
            <div key={metricKey} className="rounded-[var(--r-button)] bg-popover px-4 py-3">
              <p className="font-semibold text-xs mb-1">{t(`client.reports.${metricKey}`)}</p>
              <p className="text-xs text-muted-foreground">{t(`client.reports.${descKey}`)}</p>
            </div>
          ))}
        </div>

        {/* Pipeline funnel example */}
        <p className="font-semibold mt-4">{t("client.reports.pipelineFunnelTitle")}</p>
        <p>{t("client.reports.pipelineFunnelDescription")}</p>
        <div className="mt-2 space-y-1">
          {([
            ["new",                120],
            ["contacted",          98],
            ["responded",          54],
            ["multipleResponses",  32],
            ["qualified",          18],
            ["booked",             11],
          ] as const).map(([key, count]) => {
            const hex = STAGE_KEY_TO_HEX[key];
            const pct = (count / 120) * 100;
            return (
              <div key={key} className="flex items-center gap-2">
                <span className="text-[11px] font-medium text-muted-foreground w-[120px] shrink-0 text-right">{t(`client.leads.stageLabels.${key}`)}</span>
                <div className="flex-1 h-5 rounded-full bg-popover overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: hex }}
                  />
                </div>
                <span className="text-[11px] font-semibold tabular-nums w-8 text-right">{count}</span>
              </div>
            );
          })}
        </div>

        {/* Lead score distribution example */}
        <p className="font-semibold mt-4">{t("client.reports.scoreDistributionTitle")}</p>
        <p>{t("client.reports.scoreDistributionDescription")}</p>
        <div className="flex items-center gap-4 mt-2 flex-wrap">
          {([
            { score: 15, statusKey: "new" as const },
            { score: 42, statusKey: "responded" as const },
            { score: 78, statusKey: "qualified" as const },
            { score: 95, statusKey: "booked" as const },
          ]).map(({ score, statusKey }) => {
            const color = STAGE_KEY_TO_HEX[statusKey];
            const r = 18;
            const circ = 2 * Math.PI * r;
            const offset = circ - (score / 100) * circ;
            return (
              <div key={statusKey} className="flex flex-col items-center gap-1">
                <svg width="48" height="48" viewBox="0 0 48 48">
                  <circle cx="24" cy="24" r={r} fill="none" stroke="currentColor" strokeWidth="3" className="text-border/30" />
                  <circle
                    cx="24" cy="24" r={r} fill="none"
                    stroke={color} strokeWidth="3" strokeLinecap="round"
                    strokeDasharray={circ} strokeDashoffset={offset}
                    transform="rotate(-90 24 24)"
                  />
                  <text x="24" y="24" textAnchor="middle" dominantBaseline="central" fontSize="12" fontWeight="700" fill="currentColor" className="text-foreground">
                    {score}
                  </text>
                </svg>
                <span className="text-[10px] font-medium" style={{ color }}>{t(`client.leads.stageLabels.${statusKey}`)}</span>
              </div>
            );
          })}
        </div>

        <Tip>{t("client.reports.tip")}</Tip>
      </DocSection>

      {/* FAQ */}
      <DocSection
        id="sec-faq"
        icon={AlertCircle}
        title={t("client.faq.title")}
      >
        <div className="space-y-2.5">
          {(["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const).map((num) => (
            <div key={num} className="rounded-[var(--r-button)] bg-popover px-4 py-3">
              <p className="font-semibold text-xs mb-1">{t(`client.faq.q${num}`)}</p>
              <p className="text-xs text-muted-foreground">{t(`client.faq.a${num}`)}</p>
            </div>
          ))}
        </div>
      </DocSection>
    </div>
  );
}

// ── What's New Sheet ──────────────────────────────────────────────────────────

function WhatsNewSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation("docs");
  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-[340px] flex flex-col gap-0 p-0">
        <SheetHeader className="px-5 pt-5 pb-4" style={{ borderBottom: "1px solid hsl(var(--foreground) / 0.06)" }}>
          <SheetTitle className="flex items-center gap-2 text-base font-bold">
            <Sparkles className="h-4 w-4 text-brand-indigo" />
            {t("whatsNew")}
          </SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-auto px-5 py-5 space-y-6">
          {CHANGELOG_KEYS.map(({ version, key }) => {
            const items = t(`changelog.${key}.items`, { returnObjects: true }) as string[];
            const date = t(`changelog.${key}.date`);
            return (
              <div key={version}>
                <div className="flex items-baseline gap-2 mb-2.5">
                  <span className="text-[13px] font-bold text-foreground">{version}</span>
                  <span className="text-[11px] text-muted-foreground">{date}</span>
                </div>
                <ul className="space-y-1.5">
                  {Array.isArray(items) && items.map((item, i) => (
                    <li key={i} className="flex gap-2 text-[12px] text-foreground/80 leading-snug">
                      <span className="text-brand-indigo mt-0.5 shrink-0 font-bold">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function DocsPage() {
  const { t } = useTranslation("docs");
  const { t: tc } = useTranslation("crm");
  const isOperator = isOperatorRole();
  const [tab, setTab] = useState<"operator" | "client">(
    isOperator ? "operator" : "client"
  );
  const [whatsNew, setWhatsNew] = useState(false);

  function openFounderChat() {
    window.dispatchEvent(new CustomEvent("open-founder-chat"));
  }

  return (
    <CrmShell>
      <div className="la-page" data-testid="page-docs">
        {/* ── Topbar ─────────────────────────────────────────────────────── */}
        <div className="la-page-header flex items-center gap-3">
          <span className="serif shrink-0" style={{ fontSize: 20, color: "var(--ink)", letterSpacing: "-0.01em" }}>
            {t("title")}
          </span>

          {/* Tab switcher: operator view only */}
          {isOperator && (
            <div className="la-seg shrink-0" role="tablist">
              <button
                role="tab"
                aria-selected={tab === "operator"}
                className={cn("la-seg-btn", tab === "operator" && "on")}
                onClick={() => setTab("operator")}
              >
                {t("agencyDocs")}
              </button>
              <button
                role="tab"
                aria-selected={tab === "client"}
                className={cn("la-seg-btn", tab === "client" && "on")}
                onClick={() => setTab("client")}
              >
                {t("userDocs")}
              </button>
            </div>
          )}

          {/* Right-side actions */}
          <div className="flex items-center gap-2 ml-auto">
            {/* Chat with Gabriel */}
            <button
              onClick={openFounderChat}
              className="group inline-flex items-center h-9 pl-[9px] rounded-full border text-[12px] font-medium overflow-hidden shrink-0 transition-[max-width,color,border-color] duration-200 max-w-9 hover:max-w-[160px] border-black/[0.125] dark:border-white/[0.125] text-foreground/60 hover:text-foreground"
            >
              <MessageSquare className="h-4 w-4 shrink-0" />
              <span className="whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">{tc("messageFounder")}</span>
            </button>

            {/* What's New: operator only */}
            {isOperator && (
              <button
                onClick={() => setWhatsNew(true)}
                className="group inline-flex items-center h-9 pl-[9px] rounded-full border text-[12px] font-medium overflow-hidden shrink-0 transition-[max-width,color,border-color] duration-200 max-w-9 hover:max-w-[120px] border-black/[0.125] dark:border-white/[0.125] text-foreground/60 hover:text-foreground"
              >
                <Sparkles className="h-4 w-4 shrink-0" />
                <span className="whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">{t("whatsNew")}</span>
              </button>
            )}
          </div>
        </div>

        {/* ── Scrollable content ──────────────────────────────────────────── */}
        <div className="flex-1 min-h-0 overflow-y-auto" data-testid="docs-content">
          <div className="px-6 pb-8 pt-4">
            {tab === "operator" ? <OperatorManual /> : <ClientGuide />}
          </div>
        </div>
      </div>

      <WhatsNewSheet open={whatsNew} onClose={() => setWhatsNew(false)} />
    </CrmShell>
  );
}
