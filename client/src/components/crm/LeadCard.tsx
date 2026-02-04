import { Lead } from "@/data/mocks";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const CSV_TAGS = [
  { name: "New Lead", color: "#3B82F6" },
  { name: "Contacted", color: "#10B981" },
  { name: "Follow-up Required", color: "#F59E0B" },
  { name: "Nurturing", color: "#8B5CF6" },
  { name: "Qualified", color: "#EC4899" },
  { name: "High Intent", color: "#EF4444" },
  { name: "Ready to Book", color: "#14B8A6" },
  { name: "Appointment Scheduled", color: "#6366F1" },
  { name: "Post-Call Follow-up", color: "#F43F5E" },
  { name: "Closed - Won", color: "#059669" },
  { name: "Closed - Lost", color: "#4B5563" },
  { name: "DND / Opt-out", color: "#1F2937" },
  { name: "Re-engagement", color: "#D946EF" },
  { name: "Future Interest", color: "#84CC16" },
  { name: "Pricing Inquiry", color: "#0EA5E9" },
  { name: "Technical Question", color: "#64748B" },
  { name: "Referral", color: "#A855F7" },
  { name: "Partner Lead", color: "#F97316" }
];

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
        "rounded-2xl border border-slate-200 p-4 transition-all duration-300 group/lead",
        active ? "bg-primary/5" : "bg-background hover:bg-muted/10",
      )}
      data-testid={`card-lead-${lead.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="font-semibold truncate" data-testid={`text-lead-name-${lead.id}`}>
            {lead.full_name}
          </div>
          
          <div className="max-h-0 overflow-hidden group-hover/lead:max-h-20 transition-all duration-300 ease-in-out">
            <div className="pt-2 flex flex-col gap-0.5">
              <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <span className="opacity-50 font-medium">Email:</span> {lead.email}
              </div>
              <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <span className="opacity-50 font-medium">Phone:</span> {lead.phone}
              </div>
            </div>
          </div>

          <div className="text-xs text-muted-foreground truncate group-hover/lead:hidden" data-testid={`text-lead-phone-${lead.id}`}>
            {lead.phone}
          </div>
          {lead.tags && lead.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {lead.tags.map((tag, idx) => {
                const tagInfo = CSV_TAGS.find(t => t.name === tag);
                const color = tagInfo?.color || '#64748B';
                return (
                  <Badge 
                    key={idx} 
                    className="text-[11px] px-2.5 h-6 font-bold border shadow-none rounded-lg"
                    style={{ 
                      backgroundColor: `${color}15`,
                      color: color,
                      borderColor: `${color}30`
                    }}
                  >
                    {tag}
                  </Badge>
                );
              })}
            </div>
          )}
        </div>
        <Badge className={cn("border", statusTone(lead.conversion_status))} data-testid={`badge-status-${lead.id}`}>
          {lead.conversion_status}
        </Badge>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        <div data-testid={`text-lead-source-${lead.id}`}>Source: {lead.source}</div>
        <div data-testid={`text-lead-priority-${lead.id}`}>Priority: {lead.priority}</div>
        <div className="col-span-2 truncate mt-1" data-testid={`text-lead-notes-${lead.id}`}>
          {lead.notes || "—"}
        </div>
      </div>
    </div>
  );
}
