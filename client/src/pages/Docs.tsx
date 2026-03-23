/**
 * DocsPage — In-app documentation for LeadAwaker.
 * Agency Documentation (Admin/Operator) and User Documentation (Manager/Viewer).
 * Split-pane layout: left sidebar navigation + right scrollable content.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { CrmShell } from "@/components/crm/CrmShell";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/useIsMobile";
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
  Search,
  Copy,
  Check,
  Sparkles,
  X,
  ExternalLink,
  FileText,
  Receipt,
  User,
  Paintbrush,
} from "lucide-react";
import { GradientTester, GradientControlPoints, DEFAULT_LAYERS, layerToStyle, type GradientLayer } from "@/components/ui/gradient-tester";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

// ── Role detection ────────────────────────────────────────────────────────────

function isOperatorRole(): boolean {
  const role = localStorage.getItem("leadawaker_user_role") || "Viewer";
  return role === "Admin" || role === "Operator";
}

// ── Search helper ─────────────────────────────────────────────────────────────

function matchesSearch(keywords: string, q: string): boolean {
  if (!q.trim()) return true;
  return keywords.toLowerCase().includes(q.toLowerCase().trim());
}

// ── Changelog data ────────────────────────────────────────────────────────────

const CHANGELOG_KEYS = [
  { version: "v1.5", key: "v15" },
  { version: "v1.4", key: "v14" },
  { version: "v1.3", key: "v13" },
  { version: "v1.2", key: "v12" },
];

// ── TOC anchor data ───────────────────────────────────────────────────────────

type TocItem = { id: string; labelKey: string; icon: React.ElementType };

const OPERATOR_TOC: TocItem[] = [
  { id: "sec-setup",        labelKey: "toc.setup",           icon: Settings },
  { id: "sec-campaign",     labelKey: "toc.campaign",        icon: Megaphone },
  { id: "sec-lifecycle",    labelKey: "toc.lifecycle",       icon: Zap },
  { id: "sec-webhooks",     labelKey: "toc.webhooks",        icon: Globe },
  { id: "sec-instagram",    labelKey: "toc.instagram",       icon: Globe },
  { id: "sec-analytics",    labelKey: "toc.analytics",       icon: BarChart2 },
  { id: "sec-users",        labelKey: "toc.userManagement",  icon: Users },
  { id: "sec-prompts",      labelKey: "toc.promptLibrary",   icon: FileText },
  { id: "sec-billing",      labelKey: "toc.billing",         icon: Receipt },
  { id: "sec-troubleshoot", labelKey: "toc.troubleshoot",    icon: Wrench },
];

const CLIENT_TOC: TocItem[] = [
  { id: "sec-getting-started", labelKey: "toc.gettingStarted",  icon: Sparkles },
  { id: "sec-what",            labelKey: "toc.whatIsIt",         icon: BookOpen },
  { id: "sec-leads",           labelKey: "toc.yourLeads",        icon: Users },
  { id: "sec-conversations",   labelKey: "toc.conversations",    icon: MessageSquare },
  { id: "sec-score",           labelKey: "toc.leadScore",        icon: Star },
  { id: "sec-bookings",        labelKey: "toc.bookings",         icon: CalendarCheck },
  { id: "sec-account-mgmt",   labelKey: "toc.yourAccount",      icon: User },
  { id: "sec-reports",         labelKey: "toc.reportsInsights",  icon: BarChart2 },
  { id: "sec-faq",             labelKey: "toc.faq",              icon: AlertCircle },
];

// ── Shared sub-components ─────────────────────────────────────────────────────

function DocSection({
  id,
  icon: Icon,
  title,
  children,
  hidden,
}: {
  id?: string;
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
  hidden?: boolean;
}) {
  const [open, setOpen] = useState(true);
  if (hidden) return null;
  return (
    <div id={id} className="rounded-xl bg-white/60 dark:bg-white/[0.06] overflow-hidden scroll-mt-6">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-card transition-colors text-left"
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
          style={{ borderTop: "1px solid hsl(var(--foreground) / 0.06)" }}
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
      <span>{children}</span>
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 text-xs text-amber-800 dark:text-amber-200">
      <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-500" />
      <span>{children}</span>
    </div>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span className={cn("inline-block px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0", color)}>
      {label}
    </span>
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
    <div className="rounded-lg bg-popover px-4 py-3 flex items-start gap-3 group">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-xs mb-1">{label}</p>
        <code className="text-[11px] text-muted-foreground break-all font-mono">{text}</code>
      </div>
      <button
        onClick={handleCopy}
        className="flex-shrink-0 h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors mt-0.5 opacity-0 group-hover:opacity-100"
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
    <div className="rounded-lg overflow-hidden border border-black/[0.06] dark:border-white/[0.06]">
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

function OperatorManual({ search }: { search: string }) {
  const { t } = useTranslation("docs");
  const q = search;

  const sectionMatches = [
    matchesSearch("account setup twilio api key business hours timezone daily send limit webhook secret number type toll-free local short code a2p 10dlc registration", q),
    matchesSearch("campaign first message follow-up bumps active hours prompt library template channel sms whatsapp pros cons template approval", q),
    matchesSearch("lead lifecycle status paused queued active completed dnd automation stop", q),
    matchesSearch("source adapters crm webhooks gohighlevel facebook hubspot generic intake url", q),
    matchesSearch("instagram dm contacts sync meta graph api business account access token profile", q),
    matchesSearch("analytics reporting lead scores campaign metrics automation logs response rate booking cost", q),
    matchesSearch("user management roles admin operator manager viewer invite team permissions access control", q),
    matchesSearch("prompt library ai persona template variables tone script system message personality", q),
    matchesSearch("billing invoicing contracts expenses revenue btw vat payments", q),
    matchesSearch("troubleshoot messages delivery language ai replies duplicate leads twilio sending status spam flagged template not approved score not updating", q),
  ];
  const noResults = q.trim() !== "" && sectionMatches.every((m) => !m);

  return (
    <div className="space-y-6 pb-8">
      {noResults && (
        <p className="text-sm text-muted-foreground text-center py-8">
          {t("noResults", { query: q })}
        </p>
      )}

      {/* 1 - Account Setup */}
      <DocSection
        id="sec-setup"
        icon={Settings}
        title={t("operator.setup.title")}
        hidden={!sectionMatches[0]}
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
        hidden={!sectionMatches[1]}
      >
        <Step n={1}>{t("operator.campaign.step1")}</Step>
        <div className="rounded-lg bg-popover px-4 py-3 text-xs space-y-1.5">
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
        hidden={!sectionMatches[2]}
      >
        <p className="font-semibold">{t("operator.lifecycle.pipelineTitle")}</p>
        <p>{t("operator.lifecycle.pipelineDescription")}</p>
        <div className="space-y-1.5 mt-2">
          {([
            ["new",                "#7C3AED"],
            ["contacted",          "#818CF8"],
            ["responded",          "#3ACBDF"],
            ["multipleResponses",  "#31D35C"],
            ["qualified",          "#AED62E"],
            ["booked",             "#F7BF0E"],
            ["closed",             "#6B7280"],
            ["lost",               "#DC2626"],
            ["dnd",                "#722F37"],
          ] as const).map(([key, hex]) => (
            <div key={key} className="flex gap-3 items-center">
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold shrink-0"
                style={{ backgroundColor: `${hex}20`, color: hex }}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: hex }} />
                {t(`operator.lifecycle.stageLabels.${key}`)}
              </span>
              <span className="text-xs text-muted-foreground">{t(`operator.lifecycle.stages.${key}`)}</span>
            </div>
          ))}
        </div>

        <p className="font-semibold mt-4">{t("operator.lifecycle.automationTitle")}</p>
        <p>{t("operator.lifecycle.automationDescription")}</p>
        <div className="space-y-1.5 mt-2">
          {([
            ["paused",    "#6B7280"],
            ["queued",    "#7A73FF"],
            ["active",    "#31D35C"],
            ["completed", "#8B5CF6"],
            ["dnd",       "#DC2626"],
          ] as const).map(([key, hex]) => (
            <div key={key} className="flex gap-3 items-center">
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold shrink-0"
                style={{ backgroundColor: `${hex}20`, color: hex }}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: hex }} />
                {key}
              </span>
              <span className="text-xs text-muted-foreground">{t(`operator.lifecycle.${key}`)}</span>
            </div>
          ))}
        </div>
        <Tip>{t("operator.lifecycle.tip")}</Tip>
      </DocSection>

      {/* 4 - CRM Webhooks */}
      <DocSection
        id="sec-webhooks"
        icon={Globe}
        title={t("operator.webhooks.title")}
        hidden={!sectionMatches[3]}
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
        hidden={!sectionMatches[4]}
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
        hidden={!sectionMatches[5]}
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
        hidden={!sectionMatches[6]}
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
        hidden={!sectionMatches[7]}
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
        hidden={!sectionMatches[8]}
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
        hidden={!sectionMatches[9]}
      >
        <div className="space-y-2.5">
          {(["1", "2", "3", "4", "5", "6", "7", "8"] as const).map((num) => (
            <div key={num} className="rounded-lg bg-popover px-4 py-3">
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

function ClientGuide({ search }: { search: string }) {
  const { t } = useTranslation("docs");
  const q = search;

  const sectionMatches = [
    matchesSearch("getting started first login dashboard navigation overview how to begin", q),
    matchesSearch("what is leadawaker ai powered whatsapp lead follow-up autopilot book calls", q),
    matchesSearch("leads status new contacted responded qualified call booked not interested funnel", q),
    matchesSearch("conversations messages inbound outbound ai label manual takeover chat history sent delivered read status icons", q),
    matchesSearch("lead score 0 100 funnel stage engagement recency warm intent priority", q),
    matchesSearch("bookings calendar call booked appointment confirmed status", q),
    matchesSearch("account profile settings notifications timezone preferences manage", q),
    matchesSearch("reports insights campaign performance metrics response rate booking rate cost analytics", q),
    matchesSearch("faq frequently asked questions stop bot manual message bump reply does not respond export customize tone business hours assign campaigns", q),
  ];
  const noResults = q.trim() !== "" && sectionMatches.every((m) => !m);

  return (
    <div className="space-y-6 pb-8">
      {noResults && (
        <p className="text-sm text-muted-foreground text-center py-8">
          {t("noResults", { query: q })}
        </p>
      )}

      {/* Getting Started */}
      <DocSection
        id="sec-getting-started"
        icon={Sparkles}
        title={t("client.gettingStarted.title")}
        hidden={!sectionMatches[0]}
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
        hidden={!sectionMatches[1]}
      >
        <p>{t("client.what.p1")}</p>
        <p>{t("client.what.p2")}</p>
      </DocSection>

      {/* Your Leads */}
      <DocSection
        id="sec-leads"
        icon={Users}
        title={t("client.leads.title")}
        hidden={!sectionMatches[2]}
      >
        <p>{t("client.leads.description")}</p>
        <div className="space-y-1.5 mt-2">
          {([
            ["new",                "#7C3AED"],
            ["contacted",          "#818CF8"],
            ["responded",          "#3ACBDF"],
            ["multipleResponses",  "#31D35C"],
            ["qualified",          "#AED62E"],
            ["booked",             "#F7BF0E"],
            ["closed",             "#6B7280"],
            ["lost",               "#DC2626"],
            ["dnd",                "#722F37"],
          ] as const).map(([key, hex]) => (
            <div key={key} className="flex gap-3 items-center">
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold shrink-0"
                style={{ backgroundColor: `${hex}20`, color: hex }}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: hex }} />
                {t(`client.leads.stageLabels.${key}`)}
              </span>
              <span className="text-xs text-muted-foreground">{t(`client.leads.stages.${key}`)}</span>
            </div>
          ))}
        </div>
      </DocSection>

      {/* Conversations */}
      <DocSection
        id="sec-conversations"
        icon={MessageSquare}
        title={t("client.conversations.title")}
        hidden={!sectionMatches[3]}
      >
        <Step n={1}>{t("client.conversations.step1")}</Step>
        <Step n={2}>{t("client.conversations.step2")}</Step>
        <Step n={3}>{t("client.conversations.step3")}</Step>
        <Step n={4}>{t("client.conversations.step4")}</Step>
        <div className="space-y-1.5 ml-9">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-gray-400 shrink-0" /> <strong>{t("client.conversations.statusSent")}</strong> — {t("client.conversations.statusSentDesc")}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" /> <strong>{t("client.conversations.statusDelivered")}</strong> — {t("client.conversations.statusDeliveredDesc")}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" /> <strong>{t("client.conversations.statusRead")}</strong> — {t("client.conversations.statusReadDesc")}
          </div>
        </div>
        <Step n={5}>{t("client.conversations.step5")}</Step>
        <Tip>{t("client.conversations.tip")}</Tip>
      </DocSection>

      {/* Lead Score */}
      <DocSection
        id="sec-score"
        icon={Star}
        title={t("client.score.title")}
        hidden={!sectionMatches[4]}
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
            { score: 15, labelKey: "cold" as const, color: "#6B7280" },
            { score: 45, labelKey: "warming" as const, color: "#3ACBDF" },
            { score: 72, labelKey: "hot" as const, color: "#AED62E" },
            { score: 93, labelKey: "onFire" as const, color: "#F7BF0E" },
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
        <div className="rounded-xl border border-border/40 bg-muted/20 px-4 py-4 flex flex-col gap-3 mt-2">
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
        hidden={!sectionMatches[5]}
      >
        <p>{t("client.bookings.p1")}</p>
        <p>{t("client.bookings.p2")}</p>

        {/* Mini calendar illustration */}
        <div className="rounded-xl border border-border/40 bg-muted/20 p-4 mt-1">
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
              <span key={d} className={cn("text-[11px] rounded-md h-7 flex items-center justify-center", d === 9 ? "bg-[#F7BF0E]/20 text-[#F7BF0E] font-bold ring-1 ring-[#F7BF0E]/30" : "text-muted-foreground")}>{d}</span>
            ))}
            {/* Row 3 */}
            {[12, 13, 14, 15, 16, 17, 18].map((d) => (
              <span key={d} className={cn("text-[11px] rounded-md h-7 flex items-center justify-center", d === 14 ? "bg-[#31D35C]/20 text-[#31D35C] font-bold ring-1 ring-[#31D35C]/30" : d === 17 ? "bg-[#F7BF0E]/20 text-[#F7BF0E] font-bold ring-1 ring-[#F7BF0E]/30" : "text-muted-foreground")}>{d}</span>
            ))}
            {/* Row 4 */}
            {[19, 20, 21, 22, 23, 24, 25].map((d) => (
              <span key={d} className={cn("text-[11px] rounded-md h-7 flex items-center justify-center", d === 22 ? "bg-[#31D35C]/20 text-[#31D35C] font-bold ring-1 ring-[#31D35C]/30" : "text-muted-foreground")}>{d}</span>
            ))}
            {/* Row 5 */}
            {[26, 27, 28, 29, 30, null, null].map((d, i) => (
              <span key={`r5-${i}`} className={cn("text-[11px] rounded-md h-7 flex items-center justify-center", d === 28 ? "bg-[#7A73FF]/20 text-[#7A73FF] font-bold ring-1 ring-[#7A73FF]/30" : d ? "text-muted-foreground" : "")}>{d || ""}</span>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-3 pt-2 border-t border-border/20">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#F7BF0E]/30 ring-1 ring-[#F7BF0E]/40" />
              <span className="text-[10px] text-muted-foreground">{t("client.bookings.legendBooked")}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#31D35C]/30 ring-1 ring-[#31D35C]/40" />
              <span className="text-[10px] text-muted-foreground">{t("client.bookings.legendConfirmed")}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#7A73FF]/30 ring-1 ring-[#7A73FF]/40" />
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
        hidden={!sectionMatches[6]}
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
        hidden={!sectionMatches[7]}
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
            <div key={metricKey} className="rounded-lg bg-popover px-4 py-3">
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
            ["new",                "#7C3AED", 120],
            ["contacted",          "#818CF8", 98],
            ["responded",          "#3ACBDF", 54],
            ["multipleResponses",  "#31D35C", 32],
            ["qualified",          "#AED62E", 18],
            ["booked",             "#F7BF0E", 11],
          ] as const).map(([key, hex, count]) => {
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
            { score: 15, statusKey: "new" as const, color: "#6B7280" },
            { score: 42, statusKey: "responded" as const, color: "#3ACBDF" },
            { score: 78, statusKey: "qualified" as const, color: "#AED62E" },
            { score: 95, statusKey: "booked" as const, color: "#F7BF0E" },
          ]).map(({ score, statusKey, color }) => {
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
        hidden={!sectionMatches[8]}
      >
        <div className="space-y-2.5">
          {(["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const).map((num) => (
            <div key={num} className="rounded-lg bg-popover px-4 py-3">
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
  const isMobile = useIsMobile();
  const isOperator = isOperatorRole();
  const [tab, setTab] = useState<"operator" | "client">(
    isOperator ? "operator" : "client"
  );
  const [search, setSearch] = useState("");
  const [whatsNew, setWhatsNew] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

  // ── Gradient tester state (agency only) ────────────────────────────
  const GRADIENT_KEY = "la:gradient:docs";
  const [savedGradient, setSavedGradient] = useState<GradientLayer[] | null>(() => {
    try { const raw = localStorage.getItem(GRADIENT_KEY); return raw ? JSON.parse(raw) as GradientLayer[] : null; } catch { return null; }
  });
  const [gradientLayers, setGradientLayers] = useState<GradientLayer[]>(DEFAULT_LAYERS);
  const [gradientTesterOpen, setGradientTesterOpen] = useState(false);
  const [gradientDragMode, setGradientDragMode] = useState(false);

  const updateGradientLayer = useCallback((id: number, patch: Partial<GradientLayer>) => {
    if (id === -1) { setGradientLayers(prev => [...prev, patch as GradientLayer]); return; }
    if ((patch as any).id === -999) { setGradientLayers(prev => prev.filter(l => l.id !== id)); return; }
    if (id === -2) { setGradientLayers(prev => prev.filter(l => l.id !== (patch as GradientLayer).id)); return; }
    setGradientLayers(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));
  }, []);
  const resetGradientLayers = useCallback(() => {
    setGradientLayers(DEFAULT_LAYERS);
    setGradientDragMode(false);
  }, []);
  const handleApplyGradient = useCallback(() => {
    localStorage.setItem(GRADIENT_KEY, JSON.stringify(gradientLayers));
    setSavedGradient(gradientLayers);
    setGradientTesterOpen(false);
  }, [gradientLayers]);

  const currentToc = tab === "operator" ? OPERATOR_TOC : CLIENT_TOC;
  const contentRef = useRef<HTMLDivElement>(null);

  // IntersectionObserver: highlight sidebar item matching the visible section
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the topmost visible section
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActiveSectionId(visible[0].target.id);
        }
      },
      {
        root: container,
        rootMargin: "-10% 0px -70% 0px",
        threshold: 0,
      }
    );

    // Observe all section elements
    currentToc.forEach(({ id }) => {
      const el = container.querySelector(`#${id}`);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [currentToc, tab]);

  function handleSectionClick(id: string) {
    setActiveSectionId(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <CrmShell>
      <div className="h-full flex flex-col" data-testid="page-docs">
        <div className={cn(
          "flex-1 gap-0 min-h-0 overflow-hidden",
          isMobile ? "flex flex-col" : "flex"
        )}>
          {/* ── Left sidebar ── */}
          <nav
            className={cn(
              isMobile
                ? "flex flex-row gap-1 px-3 py-2 overflow-x-auto [scrollbar-width:none] border-b border-border/20 shrink-0 bg-background"
                : "w-[340px] shrink-0 bg-muted rounded-lg overflow-y-auto"
            )}
            data-testid="docs-nav"
          >
            {!isMobile && (
              <>
                {/* Title */}
                <div className="pl-[17px] pr-3.5 pt-10 pb-3 flex items-center justify-between">
                  <h1 className="text-2xl font-semibold font-heading text-foreground leading-tight">{t("title")}</h1>

                  {/* What's New — operator only */}
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

                {/* Tab switcher — agency view only */}
                {isOperator && (
                  <div className="flex gap-1 pl-[17px] pr-3.5 pt-1 pb-2">
                    <button
                      onClick={() => { setTab("operator"); setActiveSectionId(null); setSearch(""); }}
                      className={cn(
                        "h-9 px-4 rounded-full inline-flex items-center text-[13px] font-medium transition-colors",
                        tab === "operator"
                          ? "bg-card border border-black/[0.125] dark:border-white/[0.125] text-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-card/60 border border-transparent"
                      )}
                    >
                      {t("agencyDocs")}
                    </button>
                    <button
                      onClick={() => { setTab("client"); setActiveSectionId(null); setSearch(""); }}
                      className={cn(
                        "h-9 px-4 rounded-full inline-flex items-center text-[13px] font-medium transition-colors",
                        tab === "client"
                          ? "bg-card border border-black/[0.125] dark:border-white/[0.125] text-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-card/60 border border-transparent"
                      )}
                    >
                      {t("userDocs")}
                    </button>
                  </div>
                )}

                {/* Search */}
                <div className="pl-[17px] pr-3.5 pb-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder={t("searchPlaceholder")}
                      className="w-full h-9 pl-9 pr-8 rounded-full bg-card border border-black/[0.125] dark:border-white/[0.125] text-[13px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-brand-indigo/40 transition-[border-color]"
                    />
                    {search && (
                      <button
                        onClick={() => setSearch("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
                      >
                        <X className="h-3 w-3 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Section nav items */}
                <div className="flex flex-col gap-[3px] py-1 px-[3px]">
                  {currentToc.map(({ id, labelKey, icon: Icon }) => {
                    const isActive = activeSectionId === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => handleSectionClick(id)}
                        className={cn(
                          "w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-150",
                          isActive
                            ? "bg-white dark:bg-white/10 shadow-sm border border-black/[0.06] dark:border-white/[0.06] text-foreground font-semibold"
                            : "bg-card hover:bg-card-hover text-muted-foreground hover:text-foreground border border-transparent"
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span>{t(labelKey)}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {/* Mobile: horizontal pill bar */}
            {isMobile && (
              <div className="flex flex-row gap-1">
                {isOperator && (
                  <>
                    <button
                      onClick={() => { setTab("operator"); setActiveSectionId(null); }}
                      className={cn(
                        "inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-[12px] font-medium whitespace-nowrap shrink-0 transition-colors duration-150",
                        tab === "operator" ? "bg-[#FFF9D9] text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {t("agency")}
                    </button>
                    <button
                      onClick={() => { setTab("client"); setActiveSectionId(null); }}
                      className={cn(
                        "inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-[12px] font-medium whitespace-nowrap shrink-0 transition-colors duration-150",
                        tab === "client" ? "bg-[#FFF9D9] text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {t("user")}
                    </button>
                    <div className="w-px bg-border/30 shrink-0 my-1.5" />
                  </>
                )}
                {currentToc.map(({ id, labelKey, icon: Icon }) => {
                  const isActive = activeSectionId === id;
                  return (
                    <button
                      key={id}
                      onClick={() => handleSectionClick(id)}
                      className={cn(
                        "inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-[12px] font-medium whitespace-nowrap shrink-0 transition-colors duration-150",
                        isActive ? "bg-white dark:bg-white/10 shadow-sm border border-black/[0.06] dark:border-white/[0.06] text-foreground font-semibold" : "text-muted-foreground hover:text-foreground border border-transparent"
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      {t(labelKey)}
                    </button>
                  );
                })}
              </div>
            )}
          </nav>

          {/* ── Right content area ── */}
          <div
            ref={contentRef}
            className={cn(
              "flex-1 relative bg-card rounded-lg w-full overflow-y-auto",
              !isMobile && "ml-1.5"
            )}
            data-testid="docs-content"
          >
            {/* Gradient background — sticky so it stays fixed while scrolling */}
            {gradientTesterOpen ? (
              <div className="sticky top-0 left-0 right-0 h-0 z-0">
                {gradientLayers.map(layer => {
                  const style = layerToStyle(layer);
                  return style ? <div key={layer.id} className="absolute inset-0 h-[200vh]" style={style} /> : null;
                })}
                {gradientDragMode && (
                  <GradientControlPoints layers={gradientLayers} onUpdateLayer={updateGradientLayer} />
                )}
              </div>
            ) : savedGradient ? (
              <div className="sticky top-0 left-0 right-0 h-0 z-0">
                {savedGradient.map((layer: GradientLayer) => {
                  const style = layerToStyle(layer);
                  return style ? <div key={layer.id} className="absolute inset-0 h-[200vh]" style={style} /> : null;
                })}
              </div>
            ) : null}

            <div className="relative">
              <div className="pl-[17px] pr-3.5 pt-10 pb-3 flex items-center justify-between">
                <h2 className="text-2xl font-semibold font-heading text-foreground leading-tight">
                  {tab === "operator" ? t("agencyDocumentation") : t("userDocumentation")}
                </h2>
                {/* Gradient tester toggle (agency only) */}
                {isOperator && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!gradientTesterOpen) setGradientLayers(savedGradient ?? DEFAULT_LAYERS);
                      setGradientTesterOpen(prev => !prev);
                    }}
                    className={cn(
                      "group inline-flex items-center h-9 pl-[9px] rounded-full border text-[12px] font-medium overflow-hidden shrink-0 transition-[max-width,color,border-color] duration-200 max-w-9 hover:max-w-[100px]",
                      gradientTesterOpen
                        ? "border-indigo-200 text-indigo-600 bg-indigo-100"
                        : "border-black/[0.125] dark:border-white/[0.125] text-foreground/60 hover:text-foreground"
                    )}
                    title={t("gradientTester")}
                  >
                    <Paintbrush className="h-4 w-4 shrink-0" />
                    <span className="whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">{t("gradientTesterStyle")}</span>
                  </button>
                )}
              </div>
              <div className="px-6 pb-8">
                {tab === "operator"
                  ? <OperatorManual search={search} />
                  : <ClientGuide search={search} />
                }
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Gradient tester panel */}
      <GradientTester
        open={gradientTesterOpen}
        onClose={() => setGradientTesterOpen(false)}
        layers={gradientLayers}
        onUpdateLayer={updateGradientLayer}
        onResetLayers={resetGradientLayers}
        dragMode={gradientDragMode}
        onToggleDragMode={() => setGradientDragMode(prev => !prev)}
        onApply={handleApplyGradient}
      />

      <WhatsNewSheet open={whatsNew} onClose={() => setWhatsNew(false)} />
    </CrmShell>
  );
}
