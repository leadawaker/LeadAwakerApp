import { Link } from "wouter";
import { DataEmptyState } from "@/components/crm/DataEmptyState";
import type { Thread, Lead } from "../hooks/useConversationsData";

function initialsFor(lead: Lead) {
  const a = (lead.first_name ?? "").slice(0, 1);
  const b = (lead.last_name ?? "").slice(0, 1);
  return `${a}${b}`.toUpperCase() || "?";
}

interface ContactSidebarProps {
  selected: Thread | null;
  className?: string;
}

export function ContactSidebar({ selected, className }: ContactSidebarProps) {
  return (
    <section
      className={className ?? "hidden xl:flex rounded-2xl border border-border bg-card shadow-sm overflow-hidden flex-col h-full"}
      data-testid="panel-contact"
    >
      <div className="p-4 border-b border-border shrink-0">
        <div className="text-sm font-semibold">Contact</div>
        <div className="text-xs text-muted-foreground">Quick actions + tags</div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!selected ? (
          <div className="text-sm text-muted-foreground">Select a conversation.</div>
        ) : (
          <>
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 text-primary font-extrabold grid place-items-center border border-primary/20">
                {initialsFor(selected.lead)}
              </div>
              <div className="min-w-0">
                <div className="font-semibold truncate">
                  {selected.lead.full_name ||
                    `${selected.lead.first_name ?? ""} ${selected.lead.last_name ?? ""}`.trim()}
                </div>
                <div className="text-xs text-muted-foreground">
                  {selected.lead.source ?? "—"} • {selected.lead.priority ?? "—"}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2">
              <div className="rounded-xl border border-border bg-muted/10 p-3">
                <div className="text-[11px] text-muted-foreground">Phone</div>
                <div className="mt-1 text-sm font-semibold">{selected.lead.phone ?? "—"}</div>
              </div>
              <div className="rounded-xl border border-border bg-muted/10 p-3">
                <div className="text-[11px] text-muted-foreground">Email</div>
                <div className="mt-1 text-sm font-semibold break-words">
                  {selected.lead.email ?? "—"}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-muted/10 p-3">
                <div className="text-[11px] text-muted-foreground">Status</div>
                <div className="mt-1 text-sm font-semibold">
                  {selected.lead.conversion_status ?? selected.lead.conversionStatus ?? "—"}
                </div>
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold">Tags</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {(selected.lead.tags ?? []).length ? (
                  (selected.lead.tags ?? []).map((t: string, idx: number) => (
                    <span
                      key={`${selected.lead.id}-${idx}`}
                      className="px-2 py-1 rounded-full text-xs border border-border bg-muted/20"
                    >
                      {t}
                    </span>
                  ))
                ) : (
                  <DataEmptyState variant="tags" compact title="No tags" description="No tags assigned to this lead yet." />
                )}
              </div>
            </div>

            <div className="pt-2">
              <Link
                href={`/app/contacts/${selected.lead.id}`}
                className="block text-center h-11 leading-[44px] rounded-xl border border-border bg-background hover:bg-muted/20 font-semibold"
              >
                View full contact
              </Link>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
