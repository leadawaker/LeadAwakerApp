import { useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Zap, MessageSquare, TrendingUp, ArrowUpRight, CheckCircle2, Calendar as CalendarIcon, Target } from "lucide-react";
import { CrmShell } from "@/components/crm/CrmShell";
import { useWorkspace } from "@/hooks/useWorkspace";
import { FiltersBar } from "@/components/crm/FiltersBar";
import { useLeads, type Lead } from "@/hooks/useLeads";
import { leads as hardcodedLeads } from "@/data/mocks";
import { cn } from "@/lib/utils";
import { LeadCard } from "@/components/crm/LeadCard";

export default function AppLeads() {
  const { currentAccountId, isAgencyView } = useWorkspace();
  const [campaignId, setCampaignId] = useState<number | "all">("all");
  const [status, setStatus] = useState<string>("all");
  const [priority, setPriority] = useState<string>("all");
  const [open, setOpen] = useState(false);

  const [localLeads, setLocalLeads] = useState<Lead[]>([]);

  const { leads: csvLeads, isLoading } = useLeads({
    accountId: currentAccountId,
    campaignId: campaignId === "all" ? null : campaignId,
  });

  const leads = useMemo(() => {
    // Include the hardcoded leads from data/mocks.ts for the current account
    const accountMockLeads = hardcodedLeads.filter(l => l.account_id === currentAccountId);
    
    // Merge all sources: CSV data, hardcoded mock data, and any local session edits
    const merged = [...csvLeads, ...accountMockLeads, ...localLeads];
    
    // De-duplicate by ID
    const unique = Array.from(new Map(merged.map(l => [l.id, l])).values());

    return unique
      .filter((l) => (campaignId === "all" ? true : l.campaign_id === campaignId))
      .filter((l) => (status === "all" ? true : l.conversion_status === status))
      .filter((l) => (priority === "all" ? true : l.priority === priority))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [csvLeads, hardcodedLeads, currentAccountId, campaignId, status, priority, localLeads]);

  const statusColors: Record<string, { text: string, bg: string, border: string, icon: any }> = {
    "New": { text: "text-[#1a3a6f]", bg: "bg-[#1a3a6f]/10", border: "border-[#1a3a6f]/20", icon: <Zap className="w-3 h-3" /> },
    "Contacted": { text: "text-[#2d5aa8]", bg: "bg-[#2d5aa8]/10", border: "border-[#2d5aa8]/20", icon: <MessageSquare className="w-3 h-3" /> },
    "Responded": { text: "text-[#1E90FF]", bg: "bg-[#1E90FF]/10", border: "border-[#1E90FF]/20", icon: <TrendingUp className="w-3 h-3" /> },
    "Multiple Responses": { text: "text-[#17A398]", bg: "bg-[#17A398]/10", border: "border-[#17A398]/20", icon: <ArrowUpRight className="w-3 h-3" /> },
    "Qualified": { text: "text-[#10b981]", bg: "bg-[#10b981]/10", border: "border-[#10b981]/20", icon: <CheckCircle2 className="w-3 h-3" /> },
    "Booked": { text: "text-[#ca8a04]", bg: "bg-[#facc15]/20", border: "border-[#facc15]/30", icon: <CalendarIcon className="w-3 h-3" /> },
    "DND": { text: "text-[#ef4444]", bg: "bg-[#ef4444]/10", border: "border-[#ef4444]/20", icon: <Target className="w-3 h-3" /> },
  };

  const [editingId, setEditingId] = useState<number | null>(null);
  const [tempData, setTempData] = useState<{ phone: string, email: string } | null>(null);
  const [selectedLeads, setSelectedLeads] = useState<Set<number>>(new Set());

  const toggleSelectAll = () => {
    if (selectedLeads.size === leads.length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(leads.map(l => l.id)));
    }
  };

  const toggleSelectLead = (id: number) => {
    const next = new Set(selectedLeads);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedLeads(next);
  };

  const tagColors: Record<string, string> = {
    "bump 1 reply": "#3B82F6",
    "bump 2 reply": "#3B82F6",
    "bump 3 reply": "#3B82F6",
    "bump response": "#3B82F6",
    "first message": "#EAB308",
    "follow-up": "#F97316",
    "lead": "#3B82F6",
    "multiple messages": "#3B82F6",
    "qualify": "#22C55E",
    "responded": "#22C55E",
    "second message": "#EAB308",
    "appointment booked": "#22C55E",
    "goodbye": "#64748B",
    "no response": "#64748B",
    "schedule": "#22C55E",
    "ai stop": "#EF4444",
    "bump 1.1": "#3B82F6",
    "bump 2.1": "#3B82F6",
    "bump 3.1": "#3B82F6",
    "no bump": "#64748B",
    "reply generating": "#EAB308",
    "dnd": "#EF4444",
    "manual takeover": "#F97316",
    "dbr android": "#A855F7",
    "fb lead": "#A855F7",
    "sleeping beauty android optin": "#A855F7",
    "high priority": "#EF4444",
    "warm lead": "#F97316",
  };

  const getStatusColor = (status: string) => {
    return statusColors[status] || { text: "text-muted-foreground", bg: "bg-muted/10", border: "border-border", icon: null };
  };

  return (
    <CrmShell>
      <div className="h-full flex flex-col pt-6 -mt-2 pb-2" data-testid="page-leads">
        <div className="shrink-0 mb-6" data-testid="card-page-leads">
          <div className="p-0">
            <div className="flex flex-wrap items-center gap-3" data-testid="bar-filters">
              <div className="flex items-center gap-2">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="h-10 rounded-xl border border-border bg-white px-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none min-w-[140px]"
                  data-testid="select-status"
                >
                  <option value="all">All statuses</option>
                  {Object.keys(statusColors).filter(s => s !== "Lost").map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>

                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="h-10 rounded-xl border border-border bg-white px-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none min-w-[140px]"
                  data-testid="select-priority"
                >
                  <option value="all">All priorities</option>
                  {["Low", "Medium", "High", "Urgent"].map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>

                <button
                  className="h-10 px-4 rounded-xl border border-border bg-white hover:bg-muted/10 text-sm font-semibold transition-colors"
                  data-testid="button-filter"
                >
                  Filter
                </button>
              </div>

              <div className="flex-1 flex items-center gap-2">
                <input
                  className="h-10 flex-1 min-w-[200px] rounded-xl border border-border bg-white px-4 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="Search contacts..."
                  data-testid="input-search-contacts"
                />
                <button
                  className="h-10 px-4 rounded-xl bg-blue-600 text-white hover:bg-blue-700 text-sm font-semibold transition-colors"
                  data-testid="button-add-lead"
                >
                  +Add
                </button>
                <button
                  className="h-10 px-4 rounded-xl border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 text-sm font-semibold transition-colors"
                  data-testid="button-delete-leads"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 bg-white rounded-[32px] border border-border flex flex-col overflow-hidden" data-testid="table-contacts">
          <div className="shrink-0 grid grid-cols-[40px_44px_1.5fr_1fr_1fr_1fr] items-center gap-3 bg-white px-6 py-4 text-[11px] font-bold text-muted-foreground border-b border-border uppercase tracking-wider z-20" data-testid="row-contacts-head">
            <div className="flex justify-center">
              <input 
                type="checkbox" 
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                checked={leads.length > 0 && selectedLeads.size === leads.length}
                onChange={toggleSelectAll}
              />
            </div>
            <div />
            <div className="sticky left-0 bg-white z-30 px-2">name</div>
            <div>conversion</div>
            <div>tags</div>
            <div className="text-right">details</div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-border/30" data-testid="list-contacts">
            {isLoading ? (
              <div className="px-4 py-6 text-sm text-muted-foreground" data-testid="status-leads-loading">
                Loading contacts…
              </div>
            ) : null}
            {leads.map((l: any) => {
              const initials = `${(l.first_name ?? "").slice(0, 1)}${(l.last_name ?? "").slice(0, 1)}`.toUpperCase();
              const statusInfo = getStatusColor(l.conversion_status);
              const initialsColors = [
                { text: "text-blue-600", bg: "bg-blue-50" },
                { text: "text-emerald-600", bg: "bg-emerald-50" },
                { text: "text-amber-600", bg: "bg-amber-50" },
                { text: "text-indigo-600", bg: "bg-indigo-50" },
                { text: "text-rose-600", bg: "bg-rose-50" },
                { text: "text-violet-600", bg: "bg-violet-50" },
              ];
              const colorIdx = (l.id % initialsColors.length);
              const avatarColor = initialsColors[colorIdx];

              return (
                <div
                  key={l.id}
                  className="grid grid-cols-[40px_44px_1.5fr_1fr_1fr_1fr] items-center gap-3 px-6 py-4 hover:bg-muted/5 group bg-white transition-colors"
                  data-testid={`row-contact-${l.id}`}
                >
                  <div className="flex justify-center">
                    <input 
                      type="checkbox" 
                      className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                      checked={selectedLeads.has(l.id)}
                      onChange={() => toggleSelectLead(l.id)}
                    />
                  </div>
                  <div 
                    className={cn("h-9 w-9 rounded-full font-bold grid place-items-center text-xs border border-transparent", avatarColor.text, avatarColor.bg)} 
                    data-testid={`avatar-contact-${l.id}`}
                  >
                    {initials || "?"}
                  </div>

                  <div className="min-w-0 sticky left-0 bg-white group-hover:bg-muted/5 transition-colors z-10 px-2" data-testid={`cell-name-${l.id}`}>
                    <div className="flex flex-col">
                      <a
                        href={`${isAgencyView ? "/agency" : "/subaccount"}/contacts/${l.id}`}
                        onClick={(e) => {
                          e.preventDefault();
                          const href = `${isAgencyView ? "/agency" : "/subaccount"}/contacts/${l.id}`;
                          window.history.pushState({}, "", href);
                          window.dispatchEvent(new PopStateEvent("popstate"));
                        }}
                        className="text-base font-bold truncate hover:underline block leading-tight text-slate-900/90"
                        data-testid={`link-contact-${l.id}`}
                      >
                        {l.full_name}
                      </a>
                      <div className="text-[10px] text-muted-foreground font-medium mt-0.5">
                        Last update: {new Date(l.updated_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center shrink-0" data-testid={`cell-status-${l.id}`}>
                    <div className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold uppercase whitespace-nowrap", statusInfo.text, statusInfo.bg, statusInfo.border)}>
                      {statusInfo.icon}
                      {l.conversion_status}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-x-2 gap-y-1" data-testid={`cell-tags-${l.id}`}>
                    {(l.tags ?? []).map((t: string, i: number) => {
                      const color = tagColors[t] || "#64748B";
                      return (
                        <span 
                          key={i} 
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded-md border"
                          style={{ 
                            color: "#000",
                            backgroundColor: `${color}08`,
                            borderColor: `${color}20`
                          }}
                        >
                          {t}
                        </span>
                      );
                    })}
                  </div>

                  <div className="flex flex-col items-end gap-0.5">
                    <div className="text-[11px] text-muted-foreground font-medium truncate max-w-full">{l.phone}</div>
                    <div className="text-[11px] text-muted-foreground font-medium truncate max-w-full">{l.email}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </CrmShell>
  );
}

function AddLeadForm({
  accountId,
  onSubmit,
}: {
  accountId: number;
  onSubmit: (lead: Lead) => void;
}) {
  const [first_name, setFirstName] = useState("");
  const [last_name, setLastName] = useState("");
  const [automation_status, setAutomationStatus] = useState("");
  const [conversion_status, setConversionStatus] = useState("New");
  const [campaign_id, setCampaignId] = useState("1");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [source, setSource] = useState("");
  const [notes, setNotes] = useState("");
  const [booked_call_date, setBookedCallDate] = useState("");
  const [timezone, setTimezone] = useState("");
  const [ai_sentiment, setAiSentiment] = useState("");
  const [opted_out, setOptedOut] = useState(false);
  const [manual_takeover, setManualTakeover] = useState(false);
  const [dnc_reason, setDncReason] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [language, setLanguage] = useState("");
  const [time_zone, setTimeZone] = useState("");

  return (
    <form
      className="p-4 space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const now = new Date().toISOString();
        const id = 100000 + Math.floor(Math.random() * 100000);
        const lead: Lead = {
          id,
          account_id: accountId,
          campaign_id: Number(campaign_id) || 0,
          created_at: now,
          updated_at: now,
          first_name,
          last_name,
          full_name: `${first_name} ${last_name}`.trim(),
          phone,
          email,
          conversion_status,
          source,
          last_interaction_at: now,
          notes,
          booked_call_date: booked_call_date || null,
          automation_status,
          last_message_sent_at: null,
          last_message_received_at: null,
          message_count_sent: 0,
          message_count_received: 0,
          ai_memory: "",
          bump_1_sent_at: null,
          bump_2_sent_at: null,
          bump_3_sent_at: null,
          first_message_sent_at: null,
          current_bump_stage: 0,
          next_action_at: null,
          timezone: timezone || time_zone,
          opted_out,
          ai_sentiment,
          priority,
          manual_takeover,
          dnc_reason,
          tags: [],
        };
        onSubmit(lead);
      }}
      data-testid="form-add-lead"
    >
      <Row>
        <Input label="first_name" value={first_name} onChange={setFirstName} testId="input-add-first_name" />
        <Input label="last_name" value={last_name} onChange={setLastName} testId="input-add-last_name" />
      </Row>

      <Row>
        <Input label="phone" value={phone} onChange={setPhone} testId="input-add-phone" />
        <Input label="Email" value={email} onChange={setEmail} testId="input-add-Email" />
      </Row>

      <Row>
        <Input label="Source" value={source} onChange={setSource} testId="input-add-Source" />
        <Input label="notes" value={notes} onChange={setNotes} testId="input-add-notes" />
      </Row>

      <Row>
        <Input label="automation_status" value={automation_status} onChange={setAutomationStatus} testId="input-add-automation_status" />
        <Select
          label="Conversion Status"
          value={conversion_status}
          onChange={setConversionStatus}
          options={["New", "Contacted", "Responded", "Multiple Responses", "Qualified", "Booked", "Lost", "DND"]}
          testId="select-add-Conversion_Status"
        />
      </Row>

      <Row>
        <Input label="campaign_id" value={campaign_id} onChange={setCampaignId} testId="input-add-campaign_id" />
        <Select
          label="priority"
          value={priority}
          onChange={setPriority}
          options={["Low", "Medium", "High", "Urgent"]}
          testId="select-add-priority"
        />
      </Row>

      <Row>
        <Input label="booked_call_date" value={booked_call_date} onChange={setBookedCallDate} testId="input-add-booked_call_date" />
        <Input label="timezone" value={timezone} onChange={setTimezone} testId="input-add-timezone" />
      </Row>

      <Row>
        <Input label="ai_sentiment" value={ai_sentiment} onChange={setAiSentiment} testId="input-add-ai_sentiment" />
        <Input label="dnc_reason" value={dnc_reason} onChange={setDncReason} testId="input-add-dnc_reason" />
      </Row>

      <Row>
        <Input label="language" value={language} onChange={setLanguage} testId="input-add-language" />
        <Input label="time_zone" value={time_zone} onChange={setTimeZone} testId="input-add-time_zone" />
      </Row>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="row-add-flags">
        <div className="flex items-center justify-between rounded-xl border border-border bg-muted/20 px-3 h-10" data-testid="toggle-add-opted_out-wrap">
          <span className="text-sm" data-testid="toggle-add-opted_out-label">opted_out</span>
          <input
            type="checkbox"
            checked={opted_out}
            onChange={(e) => setOptedOut(e.target.checked)}
            className="h-4 w-4"
            data-testid="toggle-add-opted_out"
          />
        </div>

        <div className="flex items-center justify-between rounded-xl border border-border bg-muted/20 px-3 h-10" data-testid="toggle-add-manual_takeover-wrap">
          <span className="text-sm" data-testid="toggle-add-manual_takeover-label">manual_takeover</span>
          <input
            type="checkbox"
            checked={manual_takeover}
            onChange={(e) => setManualTakeover(e.target.checked)}
            className="h-4 w-4"
            data-testid="toggle-add-manual_takeover"
          />
        </div>
      </div>

      <div className="pt-2 flex justify-end gap-2" data-testid="row-add-actions">
        <button
          type="submit"
          className="h-10 px-3 rounded-xl border border-border bg-primary text-primary-foreground hover:opacity-90 text-sm font-semibold"
          data-testid="button-add-submit"
        >
          Create Lead
        </button>
      </div>
    </form>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="row">{children}</div>;
}

function Input({
  label,
  value,
  onChange,
  testId,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  testId: string;
}) {
  return (
    <div data-testid={`${testId}-wrap`}>
      <label className="text-xs text-muted-foreground" data-testid={`${testId}-label`}>{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 h-10 w-full rounded-xl border border-border bg-muted/20 px-3 text-sm"
        data-testid={testId}
        required
      />
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  testId,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  testId: string;
}) {
  return (
    <div data-testid={`${testId}-wrap`}>
      <label className="text-xs text-muted-foreground" data-testid={`${testId}-label`}>{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 h-10 w-full rounded-xl border border-border bg-muted/20 px-3 text-sm"
        data-testid={testId}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}
