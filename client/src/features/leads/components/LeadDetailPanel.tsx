import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { apiFetch } from "@/lib/apiUtils";
import { cn } from "@/lib/utils";
import {
  Phone,
  Mail,
  User,
  MessageSquare,
  Calendar,
  Tag,
  Activity,
  Bot,
  StickyNote,
  ExternalLink,
  Loader2,
  Globe,
  ArrowUpCircle,
  BarChart2,
} from "lucide-react";
import { useLocation } from "wouter";

// ── Types ──────────────────────────────────────────────────────────────────

export interface LeadDetailPanelProps {
  lead: Record<string, any> | null;
  open: boolean;
  onClose: () => void;
}

interface Interaction {
  id: number;
  lead_id?: number;
  Leads_id?: number;
  direction: string;
  content: string;
  created_at?: string;
  type?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleDateString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return s;
  }
}

function fmtDateTime(s: string | null | undefined): string {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return s;
  }
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  New: { bg: "bg-blue-500/15", text: "text-blue-600 dark:text-blue-400" },
  Contacted: { bg: "bg-indigo-500/15", text: "text-indigo-600 dark:text-indigo-400" },
  Responded: { bg: "bg-violet-500/15", text: "text-violet-600 dark:text-violet-400" },
  "Multiple Responses": { bg: "bg-purple-500/15", text: "text-purple-600 dark:text-purple-400" },
  Qualified: { bg: "bg-emerald-500/15", text: "text-emerald-600 dark:text-emerald-400" },
  Booked: { bg: "bg-amber-400/20", text: "text-brand-yellow font-bold" },
  Lost: { bg: "bg-red-500/15", text: "text-red-600 dark:text-red-400" },
  DND: { bg: "bg-zinc-500/15", text: "text-zinc-600 dark:text-zinc-400" },
};

const PRIORITY_COLORS: Record<string, { bg: string; text: string; ring: string }> = {
  High: { bg: "bg-red-500/15", text: "text-red-600 dark:text-red-400", ring: "ring-1 ring-red-500/30" },
  Medium: { bg: "bg-amber-400/20", text: "text-amber-600 dark:text-amber-400", ring: "ring-1 ring-amber-400/30" },
  Low: { bg: "bg-emerald-500/15", text: "text-emerald-600 dark:text-emerald-400", ring: "ring-1 ring-emerald-500/30" },
};

function StatusBadge({ label }: { label: string }) {
  const colors = STATUS_COLORS[label] ?? { bg: "bg-muted", text: "text-muted-foreground" };
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold",
        colors.bg,
        colors.text
      )}
    >
      {label}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const colors = PRIORITY_COLORS[priority] ?? {
    bg: "bg-muted",
    text: "text-muted-foreground",
    ring: "ring-1 ring-border/30",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold",
        colors.bg,
        colors.text,
        colors.ring
      )}
      data-testid="lead-detail-priority-badge"
      data-priority={priority}
    >
      <ArrowUpCircle className="h-3 w-3 shrink-0" />
      {priority}
    </span>
  );
}

function InfoRow({
  icon,
  label,
  value,
  mono = false,
}: {
  icon?: React.ReactNode;
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 border-b border-border/30 last:border-0">
      <div className="flex items-center gap-1.5 shrink-0">
        {icon && <span className="text-muted-foreground/60">{icon}</span>}
        <span className="text-[11px] text-muted-foreground">{label}</span>
      </div>
      <span
        className={cn(
          "text-[12px] text-foreground text-right break-words max-w-[58%]",
          mono && "font-mono text-[11px]"
        )}
      >
        {value || "—"}
      </span>
    </div>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-2 mt-4 first:mt-0">
      <span className="text-muted-foreground">{icon}</span>
      <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {title}
      </h3>
    </div>
  );
}

// ── Score Gauge ────────────────────────────────────────────────────────────

