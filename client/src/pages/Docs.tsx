/**
 * DocsPage — In-app documentation for LeadAwaker.
 * Agency Documentation (Admin/Operator) and User Documentation (Manager/Viewer).
 * Split-pane layout: left sidebar navigation + right scrollable content.
 */

import { useState } from "react";
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
} from "lucide-react";
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

const CHANGELOG: { version: string; date: string; items: string[] }[] = [
  {
    version: "v1.5",
    date: "March 2026",
    items: [
      "Documentation redesign — sidebar navigation, expanded content, agency/user split",
      "New docs sections: User Management, Prompt Library, Billing, Getting Started, Reports",
    ],
  },
  {
    version: "v1.4",
    date: "March 2026",
    items: [
      "Documentation page with Operator Manual and Client Guide",
      "Campaign Tags tab — group and organize tags by category",
      "Users management page — roles, avatars, and permissions",
      "Support chat integration in the navigation bar",
      "Instagram contact sync — pull existing DM contacts from Meta's API",
    ],
  },
  {
    version: "v1.3",
    date: "February 2026",
    items: [
      "Full design system overhaul — new color palette and avatar system",
      "Leads page redesign — split-pane with List, Table, and Kanban views",
      "Calendar page — monthly, weekly, and daily booking views",
      "Conversations inbox — real-time WhatsApp chat interface",
    ],
  },
  {
    version: "v1.2",
    date: "January 2026",
    items: [
      "Campaigns page — create, manage, and monitor campaigns",
      "Prompt Library — AI persona and script management",
      "Automation Logs — full audit trail for every lead action",
      "Billing & Expenses — BTW/VAT invoice management with PDF upload",
    ],
  },
];

// ── TOC anchor data ───────────────────────────────────────────────────────────

type TocItem = { id: string; label: string; icon: React.ElementType };

const OPERATOR_TOC: TocItem[] = [
  { id: "sec-setup",        label: "Account Setup",        icon: Settings },
  { id: "sec-campaign",     label: "Creating a Campaign",  icon: Megaphone },
  { id: "sec-lifecycle",    label: "Lead Lifecycle",        icon: Zap },
  { id: "sec-webhooks",     label: "CRM Webhooks",         icon: Globe },
  { id: "sec-instagram",    label: "Instagram",             icon: Globe },
  { id: "sec-analytics",    label: "Analytics & Reporting", icon: BarChart2 },
  { id: "sec-users",        label: "User Management",      icon: Users },
  { id: "sec-prompts",      label: "Prompt Library",        icon: FileText },
  { id: "sec-billing",      label: "Billing & Invoicing",   icon: Receipt },
  { id: "sec-troubleshoot", label: "Troubleshoot",          icon: Wrench },
];

