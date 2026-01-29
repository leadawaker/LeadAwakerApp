import { useMemo, useState } from "react";
import { CrmShell } from "@/components/crm/CrmShell";
import { useWorkspace } from "@/hooks/useWorkspace";
import { leads } from "@/data/mocks";
import { FiltersBar } from "@/components/crm/FiltersBar";
import { ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export default function CalendarPage() {
  const { currentAccountId } = useWorkspace();
  const [campaignId, setCampaignId] = useState<number | "all">("all");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const appts = useMemo(() => {
    return leads
      .filter((l) => l.account_id === currentAccountId)
      .filter((l) => (campaignId === "all" ? true : l.campaign_id === campaignId))
      .filter((l) => Boolean(l.booked_call_date))
      .map((l) => {
        const d = new Date(l.booked_call_date as string);
        return {
          id: l.id,
          lead_name: l.full_name,
          date: d.toLocaleDateString(),
          time: d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          status: l.conversion_status,
          calendar_link: "https://cal.example.com/leadawaker",
        };
      })
      .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  }, [currentAccountId, campaignId]);

  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const days = useMemo(() => {
    const year = month.getFullYear();
    const m = month.getMonth();
    const first = new Date(year, m, 1);
    const startDow = first.getDay();
    const gridStart = new Date(year, m, 1 - startDow);

    const out: { date: Date; count: number }[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      const key = d.toLocaleDateString();
      const count = appts.filter((a) => a.date === key).length;
      out.push({ date: d, count });
    }
    return out;
  }, [month, appts]);

  const appointmentsForSelectedDate = useMemo(() => {
    if (!selectedDate) return [];
    return appts.filter((a) => a.date === selectedDate);
  }, [selectedDate, appts]);

  return (
    <CrmShell>
      <div className="px-6 py-6" data-testid="page-calendar">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight" data-testid="text-title">Calendar</h1>
            <p className="text-sm text-muted-foreground" data-testid="text-subtitle">
              Booked appointments derived from Leads.
            </p>
          </div>
          {selectedDate && (
            <button
              onClick={() => setSelectedDate(null)}
              className="flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
              data-testid="button-back-to-month"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Full Month
            </button>
          )}
        </div>

        <div className="mt-4">
          <FiltersBar selectedCampaignId={campaignId} setSelectedCampaignId={setCampaignId} />
        </div>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-6" data-testid="layout-calendar">
          <div className="rounded-2xl border border-border bg-background overflow-hidden" data-testid="calendar-month">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div className="font-semibold" data-testid="text-month">
                {month.toLocaleString(undefined, { month: "long", year: "numeric" })}
              </div>
              <div className="flex gap-2">
                <button
                  className="h-9 w-9 rounded-xl border border-border bg-muted/20 hover:bg-muted/30 flex items-center justify-center"
                  onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                  data-testid="button-prev-month"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  className="h-9 w-9 rounded-xl border border-border bg-muted/20 hover:bg-muted/30 flex items-center justify-center"
                  onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                  data-testid="button-next-month"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 text-xs text-center font-bold text-muted-foreground border-b border-border bg-muted/5" data-testid="row-dow">
              {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((d, i) => (
                <div key={i} className="px-3 py-3" data-testid={`dow-${i}`}>{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7" data-testid="grid-days">
              {days.map((d, idx) => {
                const inMonth = d.date.getMonth() === month.getMonth();
                const isSelected = selectedDate === d.date.toLocaleDateString();
                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedDate(d.date.toLocaleDateString())}
                    className={cn(
                      "h-24 border-b border-r border-border/60 last:border-r-0 p-2 cursor-pointer transition-colors hover:bg-muted/30",
                      !inMonth && "bg-muted/5 opacity-40",
                      isSelected && "bg-primary/5 ring-1 ring-inset ring-primary"
                    )}
                    data-testid={`day-${idx}`}
                  >
                    <div className={cn("text-xs font-bold mb-1", inMonth ? "text-foreground" : "text-muted-foreground")}>
                      {d.date.getDate()}
                    </div>
                    {d.count > 0 && (
                      <div className="flex justify-center mt-2">
                        <div 
                          className="h-6 w-6 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shadow-sm"
                          data-testid={`day-count-${idx}`}
                        >
                          {d.count}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-background flex flex-col overflow-hidden" data-testid="calendar-list">
            <div className="p-4 border-b border-border bg-muted/5">
              <div className="font-semibold text-sm" data-testid="text-list-title">
                {selectedDate ? `Appointments for ${selectedDate}` : "Upcoming Appointments"}
              </div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1" data-testid="text-list-sub">
                Timeline overview
              </div>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-border">
              {(selectedDate ? appointmentsForSelectedDate : appts).length === 0 ? (
                <div className="p-8 text-center" data-testid="empty-appts">
                   <div className="text-3xl mb-2 opacity-20">📅</div>
                   <div className="text-sm text-muted-foreground font-medium">No appointments scheduled</div>
                </div>
              ) : (
                (selectedDate ? appointmentsForSelectedDate : appts).map((a) => (
                  <div key={a.id} className="p-4 hover:bg-muted/20 transition-colors" data-testid={`row-appt-${a.id}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-bold text-sm truncate" data-testid={`text-appt-name-${a.id}`}>{a.lead_name}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded uppercase">{a.time}</span>
                          <span className="text-[10px] text-muted-foreground font-medium">{a.date}</span>
                        </div>
                      </div>
                      <a
                        href={a.calendar_link}
                        className="h-7 px-3 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-[10px] font-bold flex items-center transition-colors"
                        target="_blank"
                        rel="noreferrer"
                        data-testid={`link-appt-${a.id}`}
                      >
                        VIEW CAL
                      </a>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </CrmShell>
  );
}
