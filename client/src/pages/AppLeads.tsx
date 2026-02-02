import { useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { CrmShell } from "@/components/crm/CrmShell";
import { useWorkspace } from "@/hooks/useWorkspace";
import { FiltersBar } from "@/components/crm/FiltersBar";
import { useLeads, type Lead } from "@/hooks/useLeads";

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
    const merged = [...csvLeads, ...localLeads];

    return merged
      .filter((l) => (campaignId === "all" ? true : l.campaign_id === campaignId))
      .filter((l) => (status === "all" ? true : l.conversion_status === status))
      .filter((l) => (priority === "all" ? true : l.priority === priority))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [csvLeads, campaignId, status, priority, localLeads]);

  return (
    <CrmShell>
      <div className="px-6 py-6" data-testid="page-leads">
        <div className="flex items-center gap-4 mb-6">
          <h1 className="text-2xl font-extrabold tracking-tight" data-testid="text-title">Contacts</h1>
          <FiltersBar selectedCampaignId={campaignId} setSelectedCampaignId={setCampaignId} />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2" data-testid="bar-filters">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-10 rounded-xl border border-border bg-muted/20 px-3 text-sm"
            data-testid="select-status"
          >
            <option value="all">All statuses</option>
            {[
              "New",
              "Contacted",
              "Responded",
              "Multiple Responses",
              "Qualified",
              "Booked",
              "Lost",
              "DND",
            ].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="h-10 rounded-xl border border-border bg-muted/20 px-3 text-sm"
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
            className="h-10 px-3 rounded-xl border border-border bg-muted/20 hover:bg-muted/30 text-sm font-semibold"
            data-testid="button-filter"
          >
            Filter
          </button>

          <div className="ml-auto flex items-center gap-2" data-testid="bar-actions">
            <button
              className="h-10 px-3 rounded-xl border border-border bg-muted/20 hover:bg-muted/30 text-sm font-semibold"
              data-testid="button-import"
            >
              Import CSV
            </button>

            <Dialog.Root open={open} onOpenChange={setOpen}>
              <Dialog.Trigger asChild>
                <button
                  className="h-10 px-3 rounded-xl border border-border bg-primary text-primary-foreground hover:opacity-90 text-sm font-semibold"
                  data-testid="button-add-lead"
                >
                  + Add Lead
                </button>
              </Dialog.Trigger>

              <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/30" />
                <Dialog.Content
                  className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-background shadow-xl"
                  data-testid="modal-add-lead"
                >
                  <div className="p-4 border-b border-border flex items-center justify-between">
                    <div className="font-semibold" data-testid="text-modal-title">Add Lead</div>
                    <Dialog.Close asChild>
                      <button className="h-9 w-9 rounded-xl hover:bg-muted/30 grid place-items-center" data-testid="button-modal-close">
                        <X className="h-4 w-4" />
                      </button>
                    </Dialog.Close>
                  </div>
                  <AddLeadForm
                    onSubmit={(lead) => {
                      setLocalLeads((prev) => [lead, ...prev]);
                      setOpen(false);
                    }}
                    accountId={currentAccountId}
                  />
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-border bg-background overflow-hidden" data-testid="table-contacts">
          {isLoading ? (
            <div className="px-4 py-6 text-sm text-muted-foreground" data-testid="status-leads-loading">
              Loading contacts…
            </div>
          ) : null}
          <div className="grid grid-cols-[44px_1.2fr_200px_240px_220px_180px] items-center gap-3 bg-muted/20 px-4 py-3 text-xs font-semibold text-muted-foreground border-b border-border" data-testid="row-contacts-head">
            <div />
            <div>name</div>
            <div>phone</div>
            <div>email</div>
            <div>tags</div>
            <div>conversion_status</div>
          </div>

          <div className="divide-y divide-border" data-testid="list-contacts">
            {leads.map((l) => {
              const initials = `${(l.first_name ?? "").slice(0, 1)}${(l.last_name ?? "").slice(0, 1)}`.toUpperCase();
              return (
                <div
                  key={l.id}
                  className="grid grid-cols-[44px_1.2fr_200px_240px_220px_180px] items-center gap-3 px-4 py-3"
                  data-testid={`row-contact-${l.id}`}
                >
                  <div className="h-9 w-9 rounded-full bg-primary/10 text-primary font-bold grid place-items-center text-xs" data-testid={`avatar-contact-${l.id}`}>
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
                      className="font-semibold truncate hover:underline block"
                      data-testid={`link-contact-${l.id}`}
                    >
                      {l.full_name}
                    </a>
                    <div className="text-[11px] text-muted-foreground truncate" data-testid={`text-contact-sub-${l.id}`}>
                      source: {l.source} • priority: {l.priority}
                    </div>
                  </div>

                  <input
                    className="h-10 w-full rounded-xl border border-border bg-muted/10 px-3 text-sm"
                    value={l.phone}
                    onChange={(e) =>
                      setLocalLeads((prev) =>
                        prev.some((x) => x.id === l.id)
                          ? prev.map((x) => (x.id === l.id ? { ...x, phone: e.target.value } : x))
                          : [{ ...l, phone: e.target.value }, ...prev],
                      )
                    }
                    data-testid={`input-phone-${l.id}`}
                  />

                  <input
                    className="h-10 w-full rounded-xl border border-border bg-muted/10 px-3 text-sm"
                    value={l.email}
                    onChange={(e) =>
                      setLocalLeads((prev) =>
                        prev.some((x) => x.id === l.id)
                          ? prev.map((x) => (x.id === l.id ? { ...x, email: e.target.value } : x))
                          : [{ ...l, email: e.target.value }, ...prev],
                      )
                    }
                    data-testid={`input-email-${l.id}`}
                  />

                  <input
                    className="h-10 w-full rounded-xl border border-border bg-muted/10 px-3 text-sm"
                    value={(l.tags ?? []).join(", ")}
                    onChange={(e) =>
                      setLocalLeads((prev) =>
                        prev.some((x) => x.id === l.id)
                          ? prev.map((x) =>
                              x.id === l.id
                                ? { ...x, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) }
                                : x,
                            )
                          : [
                              {
                                ...l,
                                tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean),
                              },
                              ...prev,
                            ],
                      )
                    }
                    placeholder="New, Hot, Follow-up"
                    data-testid={`input-tags-${l.id}`}
                  />

                  <select
                    className="h-10 w-full rounded-xl border border-border bg-muted/10 px-3 text-sm"
                    value={l.conversion_status}
                    onChange={(e) =>
                      setLocalLeads((prev) =>
                        prev.some((x) => x.id === l.id)
                          ? prev.map((x) => (x.id === l.id ? { ...x, conversion_status: e.target.value as any } : x))
                          : [{ ...l, conversion_status: e.target.value as any }, ...prev],
                      )
                    }
                    data-testid={`select-status-${l.id}`}
                  >
                    {["New", "Contacted", "Responded", "Multiple Responses", "Qualified", "Booked", "Lost", "DND"].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
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