const CLIENT_TOC: TocItem[] = [
  { id: "sec-getting-started", label: "Getting Started",       icon: Sparkles },
  { id: "sec-what",            label: "What is LeadAwaker?",   icon: BookOpen },
  { id: "sec-leads",           label: "Your Leads",            icon: Users },
  { id: "sec-conversations",   label: "Conversations",         icon: MessageSquare },
  { id: "sec-score",           label: "Lead Score",             icon: Star },
  { id: "sec-bookings",        label: "Bookings",               icon: CalendarCheck },
  { id: "sec-account-mgmt",   label: "Your Account",           icon: User },
  { id: "sec-reports",         label: "Reports & Insights",     icon: BarChart2 },
  { id: "sec-faq",             label: "FAQ",                     icon: AlertCircle },
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
    <div id={id} className="rounded-xl bg-card overflow-hidden scroll-mt-6">
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
        title="Copy"
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
  const roles = [
    { role: "Admin",    view: "Agency",     access: "Full CRUD on all entities, user management, billing" },
    { role: "Operator", view: "Agency",     access: "Filtered by assigned accounts, no user management" },
    { role: "Manager",  view: "Subaccount", access: "Read + limited write, scoped to their account" },
    { role: "Viewer",   view: "Subaccount", access: "Read-only, scoped to their account" },
  ];
  return (
    <div className="rounded-lg overflow-hidden border border-black/[0.06] dark:border-white/[0.06]">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-popover">
            <th className="text-left px-3 py-2 font-semibold">Role</th>
            <th className="text-left px-3 py-2 font-semibold">View</th>
            <th className="text-left px-3 py-2 font-semibold">Access</th>
          </tr>
        </thead>
        <tbody>
          {roles.map(({ role, view, access }) => (
            <tr key={role} className="border-t border-black/[0.04] dark:border-white/[0.04]">
              <td className="px-3 py-2 font-medium">{role}</td>
              <td className="px-3 py-2 text-muted-foreground">{view}</td>
              <td className="px-3 py-2 text-muted-foreground">{access}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Operator Manual (Agency Documentation) ───────────────────────────────────

function OperatorManual({ search }: { search: string }) {
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
    <div className="space-y-4 pb-8">
      {noResults && (
        <p className="text-sm text-muted-foreground text-center py-8">
          No sections match "<strong>{q}</strong>"
        </p>
      )}

      {/* 1 - Account Setup */}
      <DocSection
        id="sec-setup"
        icon={Settings}
        title="1 · Account Setup"
        hidden={!sectionMatches[0]}
      >
        <Step n={1}>
          Go to <SettingsLink>Settings → Integrations</SettingsLink>. Enter your{" "}
          <strong>Twilio Account SID</strong>, <strong>Auth Token</strong>, and the{" "}
          <strong>From Number</strong> (or Messaging Service SID) for this account.
        </Step>
        <Step n={2}>
          Choose your <strong>number type</strong>: Local numbers are cheapest but have the lowest
          throughput. Toll-free numbers are recommended for most accounts. Short codes offer the
          highest volume but require a separate application.
        </Step>
        <Step n={3}>
          If using a US 10-digit local number for A2P (application-to-person) messaging, you must
          complete <strong>A2P 10DLC registration</strong> with your carrier through Twilio's console.
          Without registration, messages may be filtered or blocked.
        </Step>
        <Step n={4}>
          Set your <strong>business hours</strong> (start/end time) and{" "}
          <strong>timezone</strong>. The engine will never send messages outside these hours.
        </Step>
        <Step n={5}>
          Set a <strong>Daily Send Limit</strong> (default 500). This is the max messages
          the account can send per day across all campaigns.
        </Step>
        <Step n={6}>
          Copy the <strong>API Key</strong> (webhook_secret) from{" "}
          <SettingsLink>Settings</SettingsLink>. Paste this into your CRM integrations to
          authorize inbound leads.
        </Step>
        <Tip>
          The API key is shown once on generation. If lost, regenerate it — the old key
          will stop working immediately.
        </Tip>
      </DocSection>

      {/* 2 - Creating a Campaign */}
      <DocSection
        id="sec-campaign"
        icon={Megaphone}
        title="2 · Creating a Campaign"
        hidden={!sectionMatches[1]}
      >
        <Step n={1}>
          Go to <strong>Campaigns → New Campaign</strong>. Give it a name and select the{" "}
          <strong>channel</strong> (SMS or WhatsApp).
        </Step>
        <div className="rounded-lg bg-popover px-4 py-3 text-xs space-y-1.5">
          <p className="font-semibold">SMS vs WhatsApp — when to use which</p>
          <p className="text-muted-foreground"><strong>SMS:</strong> Higher open rates in the US/Canada, works with any phone, no template approval needed. Best for short, direct re-engagement.</p>
          <p className="text-muted-foreground"><strong>WhatsApp:</strong> Preferred internationally, supports rich media, requires pre-approved message templates for the first outbound message. Best for longer conversational flows.</p>
        </div>
        <Step n={2}>
          Write your <strong>First Message</strong> template. Use merge tags:{" "}
          <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{"{{first_name}}"}</code>,{" "}
          <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{"{{agent_name}}"}</code>,{" "}
          <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{"{{service}}"}</code>.
        </Step>
        <Step n={3}>
          For WhatsApp campaigns, your first message template must be{" "}
          <strong>approved by Meta</strong> before it can be sent. Submit it via the Twilio
          console under Messaging → Content Templates. Approval takes 1–3 business days.
        </Step>
        <Step n={4}>
          Add up to 3 <strong>Follow-up bumps</strong>. Set the delay in hours for each
          (e.g., 24h, 48h, 72h). Bumps are sent only if the lead hasn't replied.
        </Step>
        <Step n={5}>
          Set <strong>Active Hours</strong>, <strong>Daily Lead Limit</strong>, and
          optionally link a <strong>Prompt Library entry</strong> to customize the AI's
          persona.
        </Step>
        <Step n={6}>
          Set campaign status to <strong>Active</strong> when you're ready to start sending.
        </Step>
        <Tip>
          Keep the first message short and personal. Avoid links in the first message —
          many carrier filters block them.
        </Tip>
      </DocSection>

      {/* 3 - Lead Lifecycle */}
      <DocSection
        id="sec-lifecycle"
        icon={Zap}
        title="3 · Lead Lifecycle & Statuses"
        hidden={!sectionMatches[2]}
      >
        <p className="font-semibold">Pipeline Stages (Conversion Status)</p>
        <p>Every lead sits in one of these pipeline stages visible on the Kanban board:</p>
        <div className="space-y-1.5 mt-2">
          {[
            ["New",                "#6B7280", "Lead just arrived, not yet contacted."],
            ["Contacted",          "#7A73FF", "First message sent. Waiting for a reply."],
            ["Responded",          "#3ACBDF", "Lead replied at least once."],
            ["Multiple Responses", "#31D35C", "Active back-and-forth dialogue."],
            ["Qualified",          "#AED62E", "Lead shows intent — being guided to book."],
            ["Booked",             "#F7BF0E", "Appointment confirmed. North-star KPI."],
            ["Closed",             "#6B7280", "Deal completed — no further action."],
            ["Lost",               "#DC2626", "Lead went cold or was not a fit."],
            ["DND",                "#722F37", "Opted out. Never contacted again."],
          ].map(([label, hex, desc]) => (
            <div key={label} className="flex gap-3 items-center">
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold shrink-0"
                style={{ backgroundColor: `${hex}20`, color: hex }}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: hex }} />
                {label}
              </span>
              <span className="text-xs text-muted-foreground">{desc}</span>
            </div>
          ))}
        </div>

        <p className="font-semibold mt-4">Automation Statuses</p>
        <p>Behind the scenes, leads also have an automation status that controls messaging:</p>
        <div className="space-y-1.5 mt-2">
          {[
            ["paused",    "#6B7280", "Created but not yet assigned to a campaign. No messages sent."],
            ["queued",    "#7A73FF", "Assigned to an active campaign. Picked up within 60 seconds."],
            ["active",    "#31D35C", "First message sent. Eligible for bumps and AI replies."],
            ["completed", "#8B5CF6", "All bumps sent, booking confirmed, or lead exhausted."],
            ["dnd",       "#DC2626", "Lead opted out (replied STOP). Never contacted again."],
          ].map(([label, hex, desc]) => (
            <div key={label} className="flex gap-3 items-center">
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold shrink-0"
                style={{ backgroundColor: `${hex}20`, color: hex }}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: hex }} />
                {label}
              </span>
              <span className="text-xs text-muted-foreground">{desc}</span>
            </div>
          ))}
        </div>
        <Tip>
          To pause a specific lead manually, set their automation_status to "paused" in the
          lead detail panel. To pause a whole campaign, set campaign status to "Inactive".
        </Tip>
      </DocSection>

      {/* 4 - CRM Webhooks */}
      <DocSection
        id="sec-webhooks"
        icon={Globe}
        title="4 · Source Adapters (CRM Webhooks)"
        hidden={!sectionMatches[3]}
      >
        <p>
          Each CRM has a dedicated intake URL. Paste the URL into your CRM's webhook
          settings. Leads are automatically created and queued.
        </p>
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
        <Tip>
          Replace{" "}
          <code className="bg-amber-100 dark:bg-amber-900/30 px-1 rounded text-[11px] font-mono">YOUR_KEY</code>{" "}
          with the API key from <SettingsLink>Settings</SettingsLink>. Replace{" "}
          <code className="bg-amber-100 dark:bg-amber-900/30 px-1 rounded text-[11px] font-mono">ID</code>{" "}
          with the campaign ID from the campaign detail page.
        </Tip>
      </DocSection>

      {/* 5 - Instagram */}
      <DocSection
        id="sec-instagram"
        icon={Globe}
        title="5 · Instagram Integration"
        hidden={!sectionMatches[4]}
      >
        <p>
          Connect an Instagram Business account to sync existing DM contacts
          and receive inbound messages.
        </p>
        <Step n={1}>
          Go to <SettingsLink>Settings → Account</SettingsLink>. Enter your{" "}
          <strong>Instagram User ID</strong> (your IG Business Account numeric ID) and{" "}
          <strong>Access Token</strong> (a long-lived Page access token from Meta).
        </Step>
        <Step n={2}>
          Click <strong>Sync Instagram Contacts</strong> to pull all existing DM
          conversation contacts from Meta's API. Each unique contact is created as a
          lead with status <Badge label="paused" color="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300" />.
        </Step>
        <Step n={3}>
          Assign synced leads to a campaign to start automated outreach, or use
          them for manual follow-up in the Conversations inbox.
        </Step>
        <Tip>
          Meta allows ~200 API calls per hour per token. For accounts with 200+
          contacts, the sync may stop early due to rate limiting — just run it
          again after an hour. Duplicates are automatically skipped.
        </Tip>
      </DocSection>

      {/* 6 - Analytics */}
      <DocSection
        id="sec-analytics"
        icon={BarChart2}
        title="6 · Analytics & Reporting"
        hidden={!sectionMatches[5]}
      >
        <Step n={1}>
          <strong>Lead Scores</strong> (0–100) are recalculated every 30 minutes. They
          combine funnel stage (40%), engagement (30%), and activity recency (30%).
        </Step>
        <Step n={2}>
          <strong>Campaign Metrics</strong> (response rate, booking rate, cost per lead)
          are snapshotted daily at midnight. Check them under Reports.
        </Step>
        <Step n={3}>
          <strong>Automation Logs</strong> show every step the engine took for every lead —
          useful for debugging missed sends or unexpected behavior.
        </Step>
        <Tip>A lead score above 70 = high intent. Prioritize manual follow-up on these.</Tip>
      </DocSection>

      {/* 7 - User Management & Roles */}
      <DocSection
        id="sec-users"
        icon={Users}
        title="7 · User Management & Roles"
        hidden={!sectionMatches[6]}
      >
        <p>
          LeadAwaker uses a role-based access model. Each user is assigned one role that
          determines what they can see and do.
        </p>
        <RolesTable />
        <Step n={1}>
          To invite a new user, go to <SettingsLink>Settings → Team</SettingsLink> and
          click <strong>Add User</strong>. Enter their name, email, and role.
        </Step>
        <Step n={2}>
          <strong>Operators</strong> can be assigned to specific accounts. They will only
          see leads, campaigns, and data for their assigned accounts.
        </Step>
        <Step n={3}>
          <strong>Managers and Viewers</strong> always see the subaccount view, scoped
          to their own account. They cannot access other accounts' data.
        </Step>
        <Tip>
          Only Admins can create or delete users. Operators can view the team list but
          cannot change roles or remove members.
        </Tip>
      </DocSection>

      {/* 8 - Prompt Library */}
      <DocSection
        id="sec-prompts"
        icon={FileText}
        title="8 · Prompt Library & AI Personas"
        hidden={!sectionMatches[7]}
      >
        <p>
          The Prompt Library stores reusable AI persona definitions that control how the
          AI agent speaks, what tone it uses, and how it handles objections.
        </p>
        <Step n={1}>
          Go to <strong>Prompt Library</strong> and click <strong>New Prompt</strong>.
          Give it a clear name (e.g., "Friendly Sales Agent" or "Dutch Appointment Setter").
        </Step>
        <Step n={2}>
          Write the <strong>system message</strong>. This is the instruction the AI receives
          before every conversation. Include: tone, language, the service being offered,
          how to handle objections, and when to stop pushing.
        </Step>
        <Step n={3}>
          Use <strong>template variables</strong> in your prompt:{" "}
          <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{"{{agent_name}}"}</code>,{" "}
          <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{"{{service}}"}</code>,{" "}
          <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{"{{company}}"}</code>.
          These are filled automatically per-account.
        </Step>
        <Step n={4}>
          Link your prompt to a campaign under <strong>Campaign → Configurations</strong>.
          Each campaign can use a different AI persona.
        </Step>
        <Tip>
          Best practice: keep system messages under 500 words. Be explicit about what the
          AI should NOT do (e.g., "Never promise discounts", "Don't mention competitors").
        </Tip>
      </DocSection>

      {/* 9 - Billing */}
      <DocSection
        id="sec-billing"
        icon={Receipt}
        title="9 · Billing & Invoicing"
        hidden={!sectionMatches[8]}
      >
        <p>
          The Billing section tracks contracts, invoices, and expenses for each account.
        </p>
        <Step n={1}>
          <strong>Contracts</strong> define the agreement between you and the client —
          monthly fee, start date, and terms. Create them under Billing → Contracts.
        </Step>
        <Step n={2}>
          <strong>Invoices</strong> are sent to clients for payment. You can generate
          invoices manually or set up recurring billing. Each invoice links to a contract.
        </Step>
        <Step n={3}>
          <strong>Expenses</strong> (agency-only) track costs like Twilio usage, API fees,
          and other operational costs. Upload PDF receipts for record-keeping.
        </Step>
        <Tip>
          All amounts support BTW/VAT calculations automatically. Set your VAT rate in
          the account settings to have it applied to new invoices.
        </Tip>
      </DocSection>

      {/* 10 - Troubleshoot */}
      <DocSection
        id="sec-troubleshoot"
        icon={Wrench}
        title="10 · Troubleshoot"
        hidden={!sectionMatches[9]}
      >
        <div className="space-y-2.5">
          {[
            ["Lead not receiving messages",    "Check: campaign status = Active, lead automation_status = queued, business hours not blocking, daily limit not reached. Check Automation Logs for the lead."],
            ["Wrong language in replies",      "Ensure the lead's language field is set. The AI uses this to reply in the correct language."],
            ["Lead stuck in 'sending' status", "This means Twilio failed to send the first message. Manually reset to 'queued' in the DB and check Twilio credentials."],
            ["Duplicate leads",                "Phone-based dedup is per-account. The same phone cannot be in the same account twice. Different accounts can have the same phone."],
            ["AI replies stopped",             "Check Automation Logs for ai_conversation errors. Usually means OpenAI API key issue or rate limit."],
            ["Messages flagged as spam",       "This usually means the sending number has a low trust score. Register for A2P 10DLC (US), avoid link-heavy messages, and warm up new numbers gradually (start with 50–100 messages/day)."],
            ["WhatsApp template not approved",  "Review Meta's template guidelines: no promotional language in utility templates, no URL shorteners, and correct category selection. Re-submit with edits and allow 1–3 business days."],
            ["Lead score not updating",         "Scores refresh every 30 minutes via a cron job. If scores are stale beyond that, check that the scoring engine is running in Automation Logs (look for 'lead_score_batch' entries)."],
          ].map(([problem, solution]) => (
            <div key={problem} className="rounded-lg bg-popover px-4 py-3">
              <p className="font-semibold text-xs mb-1">{problem}</p>
              <p className="text-xs text-muted-foreground">{solution}</p>
            </div>
          ))}
        </div>
      </DocSection>
    </div>
  );
}

