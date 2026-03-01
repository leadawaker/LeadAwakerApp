/**
 * DocsPage — In-app documentation for LeadAwaker.
 * Operator Manual (Admin/Operator) and Client Guide (Manager/Viewer).
 * Role is read from localStorage — same pattern as app.tsx.
 */

import { useState } from "react";
import { CrmShell } from "@/components/crm/CrmShell";
import { cn } from "@/lib/utils";
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
} from "lucide-react";

// ── Role detection ────────────────────────────────────────────────────────────

function isOperatorRole(): boolean {
  const role = localStorage.getItem("leadawaker_user_role") || "Viewer";
  return role === "Admin" || role === "Operator";
}

// ── Shared components ─────────────────────────────────────────────────────────

function DocSection({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-xl bg-card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-[#F8F8F8] transition-colors text-left"
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
    <span
      className={cn(
        "inline-block px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0",
        color
      )}
    >
      {label}
    </span>
  );
}

// ── Operator Manual ───────────────────────────────────────────────────────────

function OperatorManual() {
  return (
    <div className="max-w-2xl mx-auto space-y-2.5">
      <p className="text-sm text-muted-foreground px-1 pb-1">
        Everything you need to run LeadAwaker campaigns end-to-end. Expand each
        section to read.
      </p>

      <DocSection icon={Settings} title="1 · Account Setup">
        <Step n={1}>
          Go to <strong>Settings → Integrations</strong>. Enter your{" "}
          <strong>Twilio Account SID</strong>, <strong>Auth Token</strong>, and
          the <strong>From Number</strong> (or Messaging Service SID) for this
          account.
        </Step>
        <Step n={2}>
          Set your <strong>business hours</strong> (start/end time) and{" "}
          <strong>timezone</strong>. The engine will never send messages outside
          these hours.
        </Step>
        <Step n={3}>
          Set a <strong>Daily Send Limit</strong> (default 500). This is the
          max messages the account can send per day across all campaigns.
        </Step>
        <Step n={4}>
          Copy the <strong>API Key</strong> (webhook_secret) from Settings. You
          will paste this into your CRM integrations to authorize inbound leads.
        </Step>
        <Tip>
          The API key is shown once on generation. If lost, regenerate it — old
          key will stop working immediately.
        </Tip>
      </DocSection>

      <DocSection icon={Megaphone} title="2 · Creating a Campaign">
        <Step n={1}>
          Go to <strong>Campaigns → New Campaign</strong>. Give it a name and
          select the <strong>channel</strong> (SMS or WhatsApp).
        </Step>
        <Step n={2}>
          Write your <strong>First Message</strong> template. Use merge tags:{" "}
          <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{"{{first_name}}"}</code>,{" "}
          <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{"{{agent_name}}"}</code>,{" "}
          <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{"{{service}}"}</code>.
        </Step>
        <Step n={3}>
          Add up to 3 <strong>Follow-up bumps</strong>. Set the delay in hours
          for each (e.g., 24h, 48h, 72h). Bumps are sent only if the lead
          hasn't replied.
        </Step>
        <Step n={4}>
          Set <strong>Active Hours</strong>, <strong>Daily Lead Limit</strong>,
          and optionally link a <strong>Prompt Library entry</strong> to
          customize the AI's persona.
        </Step>
        <Step n={5}>
          Set campaign status to <strong>Active</strong> when you're ready to
          start sending.
        </Step>
        <Tip>
          Keep the first message short and personal. Avoid links in the first
          message — many SMS filters block them.
        </Tip>
      </DocSection>

      <DocSection icon={Zap} title="3 · Lead Lifecycle & Statuses">
        <p>Leads move through these automation statuses automatically:</p>
        <div className="space-y-2 mt-1">
          {[
            ["paused", "bg-gray-100 text-gray-600", "Created but not yet assigned to a campaign. Safe — no messages sent."],
            ["queued", "bg-blue-100 text-blue-700", "Assigned to an active campaign. Campaign_launcher picks this up within 60 seconds."],
            ["active", "bg-emerald-100 text-emerald-700", "First message sent. Eligible for bumps and AI conversation replies."],
            ["completed", "bg-purple-100 text-purple-700", "All bumps sent, booking confirmed, or lead exhausted. No further messages."],
            ["dnd", "bg-red-100 text-red-700", "Lead opted out (replied with STOP or similar). Never contacted again."],
          ].map(([label, color, desc]) => (
            <div key={label} className="flex gap-3 items-start">
              <Badge label={label} color={color} />
              <span className="text-xs text-muted-foreground">{desc}</span>
            </div>
          ))}
        </div>
        <Tip>
          To pause a specific lead manually, set their automation_status to
          "paused" in the lead detail panel. To pause a whole campaign, set
          campaign status to "Inactive".
        </Tip>
      </DocSection>

      <DocSection icon={Globe} title="4 · Source Adapters (CRM Webhooks)">
        <p>
          Each CRM has a dedicated intake URL. Paste the URL into your CRM's
          webhook settings. Leads are automatically created and queued.
        </p>
        <div className="space-y-2.5 mt-1">
          {[
            ["GoHighLevel", "POST", "/api/leads/intake/ghl?key=YOUR_KEY&campaign_id=ID"],
            ["Facebook Lead Ads", "GET+POST", "/api/leads/intake/facebook?key=YOUR_KEY&campaign_id=ID"],
            ["HubSpot", "POST", "/api/leads/intake/hubspot?key=YOUR_KEY&campaign_id=ID"],
            ["Generic / Custom", "POST", "/api/leads/intake"],
          ].map(([crm, method, path]) => (
            <div key={crm} className="rounded-lg bg-popover px-4 py-3">
              <p className="font-medium text-xs mb-1">{crm}</p>
              <code className="text-[11px] text-muted-foreground break-all font-mono">
                {method} https://webhooks.leadawaker.com{path}
              </code>
            </div>
          ))}
        </div>
        <Tip>
          Replace YOUR_KEY with the API key from Settings. Replace ID with the
          campaign ID from the campaign detail page.
        </Tip>
      </DocSection>

      <DocSection icon={BarChart2} title="5 · Analytics & Reporting">
        <Step n={1}>
          <strong>Lead Scores</strong> (0–100) are recalculated every 30
          minutes. They combine funnel stage (40%), engagement (30%), and
          activity recency (30%).
        </Step>
        <Step n={2}>
          <strong>Campaign Metrics</strong> (response rate, booking rate, cost
          per lead) are snapshotted daily at midnight. Check them under
          Reports.
        </Step>
        <Step n={3}>
          <strong>Automation Logs</strong> show every step the engine took for
          every lead — useful for debugging missed sends or unexpected behavior.
        </Step>
        <Tip>
          A lead score above 70 = high intent. Prioritize manual follow-up on
          these.
        </Tip>
      </DocSection>

      <DocSection icon={Wrench} title="6 · Troubleshooting">
        <div className="space-y-2.5">
          {[
            ["Lead not receiving messages", "Check: campaign status = Active, lead automation_status = queued, business hours not blocking, daily limit not reached. Check Automation Logs for the lead."],
            ["Wrong language in replies", "Ensure the lead's language field is set. The AI uses this to reply in the correct language."],
            ["Lead stuck in 'sending' status", "This means Twilio failed to send the first message. Manually reset to 'queued' in the DB and check Twilio credentials."],
            ["Duplicate leads", "Phone-based dedup is per-account. The same phone cannot be in the same account twice. Different accounts can have the same phone."],
            ["AI replies stopped", "Check Automation Logs for ai_conversation errors. Usually means OpenAI API key issue or rate limit."],
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

function ClientGuide() {
  return (
    <div className="max-w-2xl mx-auto space-y-2.5">
      <p className="text-sm text-muted-foreground px-1 pb-1">
        Your guide to understanding LeadAwaker — how your leads are handled and
        what each status means.
      </p>

      <DocSection icon={BookOpen} title="What is LeadAwaker?">
        <p>
          LeadAwaker is an AI-powered lead follow-up system. When someone
          expresses interest in your service (fills a form, clicks an ad, etc.),
          LeadAwaker automatically reaches out via SMS or WhatsApp, nurtures the
          conversation, and books calls — all on autopilot.
        </p>
        <p>
          The AI agent replies to leads in real time, handles objections, and
          knows when to stop and let a human take over.
        </p>
      </DocSection>

      <DocSection icon={Users} title="Understanding Your Leads">
        <p>
          Each lead goes through a journey from first contact to booking. Here's
          what the status indicators mean:
        </p>
        <div className="space-y-2 mt-1">
          {[
            ["New", "bg-gray-100 text-gray-600", "Lead just arrived, not yet contacted."],
            ["Contacted", "bg-blue-100 text-blue-700", "First message sent. Waiting for a reply."],
            ["Responded", "bg-cyan-100 text-cyan-700", "Lead replied at least once. AI is in conversation."],
            ["Qualified", "bg-amber-100 text-amber-700", "Lead has shown interest and is being guided to book a call."],
            ["Call Booked", "bg-emerald-100 text-emerald-700", "Appointment confirmed!"],
            ["Not Interested", "bg-red-100 text-red-700", "Lead opted out or was not a fit."],
          ].map(([label, color, desc]) => (
            <div key={label} className="flex gap-3 items-start">
              <Badge label={label} color={color} />
              <span className="text-xs text-muted-foreground">{desc}</span>
            </div>
          ))}
        </div>
      </DocSection>

      <DocSection icon={MessageSquare} title="Reading Conversations">
        <Step n={1}>
          Open the <strong>Leads</strong> page and click any lead to view their
          full conversation history.
        </Step>
        <Step n={2}>
          Messages shown on the <strong>right side</strong> are outbound
          (sent by the AI or your team). Messages on the <strong>left</strong>{" "}
          are inbound (from the lead).
        </Step>
        <Step n={3}>
          Look for the <strong>AI label</strong> on messages — these were
          generated automatically. Messages without this label were sent
          manually.
        </Step>
        <Step n={4}>
          If you want to take over the conversation manually, toggle{" "}
          <strong>Manual Takeover</strong> on the lead detail. The AI will
          stop replying and you can message freely.
        </Step>
      </DocSection>

      <DocSection icon={Star} title="Lead Score">
        <p>
          Every lead has a <strong>Lead Score</strong> from 0 to 100 that
          estimates how likely they are to book. It's calculated from:
        </p>
        <ul className="list-disc pl-4 space-y-1 mt-1">
          <li>Their current funnel stage (40%)</li>
          <li>How many times they've replied and how recently (30%)</li>
          <li>Recency of their last activity (30%)</li>
        </ul>
        <Tip>
          Leads with a score above 70 are your warmest prospects. Prioritize
          these for manual outreach.
        </Tip>
      </DocSection>

      <DocSection icon={CalendarCheck} title="Bookings">
        <p>
          When the AI detects a booking confirmation in the conversation, the
          lead is automatically moved to <strong>Call Booked</strong> status.
          The booking date and time are saved to the lead record.
        </p>
        <p>
          You can view all upcoming bookings on the <strong>Calendar</strong>{" "}
          page.
        </p>
        <Tip>
          If a booking appears incorrect or was auto-detected by mistake,
          manually update the lead status from the detail panel.
        </Tip>
      </DocSection>

      <DocSection icon={AlertCircle} title="Frequently Asked Questions">
        <div className="space-y-2.5">
          {[
            ["Can leads tell they're talking to an AI?", "The AI is trained to sound natural and human. It doesn't announce itself as a bot unless directly asked or unless your campaign script tells it to."],
            ["What happens if a lead says STOP?", "They're immediately added to the Do Not Contact list and will never be messaged again by any campaign in your account."],
            ["How fast does the AI reply?", "Within seconds to a few minutes, depending on message volume. A small delay is added to simulate natural human typing."],
            ["Can I message a lead manually?", "Yes — enable Manual Takeover on the lead. The AI pauses and you send messages directly from the Conversations page."],
            ["What if a lead doesn't respond?", "The system sends up to 3 follow-up messages (bumps) at scheduled intervals. After all bumps are exhausted, the lead is marked Completed and automation stops."],
          ].map(([q, a]) => (
            <div key={q} className="rounded-lg bg-popover px-4 py-3">
              <p className="font-semibold text-xs mb-1">{q}</p>
              <p className="text-xs text-muted-foreground">{a}</p>
            </div>
          ))}
        </div>
      </DocSection>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function DocsPage() {
  const isOperator = isOperatorRole();
  const [tab, setTab] = useState<"operator" | "client">(
    isOperator ? "operator" : "client"
  );

  return (
    <CrmShell>
      <div className="flex flex-col h-full p-3">
        <div className="flex-1 flex flex-col bg-muted rounded-xl overflow-hidden min-h-0">
          {/* Header */}
          <div className="flex-shrink-0 px-5 pt-5 pb-0">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="h-5 w-5 text-brand-indigo" />
              <h1 className="text-lg font-bold tracking-tight">Documentation</h1>
            </div>

            {/* Pill tabs */}
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
          <div className="flex-1 overflow-auto px-5 py-4">
            {tab === "operator" ? <OperatorManual /> : <ClientGuide />}
          </div>
        </div>
      </div>
    </CrmShell>
  );
}
