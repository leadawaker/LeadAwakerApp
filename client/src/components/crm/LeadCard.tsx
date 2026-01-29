import { Lead } from "@/data/mocks";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function statusTone(status: Lead["conversion_status"]) {
  switch (status) {
    case "Booked":
      return "bg-emerald-500/10 text-emerald-700 border-emerald-500/20";
    case "Qualified":
      return "bg-blue-500/10 text-blue-700 border-blue-500/20";
    case "Responded":
      return "bg-violet-500/10 text-violet-700 border-violet-500/20";
    case "DND":
      return "bg-rose-500/10 text-rose-700 border-rose-500/20";
    case "Lost":
      return "bg-zinc-500/10 text-zinc-700 border-zinc-500/20";
    default:
      return "bg-amber-500/10 text-amber-800 border-amber-500/20";
  }
}

export function LeadCard({ lead, active }: { lead: Lead; active: boolean }) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4 transition-colors",
        active ? "border-primary/30 bg-primary/5" : "border-border bg-background hover:bg-muted/10",
      )}
      data-testid={`card-lead-${lead.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold truncate" data-testid={`text-lead-name-${lead.id}`}>
            {lead.full_name}
          </div>
          <div className="text-xs text-muted-foreground truncate" data-testid={`text-lead-phone-${lead.id}`}>
            {lead.phone}
          </div>
        </div>
        <Badge className={cn("border", statusTone(lead.conversion_status))} data-testid={`badge-status-${lead.id}`}>
          {lead.conversion_status}
        </Badge>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        <div data-testid={`text-lead-source-${lead.id}`}>Source: {lead.source}</div>
        <div data-testid={`text-lead-priority-${lead.id}`}>Priority: {lead.priority}</div>
        <div className="col-span-2 truncate" data-testid={`text-lead-notes-${lead.id}`}>
          {lead.notes || "—"}
        </div>
      </div>
    </div>
  );
}
