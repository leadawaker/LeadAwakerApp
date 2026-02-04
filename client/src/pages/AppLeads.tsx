import { useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { CrmShell } from "@/components/crm/CrmShell";
import { useWorkspace } from "@/hooks/useWorkspace";
import { FiltersBar } from "@/components/crm/FiltersBar";
import { useLeads, type Lead } from "@/hooks/useLeads";
import { leads as hardcodedLeads } from "@/data/mocks";
import { cn } from "@/lib/utils";

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

  const statusColors: Record<string, { bg: string, text: string, emoji: string }> = {
    "New": { bg: "bg-blue-50", text: "text-blue-600", emoji: "🆕" },
    "Contacted": { bg: "bg-purple-50", text: "text-purple-600", emoji: "📱" },
    "Responded": { bg: "bg-emerald-50", text: "text-emerald-600", emoji: "💬" },
    "Multiple Responses": { bg: "bg-cyan-50", text: "text-cyan-600", emoji: "🗣️" },
    "Qualified": { bg: "bg-amber-50", text: "text-amber-600", emoji: "⭐" },
    "Booked": { bg: "bg-indigo-50", text: "text-indigo-600", emoji: "📅" },
    "Lost": { bg: "bg-rose-50", text: "text-rose-600", emoji: "❌" },
    "DND": { bg: "bg-slate-50", text: "text-slate-600", emoji: "🚫" },
  };

  const getStatusColor = (status: string) => {
    return statusColors[status] || { bg: "bg-muted/10", text: "text-muted-foreground", emoji: "" };
  };

  const [editingId, setEditingId] = useState<number | null>(null);
  const [tempData, setTempData] = useState<{ phone: string, email: string } | null>(null);

  return (
    <CrmShell>
      <div className="py-6" data-testid="page-leads">
        <div className="mb-4" data-testid="card-page-leads">
          <div className="p-0">
            <div className="flex flex-wrap items-center gap-2" data-testid="bar-filters">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="h-10 rounded-xl border border-border bg-white px-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                data-testid="select-status"
              >
                <option value="all">All statuses</option>
                {Object.keys(statusColors).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>

              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="h-10 rounded-xl border border-border bg-white px-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
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
                className="h-10 px-3 rounded-xl border border-border bg-white hover:bg-muted/10 text-sm font-semibold transition-colors"
                data-testid="button-filter"
              >
                Filter
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white overflow-hidden" data-testid="table-contacts">
          {isLoading ? (
            <div className="px-4 py-6 text-sm text-muted-foreground" data-testid="status-leads-loading">
              Loading contacts…
            </div>
          ) : null}
          <div className="grid grid-cols-[44px_1.2fr_180px_220px_180px_220px_120px] items-center gap-3 bg-white px-4 py-2 text-[11px] font-bold text-muted-foreground border-b border-border uppercase tracking-wider" data-testid="row-contacts-head">
            <div />
            <div>name</div>
            <div>conversion</div>
            <div>tags</div>
            <div>phone</div>
            <div>email</div>
            <div>last update</div>
          </div>

          <div className="divide-y divide-transparent" data-testid="list-contacts">
            {leads.map((l) => {
              const initials = `${(l.first_name ?? "").slice(0, 1)}${(l.last_name ?? "").slice(0, 1)}`.toUpperCase();
              const statusInfo = getStatusColor(l.conversion_status);
              const isEditing = editingId === l.id;

              return (
                <div
                  key={l.id}
                  className="grid grid-cols-[44px_1.2fr_180px_220px_180px_220px_120px] items-center gap-3 px-4 py-3 hover:bg-muted/5 group bg-white transition-colors"
                  data-testid={`row-contact-${l.id}`}
                >
                  <div className={cn("h-9 w-9 rounded-full font-bold grid place-items-center text-xs border border-transparent", statusInfo.bg, statusInfo.text)} data-testid={`avatar-contact-${l.id}`}>
                    {initials || "?"}
                  </div>

                  <div className="min-w-0" data-testid={`cell-name-${l.id}`}>
                    <a
                      href={`${isAgencyView ? "/agency" : "/subaccount"}/contacts/${l.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        const href = `${isAgencyView ? "/agency" : "/subaccount"}/contacts/${l.id}`;
                        window.history.pushState({}, "", href);
                        window.dispatchEvent(new PopStateEvent("popstate"));
                      }}
                      className="text-sm font-semibold truncate hover:underline block leading-tight"
                      data-testid={`link-contact-${l.id}`}
                    >
                      {l.full_name}
                    </a>
                  </div>

                  <div className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold w-fit", statusInfo.bg, statusInfo.text)} data-testid={`cell-status-${l.id}`}>
                    <span>{statusInfo.emoji}</span>
                    <span>{l.conversion_status}</span>
                  </div>

                  <div className="flex flex-wrap gap-1" data-testid={`cell-tags-${l.id}`}>
                    {(l.tags ?? []).map((t, i) => {
                      const colors = [
                        "bg-blue-50 text-blue-600 border-blue-100",
                        "bg-purple-50 text-purple-600 border-purple-100",
                        "bg-emerald-50 text-emerald-600 border-emerald-100",
                        "bg-orange-50 text-orange-600 border-orange-100",
                        "bg-pink-50 text-pink-600 border-pink-100",
                      ];
                      const colorClass = colors[i % colors.length];
                      return (
                        <span 
                          key={i} 
                          className={cn(
                            "px-2 py-0.5 rounded-full border text-[10px] font-bold transition-all",
                            colorClass
                          )}
                        >
                          {t}
                        </span>
                      );
                    })}
                  </div>

                  <div className="relative group/field">
                    {isEditing ? (
                      <input
                        className="h-8 w-full rounded-lg border border-primary bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                        value={tempData?.phone}
                        onChange={(e) => setTempData(prev => prev ? { ...prev, phone: e.target.value } : null)}
                        autoFocus
                      />
                    ) : (
                      <div 
                        className="text-sm text-muted-foreground py-1 px-2 cursor-text hover:bg-muted/10 rounded transition-colors"
                        onClick={() => {
                          setEditingId(l.id);
                          setTempData({ phone: l.phone, email: l.email });
                        }}
                      >
                        {l.phone}
                      </div>
                    )}
                  </div>

                  <div className="relative group/field">
                    {isEditing ? (
                      <div className="flex flex-col gap-2">
                        <input
                          className="h-8 w-full rounded-lg border border-primary bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                          value={tempData?.email}
                          onChange={(e) => setTempData(prev => prev ? { ...prev, email: e.target.value } : null)}
                        />
                        <div className="absolute top-full left-0 mt-1 z-10 flex gap-1 p-1 bg-white border border-border rounded-lg shadow-lg">
                          <button
                            onClick={() => {
                              if (tempData) {
                                setLocalLeads((prev) =>
                                  prev.some((x) => x.id === l.id)
                                    ? prev.map((x) => (x.id === l.id ? { ...x, phone: tempData.phone, email: tempData.email } : x))
                                    : [{ ...l, phone: tempData.phone, email: tempData.email }, ...prev],
                                );
                              }
                              setEditingId(null);
                              setTempData(null);
                            }}
                            className="px-2 py-1 bg-primary text-primary-foreground text-[10px] font-bold rounded hover:opacity-90"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => {
                              setEditingId(null);
                              setTempData(null);
                            }}
                            className="px-2 py-1 bg-muted text-muted-foreground text-[10px] font-bold rounded hover:bg-muted/80"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div 
                        className="text-sm text-muted-foreground py-1 px-2 cursor-text hover:bg-muted/10 rounded transition-colors truncate"
                        onClick={() => {
                          setEditingId(l.id);
                          setTempData({ phone: l.phone, email: l.email });
                        }}
                      >
                        {l.email}
                      </div>
                    )}
                  </div>

                  <div className="text-[11px] text-muted-foreground font-medium" data-testid={`cell-updated-${l.id}`}>
                    {new Date(l.updated_at).toLocaleDateString()}
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
