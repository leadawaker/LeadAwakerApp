import { useMemo } from "react";
import type { Interaction, Lead } from "@/types/models";
import { useInteractions } from "@/hooks/useApiData";
import { cn } from "@/lib/utils";
import { DataEmptyState } from "@/components/crm/DataEmptyState";

export function InteractionsChat({ lead }: { lead: Lead | null }) {
  const { interactions, loading } = useInteractions(
    undefined,
    lead?.id
  );

  const items = useMemo(() => {
    if (!lead) return [];
    return interactions
      .sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
  }, [lead, interactions]);

  return (
    <div className="h-full flex flex-col" data-testid="panel-interactions">
      <div className="px-4 py-3 border-b border-border">
        <div className="text-sm font-semibold" data-testid="text-chat-title">
          Conversation
        </div>
        <div className="text-xs text-muted-foreground" data-testid="text-chat-subtitle">
          {lead ? `${lead.full_name} • ${lead.phone}` : "Select a lead"}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-3" data-testid="list-interactions">
        {!lead ? (
          <div data-testid="empty-chat">
            <DataEmptyState
              variant="conversations"
              title="Select a lead"
              description="Pick a lead to view their messages."
              compact
            />
          </div>
        ) : loading ? (
          <div className="text-sm text-muted-foreground">Loading messages…</div>
        ) : items.length === 0 ? (
          <div data-testid="empty-chat-no-messages">
            <DataEmptyState
              variant="conversations"
              title="No interactions yet"
              description="Messages will appear here once the lead receives outreach."
              compact
            />
          </div>
        ) : (
          items.map((it) => <Bubble key={it.id} item={it} />)
        )}
      </div>

      <div className="border-t border-border p-4 bg-background" data-testid="panel-manual-send-wrap">
        <div className="text-xs text-muted-foreground" data-testid="text-real-comment">
          Send messages via API
        </div>
      </div>
    </div>
  );
}

function Bubble({ item }: { item: Interaction }) {
  const outbound = item.direction === "Outbound";
  return (
    <div
      className={cn("flex", outbound ? "justify-end" : "justify-start")}
      data-testid={`row-interaction-${item.id}`}
    >
      <div
        className={cn(
          "max-w-[78%] rounded-2xl px-3 py-2 text-sm border",
          outbound
            ? "bg-primary text-primary-foreground border-primary/20"
            : "bg-muted/40 text-foreground border-border",
        )}
        data-testid={`bubble-interaction-${item.id}`}
      >
        <div className="whitespace-pre-wrap leading-relaxed">{item.content}</div>
        <div className={cn("mt-1 text-[11px] opacity-80", outbound ? "text-primary-foreground/80" : "text-muted-foreground")}>
          {item.created_at ? new Date(item.created_at).toLocaleString() : ""} • {item.type}
        </div>
      </div>
    </div>
  );
}
