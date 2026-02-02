import { useMemo, useState, useEffect } from "react";
import { CrmShell } from "@/components/crm/CrmShell";
import { useWorkspace } from "@/hooks/useWorkspace";
import { leads } from "@/data/mocks";
import { FiltersBar } from "@/components/crm/FiltersBar";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const FULL_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function formatDate(date: Date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = MONTHS[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} - ${year}`;
}

type ViewMode = "month" | "week" | "day";

export default function CalendarPage() {
  const { currentAccountId } = useWorkspace();
  const [campaignId, setCampaignId] = useState<number | "all">("all");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const todayStr = new Date().toLocaleDateString();

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
          formattedDate: formatDate(d),
          time: d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          hour: d.getHours(),
          minutes: d.getMinutes(),
          status: l.conversion_status,
          calendar_link: "https://cal.example.com/leadawaker",
        };
      })
      .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  }, [currentAccountId, campaignId]);

  const [anchorDate, setAnchorDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  });

  const month = useMemo(() => new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1), [anchorDate]);

  const days = useMemo(() => {
    const year = month.getFullYear();
    const m = month.getMonth();
    const first = new Date(year, m, 1);
    const startDow = (first.getDay() + 6) % 7; 
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

  const weekDays = useMemo(() => {
    const startOfWeek = new Date(anchorDate);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);

    const out = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      out.push(d);
    }
    return out;
  }, [anchorDate]);

  const appointmentsForSelectedDate = useMemo(() => {
    if (!selectedDate) return [];
    return appts.filter((a) => a.date === selectedDate);
  }, [selectedDate, appts]);

  const handleDateClick = (dateStr: string) => {
    setSelectedDate(prev => prev === dateStr ? null : dateStr);
  };

  const navigate = (direction: number) => {
    const next = new Date(anchorDate);
    if (viewMode === "month") {
      next.setMonth(anchorDate.getMonth() + direction);
    } else if (viewMode === "week") {
      next.setDate(anchorDate.getDate() + (direction * 7));
    } else {
      next.setDate(anchorDate.getDate() + direction);
    }
    setAnchorDate(next);
  };

  const viewLabel = useMemo(() => {
    if (viewMode === "month") return `${FULL_MONTHS[anchorDate.getMonth()]} ${anchorDate.getFullYear()}`;
    if (viewMode === "week") {
      const start = weekDays[0];
      const end = weekDays[6];
      return `${MONTHS[start.getMonth()]} ${start.getDate()} - ${end.getDate()}, ${end.getFullYear()}`;
    }
    return `${FULL_MONTHS[anchorDate.getMonth()]} ${anchorDate.getDate()}, ${anchorDate.getFullYear()}`;
  }, [viewMode, anchorDate, weekDays]);

  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <CrmShell>
      <div className="h-full flex flex-col px-6 py-6 overflow-hidden" data-testid="page-calendar">
        <div className="flex items-center gap-4 mb-6 shrink-0">
          <h1 className="text-2xl font-extrabold tracking-tight" data-testid="text-title">Calendar</h1>
          <FiltersBar selectedCampaignId={campaignId} setSelectedCampaignId={setCampaignId} />
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-6" data-testid="layout-calendar">
          <div className="rounded-2xl border border-border bg-background overflow-hidden flex flex-col h-full" data-testid="calendar-main">
            <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4">
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild>
                    <button className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border bg-muted/20 hover:bg-muted/30 text-sm font-semibold transition-colors uppercase tracking-wider" data-testid="button-view-mode">
                      <span className="capitalize">{viewMode}</span> View <ChevronDown className="h-4 w-4" />
                    </button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content className="z-[100] min-w-[160px] bg-background border border-border rounded-xl shadow-xl p-1" sideOffset={5}>
                      {(["month", "week", "day"] as ViewMode[]).map((mode) => (
                        <DropdownMenu.Item
                          key={mode}
                          className="flex items-center px-3 py-2 text-sm font-medium rounded-lg cursor-pointer hover:bg-muted/50 outline-none"
                          onClick={() => setViewMode(mode)}
                        >
                          <span className="capitalize">{mode}</span> View
                        </DropdownMenu.Item>
                      ))}
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>

                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border bg-muted/20">
                  <button
                    className="h-6 w-6 rounded-lg hover:bg-muted/30 flex items-center justify-center transition-colors"
                    onClick={() => navigate(-1)}
                    data-testid="button-prev"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <div className="font-bold text-sm min-w-[140px] text-center" data-testid="text-view-label">
                    {viewLabel}
                  </div>
                  <button
                    className="h-6 w-6 rounded-lg hover:bg-muted/30 flex items-center justify-center transition-colors"
                    onClick={() => navigate(1)}
                    data-testid="button-next"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {viewMode === "month" && (
              <>
                <div className="grid grid-cols-7 text-xs text-center font-bold text-muted-foreground border-b border-border bg-muted/5 shrink-0" data-testid="row-dow">
                  {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((d, i) => (
                    <div key={i} className={cn("px-3 py-3", (i >= 5) && "bg-muted/10 opacity-70")} data-testid={`dow-${i}`}>{d}</div>
                  ))}
                </div>
                <div className="flex-1 grid grid-cols-7 overflow-y-auto" data-testid="grid-days">
                  {days.map((d, idx) => {
                    const inMonth = d.date.getMonth() === month.getMonth();
                    const isToday = d.date.toLocaleDateString() === todayStr;
                    const isSelected = selectedDate === d.date.toLocaleDateString();
                    const isWeekend = d.date.getDay() === 0 || d.date.getDay() === 6;
                    return (
                      <div
                        key={idx}
                        onClick={() => handleDateClick(d.date.toLocaleDateString())}
                        className={cn(
                          "min-h-[100px] border-b border-r border-border/60 last:border-r-0 p-2 cursor-pointer transition-colors hover:bg-muted/30 relative",
                          !inMonth && "bg-muted/5 opacity-40",
                          isWeekend && inMonth && "bg-muted/10 opacity-80",
                          isSelected && "bg-primary/5 ring-2 ring-inset ring-primary z-10",
                          isToday && !isSelected && "bg-primary/5"
                        )}
                        data-testid={`day-${idx}`}
                      >
                        <div className="flex justify-between items-start">
                          <div className={cn(
                            "text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full", 
                            isToday ? "text-primary bg-primary/10" : inMonth ? "text-foreground" : "text-muted-foreground"
                          )}>
                            {d.date.getDate()}
                          </div>
                        </div>
                        {d.count > 0 && (
                          <div className="flex justify-center mt-2">
                            <div className="h-6 w-6 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shadow-sm">
                              {d.count}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {(viewMode === "week" || viewMode === "day") && (
              <div className="flex-1 overflow-y-auto relative flex" data-testid="grid-time">
                <div className="w-16 border-r border-border bg-muted/5 flex flex-col shrink-0">
                  <div className="h-[65px] border-b border-border sticky top-0 bg-background/95 z-30" />
                  {hours.map(h => (
                    <div key={h} className="h-20 border-b border-border/50 text-[10px] font-bold text-muted-foreground p-2 text-right">
                      {h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h-12} PM`}
                    </div>
                  ))}
                </div>
                <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${viewMode === "week" ? 7 : 1}, 1fr)` }}>
                  {(viewMode === "week" ? weekDays : [anchorDate]).map((d, i) => {
                    const isToday = d.toLocaleDateString() === todayStr;
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                    return (
                      <div key={i} className={cn("relative border-r border-border/50 last:border-r-0", isWeekend && "bg-muted/5")}>
                        <div className={cn("sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border p-2 text-center h-[65px] flex flex-col justify-center", isToday && "bg-primary/5")}>
                          <div className="text-[10px] font-bold text-muted-foreground uppercase">{MONTHS[d.getMonth()]}</div>
                          <div className={cn("text-lg font-black", isToday ? "text-primary" : "text-foreground")}>{d.getDate()}</div>
                        </div>
                        <div className="relative h-[1920px]">
                          {hours.map(h => <div key={h} className="h-20 border-b border-border/30" />)}
                          {isToday && (
                            <div 
                              className="absolute left-0 right-0 border-t-2 border-red-500 z-30 pointer-events-none"
                              style={{ top: `${(currentTime.getHours() * 60 + currentTime.getMinutes()) * (80/60)}px` }}
                            >
                              <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 -mt-[5px]" />
                            </div>
                          )}
                          {appts.filter(a => a.date === d.toLocaleDateString()).map(a => (
                            <div 
                              key={a.id}
                              className="absolute left-1 right-1 p-2 rounded-lg bg-blue-100 border-l-4 border-blue-600 shadow-sm z-10"
                              style={{ top: `${(a.hour * 60 + a.minutes) * (80/60)}px`, height: '60px' }}
                            >
                              <div className="text-[10px] font-bold text-blue-900 truncate">{a.lead_name}</div>
                              <div className="text-[9px] font-medium text-blue-700">{a.time}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-background flex flex-col overflow-hidden h-full" data-testid="calendar-list">
            <div className="p-4 border-b border-border bg-muted/5 shrink-0">
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
                          <span className="text-[10px] text-muted-foreground font-medium">{a.formattedDate}</span>
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
