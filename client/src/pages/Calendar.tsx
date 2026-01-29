import { useMemo, useState } from "react";
import { CrmShell } from "@/components/crm/CrmShell";
import { useWorkspace } from "@/hooks/useWorkspace";
import { leads } from "@/data/mocks";
import { FiltersBar } from "@/components/crm/FiltersBar";

export default function CalendarPage() {
  const { currentAccountId } = useWorkspace();
  const [campaignId, setCampaignId] = useState<number | "all">("all");

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

  return (
    <CrmShell>
      <div className="px-6 py-6" data-testid="page-calendar">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight" data-testid="text-title">Calendar</h1>
          <p className="text-sm text-muted-foreground" data-testid="text-subtitle">
            Booked appointments (MOCK) derived from Leads.booked_call_date.
          </p>
        </div>

        <div className="mt-4">
          <FiltersBar selectedCampaignId={campaignId} setSelectedCampaignId={setCampaignId} />
        </div>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-6" data-testid="layout-calendar">
          <div className="rounded-2xl border border-border bg-background overflow-hidden" data-testid="calendar-month">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div className="font-semibold" data-testid="text-month">
                {month.toLocaleString(undefined, { month: "long", year: "numeric" })}
              </div>
              <div className="flex gap-2">
                <button
                  className="h-9 px-3 rounded-xl border border-border bg-muted/20 hover:bg-muted/30 text-sm"
                  onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                  data-testid="button-prev-month"
                >
                  Prev
                </button>
                <button
                  className="h-9 px-3 rounded-xl border border-border bg-muted/20 hover:bg-muted/30 text-sm"
                  onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                  data-testid="button-next-month"
                >
                  Next
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 text-xs text-muted-foreground border-b border-border" data-testid="row-dow">
              {"SMTWTFS".split("").map((d, i) => (
                <div key={i} className="px-3 py-2" data-testid={`dow-${i}`}>{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7" data-testid="grid-days">
              {days.map((d, idx) => {
                const inMonth = d.date.getMonth() === month.getMonth();
                return (
                  <div
                    key={idx}
                    className="h-16 border-b border-border/60 border-r border-border/60 last:border-r-0 p-2"
                    data-testid={`day-${idx}`}
                  >
                    <div className={inMonth ? "text-sm font-semibold" : "text-sm text-muted-foreground"}>
                      {d.date.getDate()}
                    </div>
                    {d.count ? (
                      <div className="mt-1 text-[11px] text-primary" data-testid={`day-count-${idx}`}>
                        {d.count} booked
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-background overflow-hidden" data-testid="calendar-list">
            <div className="p-4 border-b border-border">
              <div className="font-semibold" data-testid="text-list-title">Appointments</div>
              <div className="text-xs text-muted-foreground" data-testid="text-list-sub">
                date • time • lead • status • calendar_link
              </div>
            </div>
            <div className="divide-y divide-border">
              {appts.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground" data-testid="empty-appts">No appointments.</div>
              ) : (
                appts.map((a) => (
                  <div key={a.id} className="p-4 flex items-center justify-between gap-4" data-testid={`row-appt-${a.id}`}>
                    <div className="min-w-0">
                      <div className="font-semibold truncate" data-testid={`text-appt-name-${a.id}`}>{a.lead_name}</div>
                      <div className="text-xs text-muted-foreground" data-testid={`text-appt-meta-${a.id}`}>
                        {a.date} • {a.time} • {a.status}
                      </div>
                    </div>
                    <a
                      href={a.calendar_link}
                      className="text-xs text-primary hover:underline"
                      target="_blank"
                      rel="noreferrer"
                      data-testid={`link-appt-${a.id}`}
                    >
                      calendar_link
                    </a>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="mt-3 text-xs text-muted-foreground" data-testid="text-real">
          REAL: derive appointments from Leads.booked_call_date + campaign calendar_link
        </div>
      </div>
    </CrmShell>
  );
}
