import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  Phone,
  Mail,
  User,
  Tag,
  Activity,
  MessageSquare,
  Calendar,
  Smile,
  Meh,
  Frown,
  Copy,
  Check,
  Clock,
  Users,
} from "lucide-react";

interface LeadsListViewProps {
  leads: Record<string, any>[];
  loading?: boolean;
}

/* ─── Status colors ─── */
const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  New: { bg: "bg-blue-500/15", text: "text-blue-600 dark:text-blue-400", dot: "bg-blue-500" },
  Contacted: { bg: "bg-indigo-500/15", text: "text-indigo-600 dark:text-indigo-400", dot: "bg-indigo-500" },
  Responded: { bg: "bg-violet-500/15", text: "text-violet-600 dark:text-violet-400", dot: "bg-violet-500" },
  "Multiple Responses": { bg: "bg-purple-500/15", text: "text-purple-600 dark:text-purple-400", dot: "bg-purple-500" },
  Qualified: { bg: "bg-emerald-500/15", text: "text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" },
  Booked: { bg: "bg-amber-400/20", text: "text-amber-600 dark:text-amber-400", dot: "bg-amber-500" },
  Lost: { bg: "bg-red-500/15", text: "text-red-600 dark:text-red-400", dot: "bg-red-500" },
  DND: { bg: "bg-zinc-500/15", text: "text-zinc-600 dark:text-zinc-400", dot: "bg-zinc-500" },
};

const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  urgent: { bg: "bg-red-500/15", text: "text-red-600 dark:text-red-400" },
  high: { bg: "bg-orange-500/15", text: "text-orange-600 dark:text-orange-400" },
  medium: { bg: "bg-amber-500/15", text: "text-amber-600 dark:text-amber-400" },
  low: { bg: "bg-green-500/15", text: "text-green-600 dark:text-green-400" },
};

function getInitials(lead: Record<string, any>): string {
  const fullName = lead.full_name || [lead.first_name, lead.last_name].filter(Boolean).join(" ");
  if (!fullName) return "?";
  return fullName
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function getFullName(lead: Record<string, any>): string {
  return lead.full_name || [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "Unknown";
}

function getStatus(lead: Record<string, any>): string {
  return lead.conversion_status || lead.Conversion_Status || "";
}

function getScore(lead: Record<string, any>): number {
  return Number(lead.lead_score ?? lead.leadScore ?? lead.Lead_Score ?? 0);
}

function scoreBarColor(score: number): string {
  if (score >= 70) return "bg-emerald-500";
  if (score >= 40) return "bg-amber-500";
  return "bg-red-500";
}

function scoreTextColor(score: number): string {
  if (score >= 70) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 40) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "";
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return `${Math.floor(diffDays / 30)}mo ago`;
  } catch {
    return "";
  }
}

/* ─── Copy-to-clipboard button ─── */
function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      navigator.clipboard.writeText(value).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      });
    },
    [value]
  );
  return (
    <button
      onClick={handleCopy}
      className="opacity-0 group-hover/contact:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
      title="Copy"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

/* ─── Sentiment indicator ─── */
function SentimentBadge({ value }: { value: string }) {
  const lower = (value || "").toLowerCase();
  if (lower.includes("positive") || lower === "positive") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
        <Smile className="h-2.5 w-2.5" /> Positive
      </span>
    );
  }
  if (lower.includes("negative") || lower === "negative") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/15 text-red-600 dark:text-red-400">
        <Frown className="h-2.5 w-2.5" /> Negative
      </span>
    );
  }
  if (lower) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-500/15 text-zinc-600 dark:text-zinc-400">
        <Meh className="h-2.5 w-2.5" /> Neutral
      </span>
    );
  }
  return null;
}

