/**
 * The call flow: a call comes in, the receptionist answers, it ends booked,
 * as a callback or transferred, and the client gets an alert and the recap.
 */

import { PhoneIncoming, Headset, CalendarCheck, PhoneForwarded, PhoneOutgoing, BellRing, Mail } from "lucide-react";
import { Figure, OUTCOME_COLOR, type K, type Outcome } from "./parts";

const OUTCOMES: { key: Outcome; icon: React.ElementType }[] = [
  { key: "booked", icon: CalendarCheck },
  { key: "callback", icon: PhoneOutgoing },
  { key: "transferred", icon: PhoneForwarded },
];

function Node({ icon: Icon, title, sub, color = "var(--wine)", stacked = false }: {
  icon: React.ElementType; title: string; sub: string; color?: string; stacked?: boolean;
}) {
  return (
    <div
      className={`flex gap-2 py-2 min-w-0 h-full ${stacked ? "flex-col items-center text-center px-1.5" : "items-start px-2.5"}`}
      style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-button)" }}
    >
      <span
        className="shrink-0 h-6 w-6 rounded-full flex items-center justify-center"
        style={{ background: `color-mix(in srgb, ${color} 15%, transparent)`, color }}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] font-semibold leading-tight" style={{ color: "var(--ink)" }}>{title}</span>
        <span className="block text-[10px] leading-snug mt-0.5" style={{ color: "var(--mute)" }}>{sub}</span>
      </span>
    </div>
  );
}

/** Lines between the rows: one straight down, or fanning out to `to` columns. */
function Connector({ to = 1, from = 1 }: { to?: number; from?: number }) {
  const xs = (n: number) => Array.from({ length: n }, (_, i) => ((i + 0.5) / n) * 300);
  return (
    <svg viewBox="0 0 300 18" width="100%" height="18" preserveAspectRatio="none" aria-hidden className="block">
      {xs(from).flatMap((x1) =>
        xs(to).map((x2) => (
          <line
            key={`${x1}-${x2}`}
            x1={x1} y1={0} x2={x2} y2={18}
            stroke="var(--line-strong)" strokeWidth={1.5} vectorEffect="non-scaling-stroke"
          />
        )),
      )}
    </svg>
  );
}

export function CallFlow({ k }: { k: K }) {
  const p = (key: string) => k(`illus.flow.${key}`);
  return (
    <Figure caption={p("caption")}>
      <div className="mx-auto" style={{ maxWidth: 240 }}>
        <Node icon={PhoneIncoming} title={p("incoming")} sub={p("incomingSub")} color="var(--mute)" />
      </div>
      <Connector />
      <div className="mx-auto" style={{ maxWidth: 240 }}>
        <Node icon={Headset} title={p("answers")} sub={p("answersSub")} />
      </div>
      <Connector to={3} />
      <div className="grid grid-cols-3 gap-1.5">
        {OUTCOMES.map(({ key, icon }) => (
          <Node key={key} icon={icon} title={p(key)} sub={p(`${key}Sub`)} color={OUTCOME_COLOR[key]} stacked />
        ))}
      </div>
      <Connector from={3} to={2} />
      <div className="grid grid-cols-2 gap-1.5">
        <Node icon={BellRing} title={p("alert")} sub={p("alertSub")} color="var(--warn)" />
        <Node icon={Mail} title={p("recap")} sub={p("recapSub")} />
      </div>
    </Figure>
  );
}
