/**
 * DocsPage: in-app documentation for LeadAwaker.
 * Agency Documentation (Admin/Operator) and User Documentation (Manager/Viewer).
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CrmShell } from "@/components/crm/CrmShell";
import { useLastTab } from "@/hooks/useLastTab";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import {
  Users,
  Megaphone,
  Zap,
  BarChart2,
  Settings,
  MessageSquare,
  Wrench,
  Globe,
  Copy,
  Check,
  Sparkles,
  ExternalLink,
  FileText,
  Receipt,
  User,
} from "lucide-react";
import { PIPELINE_HEX } from "@/lib/avatarUtils";
import { Pill, PageTopbar, TopbarTabs, TopbarIconButton } from "@/components/crm/primitives";
import { DocSection, Step, Tip, STAGE_KEYS, STAGE_KEY_TO_HEX } from "@/features/docs/docParts";
import { ReactivationGuide } from "@/features/docs/ReactivationGuide";
import { ClientGuide } from "@/features/docs/ClientGuide";
import { useHomeServices } from "@/features/home/api/homeApi";
import { useChatCampaign, receptionistCampaignId } from "@/features/accounts/components/workspace/chat/useChatCampaign";
import { useWorkspace } from "@/hooks/useWorkspace";
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

// Automation-status colors have no shared constant: keep one local map.
const AUTOMATION_HEX: Record<string, string> = {
  paused:    PIPELINE_HEX.Closed,
  queued:    PIPELINE_HEX.Contacted,
  active:    PIPELINE_HEX["Multiple Responses"],
  completed: PIPELINE_HEX.Qualified,
  dnd:       PIPELINE_HEX.Lost,
};

// ── Changelog data ────────────────────────────────────────────────────────────

const CHANGELOG_KEYS = [
  { version: "v1.5", key: "v15" },
  { version: "v1.4", key: "v14" },
  { version: "v1.3", key: "v13" },
  { version: "v1.2", key: "v12" },
];

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
  // Operators reopen on the docs tab they used last; everyone else only has the client docs.
  const [tab, setTab] = useLastTab<"operator" | "client">(
    "docs", isOperator ? ["operator", "client"] : ["client"], isOperator ? "operator" : "client",
  );
  const [whatsNew, setWhatsNew] = useState(false);
  const { currentAccountId, currentAccount } = useWorkspace();
  const { data: services } = useHomeServices(currentAccountId);
  // The receptionist's name: the same campaign draft field the Chat tab's Behaviour row shows.
  const { campaign } = useChatCampaign(receptionistCampaignId(currentAccount?.inbound_campaign_id, null));
  const agentName = String(campaign?.agent_name ?? "").trim() || null;
  const hasReactivation = !!services?.reactivation;
  const hasReceptionist = !!services?.phone || !!services?.website || !hasReactivation;

  function openFounderChat() {
    window.dispatchEvent(new CustomEvent("open-founder-chat"));
  }

  return (
    <CrmShell>
      <div className="la-page" data-testid="page-docs">
        {/* ── Topbar ─────────────────────────────────────────────────────── */}
        <PageTopbar
          title={t("title")}
          left={isOperator && (
            /* Tab switcher: operator view only */
            <TopbarTabs
              tabs={[
                { id: "operator" as const, label: t("agencyDocs") },
                { id: "client" as const, label: t("userDocs") },
              ]}
              value={tab}
              onChange={setTab}
            />
          )}
          right={<>
            {/* Chat with Gabriel */}
            <TopbarIconButton label={tc("sidebar.messageFounder")} onClick={openFounderChat}>
              <MessageSquare className="h-4 w-4" />
            </TopbarIconButton>
            {/* What's New: operator only */}
            {isOperator && (
              <TopbarIconButton label={t("whatsNew")} onClick={() => setWhatsNew(true)}>
                <Sparkles className="h-4 w-4" />
              </TopbarIconButton>
            )}
          </>}
        />

        {/* ── Scrollable content ──────────────────────────────────────────── */}
        <div className="flex-1 min-h-0 overflow-y-auto" data-testid="docs-content">
          <div className="px-6 pb-8 pt-4">
            {tab === "operator" ? <OperatorManual /> : (
              <div className="space-y-6">
                {hasReceptionist && (
                  <ClientGuide
                    agentName={agentName}
                    companyName={currentAccount?.name ?? ""}
                    hasPhone={!!services?.phone}
                    hasWebsite={!!services?.website}
                  />
                )}
                {hasReactivation && <ReactivationGuide />}
              </div>
            )}
          </div>
        </div>
      </div>

      <WhatsNewSheet open={whatsNew} onClose={() => setWhatsNew(false)} />
    </CrmShell>
  );
}
