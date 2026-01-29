import { useMemo, useState } from "react";
import { useRoute } from "wouter";
import { leads, interactions, type Lead } from "@/data/mocks";
import { CrmShell } from "@/components/crm/CrmShell";
import { ChatBubble } from "@/components/crm/ChatBubble";
import { ManualSend } from "@/components/crm/ManualSend";
import { cn } from "@/lib/utils";

export default function LeadDetailPage() {
  const [, params] = useRoute("/app/lead/:id");
  const id = Number(params?.id);

  const lead = useMemo(() => {
    if (Number.isFinite(id) && id > 0) return leads.find((l) => l.id === id) ?? null;
    return null;
  }, [id]);
  const chat = useMemo(() => {
    if (!lead) return [];
    return interactions
      .filter((i) => i.lead_id === lead.id)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  }, [lead]);

  const [draft, setDraft] = useState<Lead | null>(lead);

  return (
    <CrmShell>
      <div className="px-6 py-6" data-testid="page-lead-detail">
        {!lead ? (
          <div className="text-sm text-muted-foreground" data-testid="text-lead-missing">
            Lead not found.
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4" data-testid="header-lead">
              <div>
                <div className="text-xs text-muted-foreground" data-testid="text-lead-header-label">Contact</div>
                <div className="text-2xl font-extrabold tracking-tight" data-testid="text-lead-header-name">
                  {lead.full_name}
                </div>
                <div className="text-sm text-muted-foreground" data-testid="text-lead-header-phone">
                  {lead.phone} • {lead.email}
                </div>
              </div>
              <div className="flex items-center gap-2" data-testid="badges-lead">
                <span className="px-2 py-1 rounded-full text-xs border border-border bg-muted/20" data-testid="badge-lead-status">
                  {lead.conversion_status}
                </span>
                <span className="px-2 py-1 rounded-full text-xs border border-border bg-muted/20" data-testid="badge-lead-priority">
                  {lead.priority}
                </span>
                <span className={cn("px-2 py-1 rounded-full text-xs border", lead.manual_takeover ? "border-primary/30 bg-primary/10" : "border-border bg-muted/20")} data-testid="badge-lead-takeover">
                  takeover={String(lead.manual_takeover)}
                </span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 xl:grid-cols-[360px_1fr_320px] gap-6" data-testid="layout-lead">
              {/* Left editable form */}
              <div className="rounded-2xl border border-border bg-background overflow-hidden" data-testid="panel-lead-left">
                <Section title="Contact" testId="section-contact">
                  <ReadRow label="Lead example" value={lead.id === 25 ? "Using lead #25 (Sam Lewis)" : `Lead #${lead.id}`} testId="text-lead-example" />
                  <Field label="First Name" value={draft?.first_name ?? ""} onChange={(v) => setDraft((p) => (p ? { ...p, first_name: v } : p))} testId="input-first-name" />
                  <Field label="Last Name" value={draft?.last_name ?? ""} onChange={(v) => setDraft((p) => (p ? { ...p, last_name: v } : p))} testId="input-last-name" />
                  <Field label="Email" value={draft?.email ?? ""} onChange={(v) => setDraft((p) => (p ? { ...p, email: v } : p))} testId="input-email" />
                  <Field label="Phone" value={draft?.phone ?? ""} onChange={(v) => setDraft((p) => (p ? { ...p, phone: v } : p))} testId="input-phone" />
                  <Field label="Date Of Birth" value={(draft as any)?.date_of_birth ?? ""} onChange={() => {}} testId="input-dob" disabledHint="(mock field)" />
                  <Field label="Contact Source" value={draft?.source ?? ""} onChange={() => {}} testId="input-contact-source" disabledHint="(mapped from Lead.source)" />
                  <Field label="Contact Type" value={(draft as any)?.contact_type ?? ""} onChange={() => {}} testId="input-contact-type" disabledHint="(mock field)" />
                </Section>

                <Section title="General / Additional" testId="section-general">
                  <Field label="utm_content" value={draft?.custom_field_1 ?? ""} onChange={(v) => setDraft((p) => (p ? { ...p, custom_field_1: v } : p))} testId="input-utm-content" />
                  <Field label="utm_source" value={draft?.custom_field_2 ?? ""} onChange={(v) => setDraft((p) => (p ? { ...p, custom_field_2: v } : p))} testId="input-utm-source" />
                  <Field label="consent" value={(draft as any)?.consent ?? ""} onChange={() => {}} testId="input-consent" disabledHint="(mock field)" />
                  <Field label="utm_campaign" value={(draft as any)?.utm_campaign ?? ""} onChange={() => {}} testId="input-utm-campaign" disabledHint="(mock field)" />
                  <Field label="utm_medium" value={(draft as any)?.utm_medium ?? ""} onChange={() => {}} testId="input-utm-medium" disabledHint="(mock field)" />
                  <Field label="Wants To Schedule?" value={(draft as any)?.wants_to_schedule ?? ""} onChange={() => {}} testId="input-wants-schedule" disabledHint="(mock field)" />
                  <Field label="Platform" value={(draft as any)?.platform ?? ""} onChange={() => {}} testId="input-platform" disabledHint="(mock field)" />
                </Section>

                <Section title="ChatGPT" testId="section-chatgpt">
                  <ReadRow label="First Message Sent" value={lead.first_message_sent_at ?? "—"} testId="text-first-message" />
                  <ReadRow label="AI Memory" value={lead.ai_memory} testId="text-ai-memory" />
                  <ReadRow label="Lead Response" value={lead.message_count_received ? "Has replies" : "No replies"} testId="text-lead-response" />
                </Section>

                <div className="p-4 border-t border-border text-xs text-muted-foreground" data-testid="text-lead-left-foot">
                  REAL: PATCH contact fields in NocoDB Contacts table
                </div>
              </div>

              {/* Center chat */}
              <div className="rounded-2xl border border-border bg-background overflow-hidden flex flex-col" data-testid="panel-lead-center">
                <div className="px-4 py-3 border-b border-border" data-testid="chat-head">
                  <div className="text-sm font-semibold" data-testid="text-chat-title">Conversation</div>
                  <div className="text-xs text-muted-foreground" data-testid="text-chat-sub">Inbound left • Outbound right</div>
                </div>
                <div className="flex-1 overflow-auto p-4 space-y-3" data-testid="chat-scroll">
                  {chat.map((m) => (
                    <ChatBubble key={m.id} item={m} />
                  ))}
                </div>
                <div className="p-4 border-t border-border" data-testid="chat-compose">
                  <ManualSend disabled={false} />
                </div>
              </div>

              {/* Right panel */}
              <div className="rounded-2xl border border-border bg-background overflow-hidden" data-testid="panel-lead-right">
                <Section title="Tags" testId="section-tags">
                  <div className="flex flex-wrap gap-2" data-testid="wrap-tags">
                    {(lead.notes ? ["Follow-up", "Pricing"] : ["New", "Hot"]).map((t, idx) => (
                      <span key={idx} className="px-2 py-1 rounded-full text-xs border border-border bg-muted/20" data-testid={`tag-${idx}`}>
                        {t}
                      </span>
                    ))}
                  </div>
                </Section>

                <Section title="Automation" testId="section-automation">
                  <ReadRow label="automation_status" value={lead.automation_status} testId="text-automation-status" />
                  <ReadRow label="next_action_at" value={lead.next_action_at ?? "—"} testId="text-next-action" />
                </Section>

                <Section title="Actions" testId="section-actions">
                  <button className="h-10 w-full rounded-xl border border-border bg-muted/20 hover:bg-muted/30 text-sm font-semibold" data-testid="button-actions">
                    Actions ▾
                  </button>
                </Section>

                <div className="p-4 border-t border-border text-xs text-muted-foreground" data-testid="text-right-foot">
                  REAL: pull tags, automation, logs per lead
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </CrmShell>
  );
}

function Section({ title, children, testId }: { title: string; children: React.ReactNode; testId: string }) {
  return (
    <div className="p-4 border-b border-border last:border-b-0" data-testid={testId}>
      <div className="text-sm font-semibold" data-testid={`${testId}-title`}>{title}</div>
      <div className="mt-3 space-y-3" data-testid={`${testId}-body`}>{children}</div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  testId,
  disabledHint,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  testId: string;
  disabledHint?: string;
  disabled?: boolean;
}) {
  return (
    <div data-testid={`${testId}-wrap`}>
      <div className="flex items-center justify-between" data-testid={`${testId}-label-row`}>
        <label className="text-xs text-muted-foreground" data-testid={`${testId}-label`}>{label}</label>
        {disabledHint ? <span className="text-[11px] text-muted-foreground" data-testid={`${testId}-hint`}>{disabledHint}</span> : null}
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 h-10 w-full rounded-xl border border-border bg-muted/20 px-3 text-sm"
        data-testid={testId}
        disabled={disabled}
      />
    </div>
  );
}

function ReadRow({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="text-sm" data-testid={testId}>
      <div className="text-xs text-muted-foreground" data-testid={`${testId}-label`}>{label}</div>
      <div className="mt-1 break-words" data-testid={`${testId}-value`}>{value}</div>
    </div>
  );
}
