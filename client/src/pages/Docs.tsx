/**
 * DocsPage — In-app documentation for LeadAwaker.
 * Operator Manual (Admin/Operator) and Client Guide (Manager/Viewer).
 */

import { useState } from "react";
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
  Search,
  Copy,
  Check,
  Sparkles,
  X,
  ExternalLink,
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

const OPERATOR_TOC = [
  { id: "sec-setup",        label: "Setup" },
  { id: "sec-campaign",     label: "Campaign" },
  { id: "sec-lifecycle",    label: "Lifecycle" },
  { id: "sec-webhooks",     label: "Webhooks" },
  { id: "sec-instagram",    label: "Instagram" },
  { id: "sec-analytics",    label: "Analytics" },
  { id: "sec-troubleshoot", label: "Troubleshoot" },
];

const CLIENT_TOC = [
  { id: "sec-what",          label: "What is it?" },
  { id: "sec-leads",         label: "Your Leads" },
  { id: "sec-conversations", label: "Conversations" },
  { id: "sec-score",         label: "Lead Score" },
  { id: "sec-bookings",      label: "Bookings" },
  { id: "sec-faq",           label: "FAQ" },
];

// ── Shared sub-components ─────────────────────────────────────────────────────

function TocBar({ items }: { items: { id: string; label: string }[] }) {
  return (
    <div className="flex gap-1.5 flex-wrap pb-1">
      {items.map(({ id, label }) => (
        <button
          key={id}
          onClick={() =>
            document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
          }
          className="h-7 px-3 rounded-full inline-flex items-center text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-card border border-black/[0.08] transition-colors"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

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
    <div id={id} className="rounded-xl bg-card overflow-hidden scroll-mt-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-card transition-colors text-left"
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
          className="px-5 py-4 space-y-3 text-sm text-foreground/80 leading-relaxed"
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
    <div className="flex gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
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

// ── Operator Manual ───────────────────────────────────────────────────────────

function OperatorManual({ search }: { search: string }) {
  const q = search;

  const sectionMatches = [
    matchesSearch("account setup twilio api key business hours timezone daily send limit webhook secret", q),
    matchesSearch("campaign first message follow-up bumps active hours prompt library template channel sms whatsapp", q),
    matchesSearch("lead lifecycle status paused queued active completed dnd automation stop", q),
    matchesSearch("source adapters crm webhooks gohighlevel facebook hubspot generic intake url", q),
    matchesSearch("instagram dm contacts sync meta graph api business account access token profile", q),
    matchesSearch("analytics reporting lead scores campaign metrics automation logs response rate booking cost", q),
    matchesSearch("troubleshoot messages delivery language ai replies duplicate leads twilio sending status", q),
  ];
  const noResults = q.trim() !== "" && sectionMatches.every((m) => !m);

  return (
    <div className="max-w-2xl mx-auto space-y-2.5">
      {!q && <TocBar items={OPERATOR_TOC} />}
      {noResults && (
        <p className="text-sm text-muted-foreground text-center py-8">
          No sections match "<strong>{q}</strong>"
        </p>
      )}

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
          Set your <strong>business hours</strong> (start/end time) and{" "}
          <strong>timezone</strong>. The engine will never send messages outside these hours.
        </Step>
        <Step n={3}>
          Set a <strong>Daily Send Limit</strong> (default 500). This is the max messages
          the account can send per day across all campaigns.
        </Step>
        <Step n={4}>
          Copy the <strong>API Key</strong> (webhook_secret) from{" "}
          <SettingsLink>Settings</SettingsLink>. Paste this into your CRM integrations to
          authorize inbound leads.
        </Step>
        <Tip>
          The API key is shown once on generation. If lost, regenerate it — the old key
          will stop working immediately.
        </Tip>
      </DocSection>

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
        <Step n={2}>
          Write your <strong>First Message</strong> template. Use merge tags:{" "}
          <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{"{{first_name}}"}</code>,{" "}
          <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{"{{agent_name}}"}</code>,{" "}
          <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{"{{service}}"}</code>.
        </Step>
        <Step n={3}>
          Add up to 3 <strong>Follow-up bumps</strong>. Set the delay in hours for each
          (e.g., 24h, 48h, 72h). Bumps are sent only if the lead hasn't replied.
        </Step>
        <Step n={4}>
          Set <strong>Active Hours</strong>, <strong>Daily Lead Limit</strong>, and
          optionally link a <strong>Prompt Library entry</strong> to customize the AI's
          persona.
        </Step>
        <Step n={5}>
          Set campaign status to <strong>Active</strong> when you're ready to start sending.
        </Step>
        <Tip>
          Keep the first message short and personal. Avoid links in the first message —
          many SMS filters block them.
        </Tip>
      </DocSection>

      <DocSection
        id="sec-lifecycle"
        icon={Zap}
        title="3 · Lead Lifecycle & Statuses"
        hidden={!sectionMatches[2]}
      >
        <p>Leads move through these automation statuses automatically:</p>
        <div className="space-y-2 mt-1">
          {[
            ["paused",    "bg-gray-100 text-gray-600",      "Created but not yet assigned to a campaign. Safe — no messages sent."],
            ["queued",    "bg-blue-100 text-blue-700",      "Assigned to an active campaign. Campaign_launcher picks this up within 60 seconds."],
            ["active",    "bg-emerald-100 text-emerald-700","First message sent. Eligible for bumps and AI conversation replies."],
            ["completed", "bg-purple-100 text-purple-700",  "All bumps sent, booking confirmed, or lead exhausted. No further messages."],
            ["dnd",       "bg-red-100 text-red-700",        "Lead opted out (replied with STOP or similar). Never contacted again."],
          ].map(([label, color, desc]) => (
            <div key={label} className="flex gap-3 items-start">
              <Badge label={label} color={color} />
              <span className="text-xs text-muted-foreground">{desc}</span>
            </div>
          ))}
        </div>
        <Tip>
          To pause a specific lead manually, set their automation_status to "paused" in the
          lead detail panel. To pause a whole campaign, set campaign status to "Inactive".
        </Tip>
      </DocSection>

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
          <code className="bg-amber-100 px-1 rounded text-[11px] font-mono">YOUR_KEY</code>{" "}
          with the API key from <SettingsLink>Settings</SettingsLink>. Replace{" "}
          <code className="bg-amber-100 px-1 rounded text-[11px] font-mono">ID</code>{" "}
          with the campaign ID from the campaign detail page.
        </Tip>
      </DocSection>

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
          lead with status <Badge label="paused" color="bg-gray-100 text-gray-600" />.
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

      <DocSection
        id="sec-troubleshoot"
        icon={Wrench}
        title="7 · Troubleshoot"
        hidden={!sectionMatches[6]}
      >
        <div className="space-y-2.5">
          {[
            ["Lead not receiving messages",    "Check: campaign status = Active, lead automation_status = queued, business hours not blocking, daily limit not reached. Check Automation Logs for the lead."],
            ["Wrong language in replies",      "Ensure the lead's language field is set. The AI uses this to reply in the correct language."],
            ["Lead stuck in 'sending' status", "This means Twilio failed to send the first message. Manually reset to 'queued' in the DB and check Twilio credentials."],
            ["Duplicate leads",                "Phone-based dedup is per-account. The same phone cannot be in the same account twice. Different accounts can have the same phone."],
            ["AI replies stopped",             "Check Automation Logs for ai_conversation errors. Usually means OpenAI API key issue or rate limit."],
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

// ── Client Guide ──────────────────────────────────────────────────────────────

function ClientGuide({ search }: { search: string }) {
  const q = search;

  const sectionMatches = [
    matchesSearch("what is leadawaker ai powered whatsapp sms lead follow-up autopilot book calls", q),
    matchesSearch("leads status new contacted responded qualified call booked not interested funnel", q),
    matchesSearch("conversations messages inbound outbound ai label manual takeover chat history", q),
    matchesSearch("lead score 0 100 funnel stage engagement recency warm intent priority", q),
    matchesSearch("bookings calendar call booked appointment confirmed status", q),
    matchesSearch("faq frequently asked questions stop bot manual message bump reply does not respond", q),
  ];
  const noResults = q.trim() !== "" && sectionMatches.every((m) => !m);

  return (
    <div className="max-w-2xl mx-auto space-y-2.5">
      {!q && <TocBar items={CLIENT_TOC} />}
      {noResults && (
        <p className="text-sm text-muted-foreground text-center py-8">
          No sections match "<strong>{q}</strong>"
        </p>
      )}

      <DocSection
        id="sec-what"
        icon={BookOpen}
        title="What is LeadAwaker?"
        hidden={!sectionMatches[0]}
      >
        <p>
          LeadAwaker is an AI-powered lead follow-up system. When someone expresses interest
          in your service (fills a form, clicks an ad, etc.), LeadAwaker automatically reaches
          out via SMS or WhatsApp, nurtures the conversation, and books calls — all on autopilot.
        </p>
        <p>
          The AI agent replies to leads in real time, handles objections, and knows when to
          stop and let a human take over.
        </p>
      </DocSection>

      <DocSection
        id="sec-leads"
        icon={Users}
        title="Understanding Your Leads"
        hidden={!sectionMatches[1]}
      >
        <p>
          Each lead goes through a journey from first contact to booking. Here's what the
          status indicators mean:
        </p>
        <div className="space-y-2 mt-1">
          {[
            ["New",           "bg-gray-100 text-gray-600",      "Lead just arrived, not yet contacted."],
            ["Contacted",     "bg-blue-100 text-blue-700",      "First message sent. Waiting for a reply."],
            ["Responded",     "bg-cyan-100 text-cyan-700",      "Lead replied at least once. AI is in conversation."],
            ["Qualified",     "bg-amber-100 text-amber-700",    "Lead has shown interest and is being guided to book a call."],
            ["Call Booked",   "bg-emerald-100 text-emerald-700","Appointment confirmed!"],
            ["Not Interested","bg-red-100 text-red-700",        "Lead opted out or was not a fit."],
          ].map(([label, color, desc]) => (
            <div key={label} className="flex gap-3 items-start">
              <Badge label={label} color={color} />
              <span className="text-xs text-muted-foreground">{desc}</span>
            </div>
          ))}
        </div>
      </DocSection>

      <DocSection
        id="sec-conversations"
        icon={MessageSquare}
        title="Reading Conversations"
        hidden={!sectionMatches[2]}
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
          If you want to take over the conversation manually, toggle{" "}
          <strong>Manual Takeover</strong> on the lead detail. The AI will stop replying
          and you can message freely.
        </Step>
      </DocSection>

      <DocSection
        id="sec-score"
        icon={Star}
        title="Lead Score"
        hidden={!sectionMatches[3]}
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
        <Tip>
          Leads with a score above 70 are your warmest prospects. Prioritize these for
          manual outreach.
        </Tip>
      </DocSection>

      <DocSection
        id="sec-bookings"
        icon={CalendarCheck}
        title="Bookings"
        hidden={!sectionMatches[4]}
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

      <DocSection
        id="sec-faq"
        icon={AlertCircle}
        title="Frequently Asked Questions"
        hidden={!sectionMatches[5]}
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
  const isOperator = isOperatorRole();
  const [tab, setTab] = useState<"operator" | "client">(
    isOperator ? "operator" : "client"
  );
  const [search, setSearch] = useState("");
  const [whatsNew, setWhatsNew] = useState(false);

  return (
    <CrmShell>
      <div className="flex flex-col h-full p-3">
        <div className="flex-1 flex flex-col bg-muted rounded-xl overflow-hidden min-h-0">

          {/* Header */}
          <div
            className="flex-shrink-0 px-5 pt-5 pb-0"
            style={{ borderBottom: "1px solid hsl(var(--foreground) / 0.06)" }}
          >
            {/* Title row */}
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="h-5 w-5 text-brand-indigo shrink-0" />
              <h1 className="text-lg font-bold tracking-tight flex-1">Documentation</h1>

              {/* Search input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search…"
                  className="h-9 pl-9 pr-8 rounded-full bg-card border border-black/[0.125] text-[13px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-brand-indigo/40 w-40 transition-[border-color]"
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

              {/* What's New — operator only */}
              {isOperator && (
                <button
                  onClick={() => setWhatsNew(true)}
                  className="group inline-flex items-center h-9 pl-[9px] rounded-full border text-[12px] font-medium overflow-hidden shrink-0 transition-[max-width,color,border-color] duration-200 max-w-9 hover:max-w-[120px] border-black/[0.125] text-foreground/60 hover:text-foreground"
                >
                  <Sparkles className="h-4 w-4 shrink-0" />
                  <span className="whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">What's New</span>
                </button>
              )}
            </div>

            {/* Pill tabs — only shown when operator (both tabs available) */}
            {isOperator && (
              <div className="flex gap-1 pb-3">
                <button
                  onClick={() => setTab("operator")}
                  className={cn(
                    "h-9 px-4 rounded-full inline-flex items-center text-[13px] font-medium transition-colors",
                    tab === "operator"
                      ? "bg-card border border-black/[0.125] text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-card/60 border border-transparent"
                  )}
                >
                  Operator Manual
                </button>
                <button
                  onClick={() => setTab("client")}
                  className={cn(
                    "h-9 px-4 rounded-full inline-flex items-center text-[13px] font-medium transition-colors",
                    tab === "client"
                      ? "bg-card border border-black/[0.125] text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-card/60 border border-transparent"
                  )}
                >
                  Client Guide
                </button>
              </div>
            )}
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-auto px-5 py-5">
            {tab === "operator"
              ? <OperatorManual search={search} />
              : <ClientGuide search={search} />
            }
          </div>
        </div>
      </div>

      <WhatsNewSheet open={whatsNew} onClose={() => setWhatsNew(false)} />
    </CrmShell>
  );
}