/* ─── Left: lead list item ─── */
function LeadListItem({
  lead,
  isSelected,
  onClick,
}: {
  lead: Record<string, any>;
  isSelected: boolean;
  onClick: () => void;
}) {
  const initials = getInitials(lead);
  const fullName = getFullName(lead);
  const status = getStatus(lead);
  const score = getScore(lead);
  const statusStyle = STATUS_COLORS[status];

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-3 py-2.5 flex items-center gap-3 transition-all duration-150 border-l-2",
        isSelected
          ? "bg-brand-blue/8 dark:bg-brand-blue/12 border-l-brand-blue"
          : "border-l-transparent hover:bg-muted/40"
      )}
      data-testid={`lead-list-item-${lead.Id ?? lead.id}`}
    >
      {/* Avatar */}
      <div
        className={cn(
          "w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0",
          isSelected
            ? "bg-brand-blue text-white"
            : "bg-brand-blue/15 text-brand-blue"
        )}
      >
        {initials}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className={cn("font-semibold text-sm truncate", isSelected ? "text-foreground" : "text-foreground")}>
            {fullName}
          </span>
          {score > 0 && (
            <span className={cn("text-[11px] font-bold tabular-nums flex-shrink-0", scoreTextColor(score))}>
              {score}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          {statusStyle && (
            <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold", statusStyle.bg, statusStyle.text)}>
              <span className={cn("w-1.5 h-1.5 rounded-full", statusStyle.dot)} />
              {status}
            </span>
          )}
          {(lead.phone || lead.email) && (
            <span className="text-[10px] text-muted-foreground truncate">
              {lead.phone || lead.email}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

/* ─── Right: rich lead detail panel ─── */
function LeadDetailCard({ lead }: { lead: Record<string, any> }) {
  const initials = getInitials(lead);
  const fullName = getFullName(lead);
  const status = getStatus(lead);
  const score = getScore(lead);
  const priority = lead.priority || "";
  const sentiment = lead.ai_sentiment || lead.aiSentiment || lead.Ai_Sentiment || "";
  const account = lead.account_name || lead.Account || lead["Account.name"] || "";
  const campaign = lead.campaign_name || lead.Campaign || lead["Campaign.name"] || "";
  const sentTotal = Number(lead.message_count_sent ?? 0);
  const rcvTotal = Number(lead.message_count_received ?? 0);
  const lastActivity = lead.last_interaction_at || lead.last_message_received_at || lead.last_message_sent_at;
  const statusStyle = STATUS_COLORS[status];
  const priorityStyle = PRIORITY_COLORS[priority?.toLowerCase()] || PRIORITY_COLORS["low"];
  const automationStatus = lead.automation_status || "";

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Hero header */}
      <div className="px-6 py-5 border-b border-border/60">
        <div className="flex items-start gap-4">
          {/* Large avatar */}
          <div className="w-14 h-14 rounded-2xl bg-brand-blue/15 text-brand-blue flex items-center justify-center text-xl font-bold flex-shrink-0">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-foreground truncate">{fullName}</h2>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              {statusStyle && (
                <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold", statusStyle.bg, statusStyle.text)}>
                  <span className={cn("w-1.5 h-1.5 rounded-full", statusStyle.dot)} />
                  {status}
                </span>
              )}
              {priority && (
                <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize", priorityStyle.bg, priorityStyle.text)}>
                  {priority} priority
                </span>
              )}
              {automationStatus && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-muted text-muted-foreground capitalize">
                  {automationStatus}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 px-6 py-4 space-y-5">
        {/* Contact info */}
        <div className="space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Contact</div>
          {lead.phone && (
            <div className="group/contact flex items-center gap-2 text-sm">
              <Phone className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <span className="font-mono text-foreground/90 truncate">{lead.phone}</span>
              <CopyButton value={lead.phone} />
            </div>
          )}
          {(lead.email || lead.Email) && (
            <div className="group/contact flex items-center gap-2 text-sm">
              <Mail className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <span className="text-foreground/90 truncate">{lead.email || lead.Email}</span>
              <CopyButton value={lead.email || lead.Email} />
            </div>
          )}
        </div>

        {/* Score + campaign row */}
        <div className="grid grid-cols-2 gap-4">
          {/* Lead score */}
          <div className="space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Lead Score</div>
            {score > 0 ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all", scoreBarColor(score))}
                      style={{ width: `${score}%` }}
                    />
                  </div>
                  <span className={cn("text-sm font-bold tabular-nums flex-shrink-0", scoreTextColor(score))}>
                    {score}
                  </span>
                </div>
              </>
            ) : (
              <span className="text-sm text-muted-foreground">—</span>
            )}
          </div>

          {/* Campaign */}
          <div className="space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Campaign</div>
            {campaign ? (
              <div className="flex items-center gap-1.5 text-sm">
                <Tag className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <span className="text-foreground/90 truncate">{campaign}</span>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">—</span>
            )}
          </div>
        </div>

        {/* Activity row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-muted/30 border border-border/40 px-3 py-2.5 text-center">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Last Active</div>
            <div className="text-sm font-semibold text-foreground">
              {formatRelativeTime(lastActivity) || "—"}
            </div>
          </div>
          <div className="rounded-xl bg-muted/30 border border-border/40 px-3 py-2.5 text-center">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Sent</div>
            <div className="text-sm font-semibold text-foreground tabular-nums">
              {sentTotal > 0 ? sentTotal : "—"}
            </div>
          </div>
          <div className="rounded-xl bg-muted/30 border border-border/40 px-3 py-2.5 text-center">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Received</div>
            <div className="text-sm font-semibold text-foreground tabular-nums">
              {rcvTotal > 0 ? rcvTotal : "—"}
            </div>
          </div>
        </div>

        {/* Account */}
        {account && (
          <div className="flex items-center gap-2 text-sm">
            <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <span className="text-muted-foreground">Account:</span>
            <span className="font-medium text-foreground truncate">{account}</span>
          </div>
        )}

        {/* Booking info */}
        {lead.booked_call_date && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-amber-500/8 border border-amber-500/20">
            <Calendar className="h-4 w-4 text-amber-500 flex-shrink-0" />
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">Booked Call</div>
              <div className="text-sm font-semibold text-foreground">
                {new Date(lead.booked_call_date).toLocaleDateString(undefined, {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </div>
            </div>
          </div>
        )}

        {/* Sentiment */}
        {sentiment && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Sentiment:</span>
            <SentimentBadge value={sentiment} />
          </div>
        )}

        {/* Notes */}
        {lead.notes && (
          <div className="space-y-1.5">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Notes</div>
            <div className="rounded-xl border border-border/40 bg-muted/20 px-3 py-2.5">
              <p className="text-sm text-foreground/80 leading-relaxed line-clamp-6">{lead.notes}</p>
            </div>
          </div>
        )}

        {/* Updated at */}
        {lead.updated_at && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            Updated {formatRelativeTime(lead.updated_at)}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Main component ─── */
export function LeadsListView({ leads, loading }: LeadsListViewProps) {
  const [selectedLeadId, setSelectedLeadId] = useState<number | string | null>(null);

  // Auto-select first lead when leads load
  useEffect(() => {
    if (leads.length > 0 && selectedLeadId === null) {
      const first = leads[0];
      setSelectedLeadId(first.Id ?? first.id);
    }
  }, [leads, selectedLeadId]);

  const selectedLead = leads.find((l) => (l.Id ?? l.id) === selectedLeadId) ?? null;

  if (loading && leads.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Loading leads…
      </div>
    );
  }

  if (!loading && leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-2 text-muted-foreground">
        <Users className="h-8 w-8 opacity-30" />
        <span className="text-sm">No leads to display</span>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[600px] overflow-hidden">
      {/* Left: Lead list */}
      <div className="w-80 flex-shrink-0 border-r border-border/60 overflow-y-auto bg-card/50">
        <div className="px-3 py-2 border-b border-border/40 sticky top-0 bg-card/80 backdrop-blur-sm z-10">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {leads.length} Lead{leads.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="divide-y divide-border/30">
          {leads.map((lead) => {
            const id = lead.Id ?? lead.id;
            return (
              <LeadListItem
                key={id}
                lead={lead}
                isSelected={selectedLeadId === id}
                onClick={() => setSelectedLeadId(id)}
              />
            );
          })}
        </div>
      </div>

      {/* Right: Lead detail */}
      <div className="flex-1 min-w-0 overflow-hidden bg-card">
        {selectedLead ? (
          <LeadDetailCard lead={selectedLead} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
            <MessageSquare className="h-10 w-10 opacity-20" />
            <div className="text-center">
              <p className="text-sm font-medium">Select a lead to view details</p>
              <p className="text-xs opacity-60 mt-1">Click any lead in the list →</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
