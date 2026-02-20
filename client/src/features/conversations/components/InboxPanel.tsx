import { useState } from "react";
import { cn } from "@/lib/utils";
import { SkeletonList } from "@/components/ui/skeleton";
import { DataEmptyState } from "@/components/crm/DataEmptyState";
import type { Thread, Lead } from "../hooks/useConversationsData";

function initialsFor(lead: Lead) {
  const a = (lead.first_name ?? "").slice(0, 1);
  const b = (lead.last_name ?? "").slice(0, 1);
  return `${a}${b}`.toUpperCase() || "?";
}

interface InboxPanelProps {
  threads: Thread[];
  loading: boolean;
  selectedLeadId: number | null;
  onSelectLead: (id: number) => void;
  tab: "all" | "unread";
  onTabChange: (tab: "all" | "unread") => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  className?: string;
}

export function InboxPanel({
  threads,
  loading,
  selectedLeadId,
  onSelectLead,
  tab,
  onTabChange,
  searchQuery,
  onSearchChange,
  className,
}: InboxPanelProps) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-border bg-card shadow-sm overflow-hidden flex flex-col h-full transition-all duration-250 ease-out",
        className,
      )}
      data-testid="panel-inbox"
    >
      <div className="p-4 border-b border-border shrink-0" data-testid="panel-inbox-head">
        <div className="flex items-center gap-4 mb-2" data-testid="row-inbox-tabs">
          <button
            onClick={() => onTabChange("all")}
            className={cn(
              "text-sm font-bold transition-colors pb-1 border-b-2",
              tab === "all"
                ? "text-foreground border-primary"
                : "text-muted-foreground border-transparent hover:text-foreground",
            )}
            data-testid="button-tab-all"
          >
            Inbox
          </button>
          <button
            onClick={() => onTabChange("unread")}
            className={cn(
              "text-sm font-bold transition-colors pb-1 border-b-2",
              tab === "unread"
                ? "text-foreground border-primary"
                : "text-muted-foreground border-transparent hover:text-foreground",
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
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            data-testid="input-inbox-search"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto" data-testid="list-inbox">
        {loading ? (
          <SkeletonList count={6} />
        ) : (
          <div className="flex flex-col">
            {threads.map(({ lead, last, unread }) => {
              const active = selectedLeadId === lead.id;
              return (
                <button
                  key={lead.id}
                  type="button"
                  onClick={() => onSelectLead(lead.id)}
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
                        active
                          ? "bg-primary/10 text-primary border-primary/20"
                          : "bg-muted/30 text-foreground border-border",
                      )}
                    >
                      {initialsFor(lead)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-semibold truncate">
                          {lead.full_name ||
                            `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim() ||
                            "Unknown"}
                        </div>
                        <div className="text-[11px] text-muted-foreground whitespace-nowrap">
                          {last
                            ? new Date(last.created_at ?? last.createdAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "—"}
                        </div>
                      </div>
                      <div className="mt-0.5 flex items-center justify-between gap-2">
                        <div className="text-xs text-muted-foreground truncate">
                          {last ? last.content : "No messages yet."}
                        </div>
                        {unread && (
                          <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
            {threads.length === 0 && !loading && (
              <DataEmptyState
                variant={searchQuery ? "search" : "conversations"}
                compact
              />
            )}
          </div>
        )}
      </div>

      <div className="px-4 py-3 text-xs text-muted-foreground shrink-0" data-testid="text-inbox-foot">
        {threads.length} threads
      </div>
    </section>
  );
}
