import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { DataEmptyState } from "@/components/crm/DataEmptyState";
import type { Thread, Interaction } from "../hooks/useConversationsData";

interface ChatPanelProps {
  selected: Thread | null;
  sending: boolean;
  onSend: (leadId: number, content: string, type?: string) => Promise<void>;
  className?: string;
}

export function ChatPanel({ selected, sending, onSend, className }: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevMsgCount = useRef(0);

  // Auto-scroll when new messages arrive
  useEffect(() => {
    const count = selected?.msgs.length ?? 0;
    if (count !== prevMsgCount.current) {
      prevMsgCount.current = count;
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [selected?.msgs.length]);

  const handleSubmit = async () => {
    if (!selected || !draft.trim() || sending) return;
    const text = draft;
    setDraft("");
    await onSend(selected.lead.id, text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <section
      className={cn(
        "rounded-2xl border border-border bg-card shadow-sm overflow-hidden flex flex-col h-full transition-all duration-250 ease-out",
        className,
      )}
      data-testid="panel-chat"
    >
      <div className="px-4 py-3 border-b border-border shrink-0" data-testid="panel-chat-head">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">
              {selected
                ? selected.lead.full_name ||
                  `${selected.lead.first_name ?? ""} ${selected.lead.last_name ?? ""}`.trim()
                : "Select a conversation"}
            </div>
            <div className="text-xs text-muted-foreground">
              {selected ? `${selected.lead.phone ?? ""} • ${selected.lead.email ?? ""}` : ""}
            </div>
          </div>
          {selected && (
            <a
              href={`/app/contacts/${selected.lead.id}`}
              onClick={(e) => {
                e.preventDefault();
                window.history.pushState({}, "", `/app/contacts/${selected.lead.id}`);
                window.dispatchEvent(new PopStateEvent("popstate"));
              }}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Open contact
            </a>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3" ref={scrollRef} data-testid="chat-scroll">
        {!selected ? (
          <div className="flex items-center justify-center h-full">
            <DataEmptyState
              variant="conversations"
              title="Select a conversation"
              description="Pick a contact on the left to view their messages."
              compact
            />
          </div>
        ) : selected.msgs.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <DataEmptyState
              variant="conversations"
              title="No messages yet"
              description="Start the conversation by sending a message below."
              compact
            />
          </div>
        ) : (
          selected.msgs.map((m) => <ChatBubble key={m.id} item={m} />)
        )}
      </div>

      <div className="p-4 border-t border-border shrink-0" data-testid="chat-compose">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="text-xs text-muted-foreground">Manual send (takeover)</label>
            <textarea
              className="mt-1 w-full min-h-[44px] max-h-40 rounded-xl bg-muted/30 border border-border p-3 text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              placeholder={selected ? "Type a message… (Enter to send, Shift+Enter for newline)" : "Select a contact first"}
              disabled={!selected || sending}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              data-testid="input-compose"
            />
          </div>
          <button
            type="button"
            className="h-11 px-4 rounded-xl bg-primary text-primary-foreground font-semibold disabled:opacity-50"
            disabled={!selected || !draft.trim() || sending}
            onClick={handleSubmit}
            data-testid="button-compose-send"
          >
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </section>
  );
}

function ChatBubble({ item }: { item: Interaction }) {
  const outbound = item.direction === "Outbound";
  const isFailed = item.status === "failed";
  const isSending = item.status === "sending";

  return (
    <div className={cn("flex", outbound ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[78%] rounded-2xl px-3 py-2 text-sm border",
          outbound
            ? "bg-primary text-primary-foreground border-primary/20"
            : "bg-muted/40 text-foreground border-border",
          isFailed && "border-destructive/50 opacity-80",
        )}
      >
        <div className="whitespace-pre-wrap leading-relaxed">{item.content ?? item.Content}</div>
        <div
          className={cn(
            "mt-1 text-[11px] opacity-80 flex items-center gap-1",
            outbound ? "text-primary-foreground/80" : "text-muted-foreground",
          )}
        >
          {item.created_at || item.createdAt
            ? new Date(item.created_at ?? item.createdAt).toLocaleString()
            : ""}{" "}
          • {item.type}
          {isSending && <span className="ml-1 italic">sending…</span>}
          {isFailed && <span className="ml-1 text-destructive font-semibold">failed</span>}
          {item.status === "delivered" && <span className="ml-1">✓✓</span>}
          {item.status === "read" && <span className="ml-1 text-brand-blue">✓✓</span>}
          {item.status === "sent" && <span className="ml-1">✓</span>}
        </div>
      </div>
    </div>
  );
}
