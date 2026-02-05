import { useMemo, useState } from "react";
import { Link } from "wouter";
import { CrmShell } from "@/components/crm/CrmShell";
import { FiltersBar } from "@/components/crm/FiltersBar";
import { leads, interactions, type Interaction, type Lead } from "@/data/mocks";
import { useWorkspace } from "@/hooks/useWorkspace";
import { cn } from "@/lib/utils";
import { ChevronLeft } from "lucide-react";

function initialsFor(lead: Lead) {
  const a = (lead.first_name ?? "").slice(0, 1);
  const b = (lead.last_name ?? "").slice(0, 1);
  return `${a}${b}`.toUpperCase() || "?";
}

export default function ConversationsPage() {
  const { currentAccountId } = useWorkspace();
  const [campaignId, setCampaignId] = useState<number | "all">("all");
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [mobileView, setMobileView] = useState<"inbox" | "chat">("inbox");

  const [tab, setTab] = useState<"all" | "unread">("all");

  const threads = useMemo(() => {
    const scoped = leads
      .filter((l) => l.account_id === currentAccountId)
      .filter((l) => (campaignId === "all" ? true : l.campaign_id === campaignId));

    const all = scoped
      .map((lead) => {
        const msgs = interactions
          .filter((i) => i.lead_id === lead.id)
          .sort((a, b) => a.created_at.localeCompare(b.created_at));
        const last = msgs[msgs.length - 1];
        const unread = msgs.filter((m) => m.direction === "Inbound").length > 0 && lead.message_count_received > 0;
        return { lead, msgs, last, unread };
      })
      .sort((a, b) => (b.last?.created_at ?? "").localeCompare(a.last?.created_at ?? ""));

    if (tab === "unread") {
      return all.filter((t) => t.unread);
    }
    return all;
  }, [currentAccountId, campaignId, tab]);

  const selected = useMemo(() => {
    const first = threads[0] ?? null;
    const byId = selectedLeadId ? threads.find((t) => t.lead.id === selectedLeadId) ?? null : null;
    return byId ?? first;
  }, [threads, selectedLeadId]);

  const handleSelectLead = (id: number) => {
    setSelectedLeadId(id);
    setMobileView("chat");
  };

  return (
    <CrmShell>
      <div className="h-[calc(100vh-100px)] flex flex-col overflow-hidden pb-3" data-testid="page-conversations">
        <div className="px-4 md:px-6 pt-4 md:pt-6 pb-2 shrink-0 hidden">
          <div className="flex items-center gap-4">
            {mobileView === "chat" && (
              <button 
                onClick={() => setMobileView("inbox")}
                className="md:hidden h-9 w-9 rounded-full border border-border bg-background grid place-items-center"
                data-testid="button-back-to-inbox"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight" data-testid="text-title">
              {mobileView === "chat" && selected ? selected.lead.full_name : "Conversations"}
            </h1>
            <div className={cn("flex-1 md:flex-none", mobileView === "chat" && "hidden md:block")}>
              <FiltersBar selectedCampaignId={campaignId} setSelectedCampaignId={setCampaignId} />
            </div>
          </div>
        </div>

        <div
          className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[400px_1fr_340px] gap-4"
          data-testid="layout-conversations"
        >
          {/* Left: inbox list */}
          <section
            className={cn(
              "rounded-2xl border border-border bg-white overflow-hidden flex flex-col h-full transition-all duration-300",
              mobileView === "chat" ? "hidden md:flex" : "flex"
            )}
            data-testid="panel-inbox"
          >
            <div className="p-4 border-b border-border shrink-0" data-testid="panel-inbox-head">
              <div className="flex items-center gap-4 mb-2" data-testid="row-inbox-tabs">
                <button
                  onClick={() => setTab("all")}
                  className={cn(
                    "text-sm font-bold transition-colors pb-1 border-b-2",
                    tab === "all" ? "text-foreground border-primary" : "text-muted-foreground border-transparent hover:text-foreground"
                  )}
                  data-testid="button-tab-all"
                >
                  Inbox
                </button>
                <button
                  onClick={() => setTab("unread")}
                  className={cn(
                    "text-sm font-bold transition-colors pb-1 border-b-2",
                    tab === "unread" ? "text-foreground border-primary" : "text-muted-foreground border-transparent hover:text-foreground"
                  )}
                  data-testid="button-tab-unread"
                >
                  Unread
                </button>
              </div>
              <div className="mt-2">
                <input
                  className="h-10 w-full rounded-xl border border-border bg-muted/20 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Search contacts…"
                  data-testid="input-inbox-search"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto" data-testid="list-inbox">
              <div className="flex flex-col">
                {threads.map(({ lead, last, unread }) => {
                  const active = selected?.lead.id === lead.id;
                  return (
                    <button
                      key={lead.id}
                      type="button"
                      onClick={() => handleSelectLead(lead.id)}
                      className={cn(
                        "w-full text-left px-4 py-3 transition-colors",
                        active ? "bg-primary/5" : "hover:bg-muted/20",
                      )}
                      data-testid={`button-thread-${lead.id}`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            "h-9 w-9 rounded-full grid place-items-center text-xs font-bold border",
                            active ? "bg-primary/10 text-primary border-primary/20" : "bg-muted/30 text-foreground border-border",
                          )}
                          data-testid={`avatar-thread-${lead.id}`}
                        >
                          {initialsFor(lead)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-semibold truncate" data-testid={`text-thread-name-${lead.id}`}>
                              {lead.full_name}
                            </div>
                            <div className="text-[11px] text-muted-foreground whitespace-nowrap" data-testid={`text-thread-time-${lead.id}`}>
                              {last ? new Date(last.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                            </div>
                          </div>
                          <div className="mt-0.5 flex items-center justify-between gap-2">
                            <div className="text-xs text-muted-foreground truncate" data-testid={`text-thread-preview-${lead.id}`}>
                              {last ? last.content : "No messages yet."}
                            </div>
                            {unread ? (
                              <span
                                className="h-2.5 w-2.5 rounded-full bg-primary"
                                data-testid={`status-thread-unread-${lead.id}`}
                              />
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="px-4 py-3 text-xs text-muted-foreground shrink-0" data-testid="text-inbox-foot">
              {threads.length} threads • MOCK
            </div>
          </section>

          {/* Center: chat */}
          <section
            className={cn(
              "rounded-2xl border border-border bg-white overflow-hidden flex flex-col h-full transition-all duration-300",
              mobileView === "inbox" ? "hidden md:flex" : "flex"
            )}
            data-testid="panel-chat"
          >
            <div className="px-4 py-3 border-b border-border shrink-0" data-testid="panel-chat-head">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate" data-testid="text-chat-contact">
                    {selected ? selected.lead.full_name : "Select a conversation"}
                  </div>
                  <div className="text-xs text-muted-foreground" data-testid="text-chat-meta">
                    {selected ? `${selected.lead.phone} • ${selected.lead.email}` : ""}
                  </div>
                </div>
                {selected ? (
                  <a
                    href={`/app/contacts/${selected.lead.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      window.history.pushState({}, "", `/app/contacts/${selected.lead.id}`);
                      window.dispatchEvent(new PopStateEvent("popstate"));
                    }}
                    className="text-xs font-semibold text-primary hover:underline"
                    data-testid="link-open-contact"
                  >
                    Open contact
                  </a>
                ) : null}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3" data-testid="chat-scroll">
              {!selected ? (
                <div className="text-sm text-muted-foreground" data-testid="empty-chat">
                  Pick a contact on the left.
                </div>
              ) : selected.msgs.length === 0 ? (
                <div className="text-sm text-muted-foreground" data-testid="empty-chat-no-messages">
                  No messages yet.
                </div>
              ) : (
                selected.msgs.map((m) => <ChatLine key={m.id} item={m} />)
              )}
            </div>

            <div className="p-4 border-t border-border shrink-0" data-testid="chat-compose">
              <div className="flex items-end gap-2" data-testid="form-compose">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground" data-testid="label-compose">
                    Manual send (takeover)
                  </label>
                  <textarea
                    className="mt-1 w-full min-h-[44px] max-h-40 rounded-xl bg-muted/30 border border-border p-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder={selected ? "Type a message…" : "Select a contact first"}
                    disabled={!selected}
                    data-testid="input-compose"
                  />
                </div>
                <button
                  type="button"
                  className="h-11 px-4 rounded-xl bg-primary text-primary-foreground font-semibold disabled:opacity-50"
                  disabled={!selected}
                  data-testid="button-compose-send"
                >
                  Send
                </button>
              </div>
            </div>
          </section>

          {/* Right: contact panel - visible only on XL screens */}
          <section
            className="hidden xl:flex rounded-2xl border border-border bg-white overflow-hidden flex-col h-full"
            data-testid="panel-contact"
          >
            <div className="p-4 border-b border-border shrink-0" data-testid="panel-contact-head">
              <div className="text-sm font-semibold" data-testid="text-contact-panel-title">
                Contact
              </div>
              <div className="text-xs text-muted-foreground" data-testid="text-contact-panel-sub">
                Quick actions + tags
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4" data-testid="panel-contact-body">
              {!selected ? (
                <div className="text-sm text-muted-foreground" data-testid="empty-contact-panel">
                  Select a conversation.
                </div>
              ) : (
                <>
                  <div className="flex items-start gap-3" data-testid="block-contact-hero">
                    <div
                      className="h-10 w-10 rounded-full bg-primary/10 text-primary font-extrabold grid place-items-center border border-primary/20"
                      data-testid="avatar-contact"
                    >
                      {initialsFor(selected.lead)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold truncate" data-testid="text-contact-name">
                        {selected.lead.full_name}
                      </div>
                      <div className="text-xs text-muted-foreground" data-testid="text-contact-sub">
                        {selected.lead.source} • {selected.lead.priority}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2" data-testid="grid-contact-meta">
                    <div className="rounded-xl border border-border bg-muted/10 p-3" data-testid="card-contact-phone">
                      <div className="text-[11px] text-muted-foreground" data-testid="label-contact-phone">
                        Phone
                      </div>
                      <div className="mt-1 text-sm font-semibold" data-testid="text-contact-phone">
                        {selected.lead.phone}
                      </div>
                    </div>
                    <div className="rounded-xl border border-border bg-muted/10 p-3" data-testid="card-contact-email">
                      <div className="text-[11px] text-muted-foreground" data-testid="label-contact-email">
                        Email
                      </div>
                      <div className="mt-1 text-sm font-semibold break-words" data-testid="text-contact-email">
                        {selected.lead.email}
                      </div>
                    </div>
                  </div>

                  <div data-testid="block-contact-tags">
                    <div className="text-xs font-semibold" data-testid="text-tags-title">
                      Tags
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2" data-testid="wrap-tags">
                      {(selected.lead.tags ?? []).length ? (
                        (selected.lead.tags ?? []).map((t, idx) => (
                          <span
                            key={`${selected.lead.id}-${idx}`}
                            className="px-2 py-1 rounded-full text-xs border border-border bg-muted/20"
                            data-testid={`tag-${selected.lead.id}-${idx}`}
                          >
                            {t}
                          </span>
                        ))
                      ) : (
                        <div className="text-sm text-muted-foreground" data-testid="empty-tags">
                          No tags.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-2" data-testid="block-contact-actions">
                    <Link
                      href={`/app/contacts/${selected.lead.id}`}
                      className="block text-center h-11 leading-[44px] rounded-xl border border-border bg-background hover:bg-muted/20 font-semibold"
                      data-testid="button-view-full"
                    >
                      View full contact
                    </Link>
                  </div>
                </>
              )}
            </div>
          </section>
        </div>

      </div>
    </CrmShell>
  );
}

function ChatLine({ item }: { item: Interaction }) {
  const outbound = item.direction === "Outbound";
  return (
    <div className={cn("flex", outbound ? "justify-end" : "justify-start")} data-testid={`row-chat-${item.id}`}>
      <div
        className={cn(
          "max-w-[78%] rounded-2xl px-3 py-2 text-sm border",
          outbound ? "bg-primary text-primary-foreground border-primary/20" : "bg-muted/40 text-foreground border-border",
        )}
        data-testid={`bubble-chat-${item.id}`}
      >
        <div className="whitespace-pre-wrap leading-relaxed" data-testid={`text-chat-${item.id}`}>
          {item.content}
        </div>
        <div
          className={cn("mt-1 text-[11px] opacity-80", outbound ? "text-primary-foreground/80" : "text-muted-foreground")}
          data-testid={`meta-chat-${item.id}`}
        >
          {new Date(item.created_at).toLocaleString()} • {item.type}
        </div>
      </div>
    </div>
  );
}