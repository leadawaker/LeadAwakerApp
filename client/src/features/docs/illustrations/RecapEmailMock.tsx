/**
 * A sample daily recap email: the day in figures, each call with its outcome
 * and an Open link, and the agenda for the week.
 */

import { Mail, ArrowRight, CalendarDays } from "lucide-react";
import { Figure, OutcomePill, type K, type Outcome } from "./parts";

const STATS = ["calls", "booked", "callbacks"] as const;
const STAT_VALUES: Record<(typeof STATS)[number], string> = { calls: "5", booked: "2", callbacks: "1" };

const CALLS: { n: string; outcome: Outcome; time: string }[] = [
  { n: "1", outcome: "booked", time: "09:12" },
  { n: "2", outcome: "callback", time: "11:40" },
  { n: "3", outcome: "transferred", time: "15:05" },
];

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 py-2.5" style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-button)" }}>
      {children}
    </div>
  );
}

export function RecapEmailMock({ k }: { k: K }) {
  const p = (key: string) => k(`illus.email.${key}`);
  return (
    <Figure caption={p("caption")}>
      {/* Inbox header */}
      <div className="flex items-center gap-2 pb-2 mb-2" style={{ borderBottom: "1px solid var(--line)" }}>
        <span className="shrink-0 h-7 w-7 rounded-full flex items-center justify-center" style={{ background: "var(--wine)", color: "var(--on-wine)" }}>
          <Mail className="h-3.5 w-3.5" />
        </span>
        <span className="min-w-0">
          <span className="block text-[11px] font-semibold truncate" style={{ color: "var(--ink)" }}>{p("subject")}</span>
          <span className="block text-[10px] truncate" style={{ color: "var(--mute)" }}>{p("from")}</span>
        </span>
      </div>

      <div className="space-y-2">
        <Card>
          <p className="text-[11px] mb-2" style={{ color: "var(--ink-soft)" }}>{p("greeting")}</p>
          <div className="grid grid-cols-3 gap-1.5 text-center">
            {STATS.map((s) => (
              <div key={s} className="py-1.5" style={{ background: "var(--bg)", borderRadius: "var(--r-button)" }}>
                <div className="text-sm font-bold" style={{ color: "var(--ink)" }}>{STAT_VALUES[s]}</div>
                <div className="text-[9px]" style={{ color: "var(--mute)" }}>{p(s)}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <p className="text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--mute)" }}>{p("callsTitle")}</p>
          <div className="space-y-1.5">
            {CALLS.map(({ n, outcome, time }) => (
              <div key={n} className="flex items-center gap-2 min-w-0">
                <span className="text-[10px] tabular-nums shrink-0" style={{ color: "var(--mute)" }}>{time}</span>
                <span className="flex-1 min-w-0 text-[11px] truncate" style={{ color: "var(--ink)" }}>{p(`call${n}`)}</span>
                <OutcomePill outcome={outcome}>{p(outcome)}</OutcomePill>
                <span className="shrink-0 inline-flex items-center gap-0.5 text-[10px] font-semibold" style={{ color: "var(--wine)" }}>
                  {p("open")}
                  <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <p className="text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--mute)" }}>{p("agendaTitle")}</p>
          <div className="flex items-center gap-2">
            <CalendarDays className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--good)" }} />
            <span className="text-[11px]" style={{ color: "var(--ink)" }}>{p("agenda1")}</span>
          </div>
        </Card>
      </div>
    </Figure>
  );
}
