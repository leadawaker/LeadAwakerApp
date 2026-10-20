/**
 * ReactivationGuide: the lead-reactivation walkthrough (campaigns, lead
 * stages, conversations, calendar). Shown to a client only when the account
 * runs a reactivation campaign. Moved unchanged from pages/Docs.tsx.
 */

import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  Users,
  Megaphone,
  BarChart2,
  MessageSquare,
  CalendarCheck,
  Star,
  Sparkles,
  User,
  AlertCircle,
} from "lucide-react";
import { PIPELINE_HEX } from "@/lib/avatarUtils";
import { Pill } from "@/components/crm/primitives";
import { DocSection, Step, Tip, STAGE_KEYS, STAGE_KEY_TO_HEX } from "./docParts";

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


export function ReactivationGuide() {
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