function scoreColor(value: number): { bar: string; text: string } {
  if (value < 30) return { bar: "bg-red-500", text: "text-red-600 dark:text-red-400" };
  if (value <= 70) return { bar: "bg-amber-400", text: "text-amber-600 dark:text-amber-400" };
  return { bar: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" };
}

function ScoreGauge({
  label,
  value,
  testId,
}: {
  label: string;
  value: number | null | undefined;
  testId: string;
}) {
  const numVal = typeof value === "number" ? Math.max(0, Math.min(100, value)) : null;
  const colors = numVal !== null ? scoreColor(numVal) : { bar: "bg-muted", text: "text-muted-foreground" };

  return (
    <div className="flex flex-col gap-1" data-testid={testId}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        <span className={cn("text-[12px] font-bold tabular-nums", colors.text)} data-testid={`${testId}-value`}>
          {numVal !== null ? numVal : "—"}
          {numVal !== null && <span className="text-[10px] font-normal text-muted-foreground ml-0.5">/100</span>}
        </span>
      </div>
      {/* Track */}
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden" data-testid={`${testId}-track`}>
        <div
          className={cn("h-full rounded-full transition-all duration-500", colors.bar)}
          style={{ width: numVal !== null ? `${numVal}%` : "0%" }}
          data-testid={`${testId}-bar`}
        />
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────

export function LeadDetailPanel({ lead, open, onClose }: LeadDetailPanelProps) {
  const [, setLocation] = useLocation();
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loadingInteractions, setLoadingInteractions] = useState(false);

  const leadId = lead?.Id || lead?.id;

  // Fetch interactions when panel opens with a lead
  useEffect(() => {
    if (!open || !leadId) {
      setInteractions([]);
      return;
    }

    let cancelled = false;
    setLoadingInteractions(true);

    apiFetch(`/api/interactions?leadId=${leadId}&limit=5`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data) ? data : data?.list || data?.data || [];
        setInteractions(list.slice(0, 5));
      })
      .catch(() => {
        if (!cancelled) setInteractions([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingInteractions(false);
      });

    return () => { cancelled = true; };
  }, [open, leadId]);

  if (!lead) return null;

  const fullName = lead.full_name || [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "Unknown";
  const convStatus = lead.conversion_status || lead.Conversion_Status || "";
  const autoStatus = lead.automation_status || lead.Automation_Status || "";
  const email = lead.email || lead.Email || "";
  const source = lead.Source || lead.source || lead.inquiries_source || "";
  const priority = lead.priority || lead.Priority || "";
  const isAgency = window.location.pathname.startsWith("/agency");

  const handleViewFull = () => {
    onClose();
    const path = isAgency ? `/agency/contacts/${leadId}` : `/subaccount/contacts/${leadId}`;
    setLocation(path);
  };

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent
        side="right"
        className="w-[420px] sm:max-w-[420px] p-0 flex flex-col overflow-hidden"
        data-testid="lead-detail-panel"
      >
        {/* Header */}
        <SheetHeader
          className="px-5 pt-5 pb-4 border-b border-border shrink-0"
          data-testid="lead-info-header"
        >
          {/* Row 1: label + status badge */}
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Lead Detail
            </div>
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              {convStatus && <StatusBadge label={convStatus} />}
              {priority && <PriorityBadge priority={priority} />}
            </div>
          </div>

          {/* Row 2: name (most prominent) */}
          <SheetTitle
            className="text-[18px] font-bold leading-tight truncate"
            data-testid="lead-detail-panel-name"
          >
            {fullName}
          </SheetTitle>

          {/* Row 3: contact meta — phone, email, source */}
          <div className="mt-2 flex flex-col gap-1" data-testid="lead-header-meta">
            {lead.phone && (
              <div
                className="flex items-center gap-1.5 text-[12px] text-muted-foreground"
                data-testid="lead-detail-panel-phone"
              >
                <Phone className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                <span className="font-mono">{lead.phone}</span>
              </div>
            )}
            {email && (
              <div
                className="flex items-center gap-1.5 text-[12px] text-muted-foreground"
                data-testid="lead-detail-panel-email"
              >
                <Mail className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                <span className="truncate">{email}</span>
              </div>
            )}
            {source && (
              <div
                className="flex items-center gap-1.5 text-[12px] text-muted-foreground"
                data-testid="lead-detail-panel-source"
              >
                <Globe className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                <span>Source: <span className="text-foreground/80">{source}</span></span>
              </div>
            )}
            {autoStatus && (
              <SheetDescription className="text-[11px] mt-0.5">
                {autoStatus}
              </SheetDescription>
            )}
          </div>

          {/* Row 4: View full page */}
          <button
            onClick={handleViewFull}
            className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-brand-blue hover:text-brand-blue/80 font-medium transition-colors"
            data-testid="lead-detail-panel-view-full"
          >
            <ExternalLink className="h-3 w-3" />
            Open full contact page
          </button>
        </SheetHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4" data-testid="lead-detail-panel-body">

          {/* Contact Info */}
          <SectionTitle icon={<User className="h-3.5 w-3.5" />} title="Contact" />
          <div className="rounded-xl border border-border/40 bg-muted/20 px-3 py-1.5">
            <InfoRow
              icon={<User className="h-3 w-3" />}
              label="Name"
              value={fullName}
            />
            <InfoRow
              icon={<Phone className="h-3 w-3" />}
              label="Phone"
              value={lead.phone}
              mono
            />
            <InfoRow
              icon={<Mail className="h-3 w-3" />}
              label="Email"
              value={lead.email}
            />
            <InfoRow
              icon={<Activity className="h-3 w-3" />}
              label="Priority"
              value={lead.priority}
            />
            <InfoRow
              label="Language"
              value={lead.language}
            />
          </div>

          {/* Lead Scores */}
          {(lead.lead_score != null || lead.engagement_score != null || lead.activity_score != null) && (
            <>
              <SectionTitle icon={<BarChart2 className="h-3.5 w-3.5" />} title="Scores" />
              <div
                className="rounded-xl border border-border/40 bg-muted/20 px-3 py-3 flex flex-col gap-3"
                data-testid="lead-score-gauges"
              >
                <ScoreGauge
                  label="Lead Score"
                  value={lead.lead_score}
                  testId="lead-score-gauge-overall"
                />
                <ScoreGauge
                  label="Engagement"
                  value={lead.engagement_score}
                  testId="lead-score-gauge-engagement"
                />
                <ScoreGauge
                  label="Activity"
                  value={lead.activity_score}
                  testId="lead-score-gauge-activity"
                />
              </div>
            </>
          )}

          {/* Status */}
          <SectionTitle icon={<Activity className="h-3.5 w-3.5" />} title="Status" />
          <div className="rounded-xl border border-border/40 bg-muted/20 px-3 py-1.5">
            <InfoRow label="Pipeline Stage" value={convStatus && <StatusBadge label={convStatus} />} />
            <InfoRow label="Automation" value={autoStatus} />
            <InfoRow label="Bump Stage" value={lead.current_bump_stage} />
            <InfoRow label="Manual Takeover" value={lead.manual_takeover ? "Yes" : lead.manual_takeover === false ? "No" : undefined} />
            <InfoRow label="Opted Out" value={lead.opted_out ? "Yes" : lead.opted_out === false ? "No" : undefined} />
          </div>

          {/* Activity */}
          <SectionTitle icon={<MessageSquare className="h-3.5 w-3.5" />} title="Activity" />
          <div className="rounded-xl border border-border/40 bg-muted/20 px-3 py-1.5">
            <InfoRow label="Last Interaction" value={fmtDateTime(lead.last_interaction_at)} />
            <InfoRow label="Last Sent" value={fmtDateTime(lead.last_message_sent_at)} />
            <InfoRow label="Last Received" value={fmtDateTime(lead.last_message_received_at)} />
            <InfoRow label="Sent Count" value={lead.message_count_sent} />
            <InfoRow label="Received Count" value={lead.message_count_received} />
            <InfoRow label="First Contacted" value={fmtDate(lead.first_message_sent_at)} />
            <InfoRow label="Next Action" value={fmtDateTime(lead.next_action_at)} />
          </div>

          {/* Booking */}
          {(lead.booked_call_date || lead.booking_confirmed_at) && (
            <>
              <SectionTitle icon={<Calendar className="h-3.5 w-3.5" />} title="Booking" />
              <div className="rounded-xl border border-border/40 bg-muted/20 px-3 py-1.5">
                <InfoRow label="Call Date" value={fmtDate(lead.booked_call_date)} />
                <InfoRow label="Confirmed At" value={fmtDateTime(lead.booking_confirmed_at)} />
                <InfoRow label="No Show" value={lead.no_show ? "Yes" : lead.no_show === false ? "No" : undefined} />
              </div>
            </>
          )}

          {/* AI */}
          {(lead.ai_sentiment || lead.ai_memory) && (
            <>
              <SectionTitle icon={<Bot className="h-3.5 w-3.5" />} title="AI Insights" />
              <div className="rounded-xl border border-border/40 bg-muted/20 px-3 py-1.5">
                <InfoRow label="Sentiment" value={lead.ai_sentiment} />
                {lead.ai_memory && (
                  <div className="py-1.5 border-b border-border/30 last:border-0">
                    <div className="text-[11px] text-muted-foreground mb-1">Memory</div>
                    <p className="text-[12px] text-foreground leading-relaxed">{lead.ai_memory}</p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Notes */}
          {lead.notes && (
            <>
              <SectionTitle icon={<StickyNote className="h-3.5 w-3.5" />} title="Notes" />
              <div className="rounded-xl border border-border/40 bg-muted/20 p-3">
                <p className="text-[12px] text-foreground leading-relaxed whitespace-pre-wrap" data-testid="lead-detail-panel-notes">
                  {lead.notes}
                </p>
              </div>
            </>
          )}

          {/* Recent Interactions */}
          <SectionTitle icon={<MessageSquare className="h-3.5 w-3.5" />} title="Recent Messages" />
          <div
            className="rounded-xl border border-border/40 bg-muted/20 overflow-hidden"
            data-testid="lead-detail-panel-interactions"
          >
            {loadingInteractions ? (
              <div className="flex items-center justify-center py-6 gap-2 text-muted-foreground text-[12px]">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading…
              </div>
            ) : interactions.length === 0 ? (
              <div className="py-4 px-3 text-[12px] text-muted-foreground text-center" data-testid="lead-detail-panel-no-interactions">
                No recent messages
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                {interactions.map((m) => {
                  const outbound = String(m.direction || "").toLowerCase() === "outbound";
                  return (
                    <div key={m.id} className="px-3 py-2.5" data-testid={`lead-detail-interaction-${m.id}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={cn(
                            "text-[10px] font-semibold uppercase tracking-wide",
                            outbound ? "text-brand-blue" : "text-emerald-600 dark:text-emerald-400"
                          )}
                        >
                          {outbound ? "Outbound" : "Inbound"}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {fmtDateTime(m.created_at)}
                        </span>
                      </div>
                      <p className="text-[12px] text-foreground leading-snug line-clamp-2">
                        {m.content || "—"}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Campaign / Account */}
          <SectionTitle icon={<Tag className="h-3.5 w-3.5" />} title="Assignment" />
          <div className="rounded-xl border border-border/40 bg-muted/20 px-3 py-1.5 mb-6">
            <InfoRow label="Account" value={lead.Account || lead.account_id} />
            <InfoRow label="Campaign" value={lead.Campaign || lead.campaign_id} />
            <InfoRow label="Created" value={fmtDate(lead.created_at)} />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