// ── Client Guide (User Documentation) ────────────────────────────────────────

function ClientGuide({ search }: { search: string }) {
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
    <div className="space-y-4 pb-8">
      {noResults && (
        <p className="text-sm text-muted-foreground text-center py-8">
          No sections match "<strong>{q}</strong>"
        </p>
      )}

      {/* Getting Started */}
      <DocSection
        id="sec-getting-started"
        icon={Sparkles}
        title="Getting Started"
        hidden={!sectionMatches[0]}
      >
        <p>
          Welcome to LeadAwaker! Here's a quick overview of what you'll see after logging in.
        </p>
        <Step n={1}>
          After logging in, you'll land on the <strong>Campaigns</strong> page. This shows
          all active campaigns running for your account with key metrics at a glance.
        </Step>
        <Step n={2}>
          Use the <strong>left sidebar</strong> to navigate between pages: Campaigns, Leads,
          Conversations, Calendar, and Documentation (this page).
        </Step>
        <Step n={3}>
          Click on any <strong>lead</strong> to view their full profile, conversation history,
          and current status in the pipeline.
        </Step>
        <Tip>
          Start by reviewing your active campaigns and their lead counts. The Leads page
          lets you filter by status to quickly find your hottest prospects.
        </Tip>
      </DocSection>

      {/* What is LeadAwaker? */}
      <DocSection
        id="sec-what"
        icon={BookOpen}
        title="What is LeadAwaker?"
        hidden={!sectionMatches[1]}
      >
        <p>
          LeadAwaker is an AI-powered lead follow-up system. When someone expresses interest
          in your service (fills a form, clicks an ad, etc.), LeadAwaker automatically reaches
          out via WhatsApp, nurtures the conversation, and books calls — all on autopilot.
        </p>
        <p>
          The AI agent replies to leads in real time, handles objections, and knows when to
          stop and let a human take over.
        </p>
      </DocSection>

      {/* Your Leads */}
      <DocSection
        id="sec-leads"
        icon={Users}
        title="Understanding Your Leads"
        hidden={!sectionMatches[2]}
      >
        <p>
          Each lead goes through a journey from first contact to booking. Here's what the
          status indicators mean:
        </p>
        <div className="space-y-1.5 mt-2">
          {[
            ["New",                "#6B7280", "Lead just arrived, not yet contacted."],
            ["Contacted",          "#7A73FF", "First message sent. Waiting for a reply."],
            ["Responded",          "#3ACBDF", "Lead replied at least once. AI is in conversation."],
            ["Multiple Responses", "#31D35C", "Active back-and-forth dialogue with the AI."],
            ["Qualified",          "#AED62E", "Lead has shown interest and is being guided to book."],
            ["Booked",             "#F7BF0E", "Appointment confirmed! This is the north-star outcome."],
            ["Closed",             "#6B7280", "Deal completed — no further action needed."],
            ["Lost",               "#DC2626", "Lead went cold or was not a fit."],
            ["DND",                "#722F37", "Lead opted out. Never contacted again."],
          ].map(([label, hex, desc]) => (
            <div key={label} className="flex gap-3 items-center">
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold shrink-0"
                style={{ backgroundColor: `${hex}20`, color: hex }}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: hex }} />
                {label}
              </span>
              <span className="text-xs text-muted-foreground">{desc}</span>
            </div>
          ))}
        </div>
      </DocSection>

      {/* Conversations */}
      <DocSection
        id="sec-conversations"
        icon={MessageSquare}
        title="Reading Conversations"
        hidden={!sectionMatches[3]}
      >
        <Step n={1}>
          Open the <strong>Leads</strong> page and click any lead to view their full
          conversation history.
        </Step>
        <Step n={2}>
          Messages shown on the <strong>right side</strong> are outbound (sent by the AI
          or your team). Messages on the <strong>left</strong> are inbound (from the lead).
        </Step>
        <Step n={3}>
          Look for the <strong>AI label</strong> on messages — these were generated
          automatically. Messages without this label were sent manually.
        </Step>
        <Step n={4}>
          Message status icons tell you the delivery state:
        </Step>
        <div className="space-y-1.5 ml-9">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-gray-400 shrink-0" /> <strong>Sent</strong> — message left the system
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" /> <strong>Delivered</strong> — confirmed arrival on the lead's device
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" /> <strong>Read</strong> — lead opened the message (WhatsApp only)
          </div>
        </div>
        <Step n={5}>
          If you want to take over the conversation manually, toggle{" "}
          <strong>Manual Takeover</strong> on the lead detail. The AI will stop replying
          and you can message freely. To hand back to the AI, toggle it off again.
        </Step>
        <Tip>
          Use Manual Takeover for high-value leads you want to handle personally. The AI
          won't interfere while takeover is active — but remember to turn it off when done,
          or the lead will stop receiving automated follow-ups.
        </Tip>
      </DocSection>

      {/* Lead Score */}
      <DocSection
        id="sec-score"
        icon={Star}
        title="Lead Score"
        hidden={!sectionMatches[4]}
      >
        <p>
          Every lead has a <strong>Lead Score</strong> from 0 to 100 that estimates how
          likely they are to book. It's calculated from:
        </p>
        <ul className="list-disc pl-4 space-y-1 mt-1">
          <li>Their current funnel stage (40%)</li>
          <li>How many times they've replied and how recently (30%)</li>
          <li>Recency of their last activity (30%)</li>
        </ul>

        {/* Score ring examples (card view) */}
        <p className="font-semibold mt-2">Score Rings (Card & Kanban View)</p>
        <p>Small score rings appear on lead cards, showing at a glance how warm each lead is:</p>
        <div className="flex items-center gap-4 mt-2 flex-wrap">
          {[
            { score: 15, label: "Cold", color: "#6B7280" },
            { score: 45, label: "Warming", color: "#3ACBDF" },
            { score: 72, label: "Hot", color: "#AED62E" },
            { score: 93, label: "On Fire", color: "#F7BF0E" },
          ].map(({ score, label, color }) => {
            const r = 18;
            const circ = 2 * Math.PI * r;
            const offset = circ - (score / 100) * circ;
            return (
              <div key={label} className="flex flex-col items-center gap-1">
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
                <span className="text-[10px] font-medium text-muted-foreground">{label}</span>
              </div>
            );
          })}
        </div>

        {/* Score gauges (detail panel view) */}
        <p className="font-semibold mt-4">Score Breakdown (Lead Detail Panel)</p>
        <p>When you open a lead, the detail panel shows three score gauges:</p>
        <div className="rounded-xl border border-border/40 bg-muted/20 px-4 py-4 flex flex-col gap-3 mt-2">
          {[
            { label: "Lead Score", value: 72, bar: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
            { label: "Engagement", value: 58, bar: "bg-amber-400", text: "text-amber-600 dark:text-amber-400" },
            { label: "Activity Score", value: 85, bar: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
          ].map(({ label, value, bar, text }) => (
            <div key={label} className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">{label}</span>
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
          <strong>Lead Score</strong> is the overall composite. <strong>Engagement</strong> tracks reply frequency and recency. <strong>Activity Score</strong> measures recent pipeline movement.
        </p>

        <Tip>
          Leads with a score above 70 are your warmest prospects. Prioritize these for
          manual outreach.
        </Tip>
      </DocSection>

      {/* Bookings */}
      <DocSection
        id="sec-bookings"
        icon={CalendarCheck}
        title="Bookings"
        hidden={!sectionMatches[5]}
      >
        <p>
          When the AI detects a booking confirmation in the conversation, the lead is
          automatically moved to <strong>Call Booked</strong> status. The booking date
          and time are saved to the lead record.
        </p>
        <p>
          You can view all upcoming bookings on the <strong>Calendar</strong> page.
        </p>
        <Tip>
          If a booking appears incorrect or was auto-detected by mistake, manually update
          the lead status from the detail panel.
        </Tip>
      </DocSection>

      {/* Managing Your Account */}
      <DocSection
        id="sec-account-mgmt"
        icon={User}
        title="Managing Your Account"
        hidden={!sectionMatches[6]}
      >
        <p>
          Customize your profile and preferences from the Settings page.
        </p>
        <Step n={1}>
          <strong>Profile:</strong> Update your name, email, phone number, and avatar under{" "}
          <SettingsLink>Settings → My Profile</SettingsLink>.
        </Step>
        <Step n={2}>
          <strong>Notifications:</strong> Choose which events trigger alerts (call booked,
          lead responded, AI needs takeover) and how you receive them (in-app or email).
          Set quiet hours to pause notifications outside business hours.
        </Step>
        <Step n={3}>
          <strong>Timezone:</strong> Make sure your timezone is set correctly — it affects
          how business hours, scheduling, and calendar events are displayed.
        </Step>
        <Tip>
          Enable email notifications for "Call Booked" events so you never miss a new
          appointment, even when you're away from the dashboard.
        </Tip>
      </DocSection>

      {/* Reports & Insights */}
      <DocSection
        id="sec-reports"
        icon={BarChart2}
        title="Reports & Insights"
        hidden={!sectionMatches[7]}
      >
        <p>
          Track how your campaigns are performing with key metrics available across the
          dashboard.
        </p>

        {/* Key metrics */}
        <div className="space-y-2 mt-2">
          {[
            ["Response Rate",  "Percentage of leads who replied to at least one message. Higher is better — aim for 30%+."],
            ["Booking Rate",   "Percentage of leads who booked a call. This is your bottom-line conversion metric."],
            ["Cost per Lead",  "Total messaging cost divided by number of leads contacted. Helps you measure ROI."],
            ["Avg. Reply Time","Average time between outbound message and lead reply. Faster replies usually mean warmer leads."],
          ].map(([metric, desc]) => (
            <div key={metric} className="rounded-lg bg-popover px-4 py-3">
              <p className="font-semibold text-xs mb-1">{metric}</p>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>

        {/* Pipeline funnel example */}
        <p className="font-semibold mt-4">Pipeline Funnel</p>
        <p>The campaign detail page shows a visual funnel of how leads move through stages:</p>
        <div className="mt-2 space-y-1">
          {[
            ["New",                "#6B7280", 120],
            ["Contacted",          "#7A73FF", 98],
            ["Responded",          "#3ACBDF", 54],
            ["Multiple Responses", "#31D35C", 32],
            ["Qualified",          "#AED62E", 18],
            ["Booked",             "#F7BF0E", 11],
          ].map(([label, hex, count]) => {
            const pct = ((count as number) / 120) * 100;
            return (
              <div key={label as string} className="flex items-center gap-2">
                <span className="text-[11px] font-medium text-muted-foreground w-[120px] shrink-0 text-right">{label}</span>
                <div className="flex-1 h-5 rounded-full bg-popover overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: hex as string }}
                  />
                </div>
                <span className="text-[11px] font-semibold tabular-nums w-8 text-right">{count}</span>
              </div>
            );
          })}
        </div>

        {/* Lead score distribution example */}
        <p className="font-semibold mt-4">Lead Score Distribution</p>
        <p>Score rings appear on lead cards, showing at a glance how warm each lead is:</p>
        <div className="flex items-center gap-4 mt-2 flex-wrap">
          {[
            { score: 15, status: "New", color: "#6B7280" },
            { score: 42, status: "Responded", color: "#3ACBDF" },
            { score: 78, status: "Qualified", color: "#AED62E" },
            { score: 95, status: "Booked", color: "#F7BF0E" },
          ].map(({ score, status, color }) => {
            const r = 18;
            const circ = 2 * Math.PI * r;
            const offset = circ - (score / 100) * circ;
            return (
              <div key={status} className="flex flex-col items-center gap-1">
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
                <span className="text-[10px] font-medium" style={{ color }}>{status}</span>
              </div>
            );
          })}
        </div>

        <Tip>
          Check campaign metrics weekly to spot trends. A sudden drop in response rate
          may indicate message fatigue — consider refreshing your first message copy.
        </Tip>
      </DocSection>

      {/* FAQ */}
      <DocSection
        id="sec-faq"
        icon={AlertCircle}
        title="Frequently Asked Questions"
        hidden={!sectionMatches[8]}
      >
        <div className="space-y-2.5">
          {[
            ["Can leads tell they're talking to an AI?",
              "The AI is trained to sound natural and human. It doesn't announce itself as a bot unless directly asked or unless your campaign script tells it to."],
            ["What happens if a lead says STOP?",
              "They're immediately added to the Do Not Contact list and will never be messaged again by any campaign in your account."],
            ["How fast does the AI reply?",
              "Within seconds to a few minutes, depending on message volume. A small delay is added to simulate natural human typing."],
            ["Can I message a lead manually?",
              "Yes — enable Manual Takeover on the lead. The AI pauses and you send messages directly from the Conversations page."],
            ["What if a lead doesn't respond?",
              "The system sends up to 3 follow-up messages (bumps) at scheduled intervals. After all bumps are exhausted, the lead is marked Completed and automation stops."],
            ["How do I export my leads?",
              "Open the Leads page and use the export button in the toolbar. You can export filtered results as CSV for use in spreadsheets or other tools."],
            ["Can I customize the AI's tone?",
              "Yes — each campaign can be linked to a Prompt Library entry that defines the AI's personality, language, and conversation style. Ask your account operator to set this up."],
            ["What happens when I change my business hours?",
              "The change takes effect immediately. Any leads currently queued for messages outside the new hours will wait until the next valid window. No messages are lost."],
            ["How are leads assigned to campaigns?",
              "Leads are assigned when they arrive through a webhook (the campaign_id is specified in the URL) or manually through the lead detail panel."],
          ].map(([question, answer]) => (
            <div key={question} className="rounded-lg bg-popover px-4 py-3">
              <p className="font-semibold text-xs mb-1">{question}</p>
              <p className="text-xs text-muted-foreground">{answer}</p>
            </div>
          ))}
        </div>
      </DocSection>
    </div>
  );
}

// ── What's New Sheet ──────────────────────────────────────────────────────────

function WhatsNewSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-[340px] flex flex-col gap-0 p-0">
        <SheetHeader className="px-5 pt-5 pb-4" style={{ borderBottom: "1px solid hsl(var(--foreground) / 0.06)" }}>
          <SheetTitle className="flex items-center gap-2 text-base font-bold">
            <Sparkles className="h-4 w-4 text-brand-indigo" />
            What's New
          </SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-auto px-5 py-5 space-y-6">
          {CHANGELOG.map(({ version, date, items }) => (
            <div key={version}>
              <div className="flex items-baseline gap-2 mb-2.5">
                <span className="text-[13px] font-bold text-foreground">{version}</span>
                <span className="text-[11px] text-muted-foreground">{date}</span>
              </div>
              <ul className="space-y-1.5">
                {items.map((item) => (
                  <li key={item} className="flex gap-2 text-[12px] text-foreground/80 leading-snug">
                    <span className="text-brand-indigo mt-0.5 shrink-0 font-bold">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function DocsPage() {
  const isMobile = useIsMobile();
  const isOperator = isOperatorRole();
  const [tab, setTab] = useState<"operator" | "client">(
    isOperator ? "operator" : "client"
  );
  const [search, setSearch] = useState("");
  const [whatsNew, setWhatsNew] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

  const currentToc = tab === "operator" ? OPERATOR_TOC : CLIENT_TOC;

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
                  <h1 className="text-2xl font-semibold font-heading text-foreground leading-tight">Documentation</h1>

                  {/* What's New — operator only */}
                  {isOperator && (
                    <button
                      onClick={() => setWhatsNew(true)}
                      className="group inline-flex items-center h-9 pl-[9px] rounded-full border text-[12px] font-medium overflow-hidden shrink-0 transition-[max-width,color,border-color] duration-200 max-w-9 hover:max-w-[120px] border-black/[0.125] dark:border-white/[0.125] text-foreground/60 hover:text-foreground"
                    >
                      <Sparkles className="h-4 w-4 shrink-0" />
                      <span className="whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">What's New</span>
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
                      Agency Docs
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
                      User Docs
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
                      placeholder="Search..."
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
                  {currentToc.map(({ id, label, icon: Icon }) => {
                    const isActive = activeSectionId === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => handleSectionClick(id)}
                        className={cn(
                          "w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-150",
                          isActive
                            ? "bg-highlight-selected text-foreground font-semibold"
                            : "bg-card hover:bg-card-hover text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span>{label}</span>
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
                      Agency
                    </button>
                    <button
                      onClick={() => { setTab("client"); setActiveSectionId(null); }}
                      className={cn(
                        "inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-[12px] font-medium whitespace-nowrap shrink-0 transition-colors duration-150",
                        tab === "client" ? "bg-[#FFF9D9] text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      User
                    </button>
                    <div className="w-px bg-border/30 shrink-0 my-1.5" />
                  </>
                )}
                {currentToc.map(({ id, label, icon: Icon }) => {
                  const isActive = activeSectionId === id;
                  return (
                    <button
                      key={id}
                      onClick={() => handleSectionClick(id)}
                      className={cn(
                        "inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-[12px] font-medium whitespace-nowrap shrink-0 transition-colors duration-150",
                        isActive ? "bg-[#FFF9D9] text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
          </nav>

          {/* ── Right content area ── */}
          <div
            className={cn(
              "flex-1 bg-card rounded-lg w-full overflow-y-auto",
              !isMobile && "ml-1.5"
            )}
            data-testid="docs-content"
          >
            <div className="pl-[17px] pr-3.5 pt-10 pb-3">
              <h2 className="text-2xl font-semibold font-heading text-foreground leading-tight">
                {tab === "operator" ? "Agency Documentation" : "User Documentation"}
              </h2>
            </div>
            <div className="px-6 pb-8 max-w-2xl">
              {tab === "operator"
                ? <OperatorManual search={search} />
                : <ClientGuide search={search} />
              }
            </div>
          </div>
        </div>
      </div>

      <WhatsNewSheet open={whatsNew} onClose={() => setWhatsNew(false)} />
    </CrmShell>
  );
}
