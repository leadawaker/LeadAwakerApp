// BookAppointmentPopover.tsx — self-contained "book a lead" popover used by the
// redesigned desktop toolbar. Encapsulates its own form state + submit.
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { apiFetch } from "@/lib/apiUtils";

export function BookAppointmentPopover({
  leads,
  refetchLeads,
  trigger,
}: {
  leads: any[] | undefined;
  refetchLeads: () => void;
  trigger: React.ReactNode;
}) {
  const { t } = useTranslation("calendar");
  const [open, setOpen] = useState(false);
  const [leadSearch, setLeadSearch] = useState("");
  const [selectedLead, setSelectedLead] = useState<Record<string, any> | null>(null);
  const [date, setDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [time, setTime] = useState("10:00");
  const [duration, setDuration] = useState(60);
  const [submitting, setSubmitting] = useState(false);

  const filtered = useMemo(() => {
    if (!leadSearch.trim()) return [];
    const q = leadSearch.toLowerCase();
    return (leads || []).filter((l: any) => {
      const name = (l.full_name || `${l.first_name || ""} ${l.last_name || ""}`.trim() || "").toLowerCase();
      return name.includes(q);
    }).slice(0, 8) as Record<string, any>[];
  }, [leads, leadSearch]);

  const submit = async () => {
    if (!selectedLead || !date || !time) return;
    setSubmitting(true);
    try {
      const dt = new Date(`${date}T${time}`);
      await apiFetch(`/api/leads/${selectedLead.id || selectedLead.Id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          booked_call_date: dt.toISOString(),
          conversion_status: "Booked",
          call_duration_minutes: duration,
        }),
      });
      refetchLeads();
      setOpen(false);
      setSelectedLead(null);
      setLeadSearch("");
    } catch { /* surfaced via list not refreshing */ }
    setSubmitting(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-72 max-w-[calc(100vw-2rem)] p-0 overflow-hidden" align="end">
        <div className="px-3 pt-3 pb-2 border-b border-border/30">
          <h3 className="text-[13px] font-semibold font-heading">{t("book.title")}</h3>
        </div>
        <div className="p-3 space-y-2.5">
          <div className="relative">
            <input
              type="text"
              placeholder={t("search.searchLeadPlaceholder")}
              value={leadSearch}
              onChange={(e) => { setLeadSearch(e.target.value); setSelectedLead(null); }}
              className="w-full h-9 px-3 rounded-lg border border-border/55 bg-white text-[12px] placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-brand-indigo/30"
            />
            {leadSearch && !selectedLead && filtered.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border border-border/55 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                {filtered.map((l: any) => (
                  <button
                    key={l.id || l.Id}
                    className="w-full px-3 py-2 text-left text-[12px] hover:bg-white flex items-center gap-2"
                    onClick={() => { setSelectedLead(l); setLeadSearch(l.full_name || `${l.first_name || ""} ${l.last_name || ""}`.trim()); }}
                  >
                    <span className="truncate">{l.full_name || `${l.first_name || ""} ${l.last_name || ""}`.trim() || t("appointment.unknownLead")}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="flex-1 h-9 px-2 rounded-lg border border-border/55 bg-white text-[12px] focus:outline-none focus:ring-2 focus:ring-brand-indigo/30" />
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
              className="w-24 h-9 px-2 rounded-lg border border-border/55 bg-white text-[12px] focus:outline-none focus:ring-2 focus:ring-brand-indigo/30" />
          </div>
          <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}
            className="w-full h-9 px-2 rounded-lg border border-border/55 bg-white text-[12px] focus:outline-none cursor-pointer">
            {[30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{t("appointment.minutes", { count: m })}</option>)}
          </select>
          <button
            onClick={submit}
            disabled={!selectedLead || !date || submitting}
            className="w-full h-9 rounded-full bg-brand-indigo text-white text-[12px] font-semibold hover:opacity-90 disabled:opacity-40 disabled:pointer-events-none"
          >
            {submitting ? t("book.booking") : t("book.bookAppointment")}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
