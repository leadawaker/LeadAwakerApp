/**
 * The two tabs of the Calls page: Stats (the figures) and People (everyone
 * who called, one status each, "Needs you" when a callback waits).
 */

import { BarChart3, Users, PhoneCall, CalendarCheck, PhoneOutgoing } from "lucide-react";
import { Figure, MockRow, NeedsYou, OutcomePill, type K, type Outcome } from "./parts";

const BARS = [3, 5, 2, 6, 4, 7, 3];

const TILES = [
  { key: "calls", icon: PhoneCall, value: "24", color: "var(--wine)" },
  { key: "booked", icon: CalendarCheck, value: "6", color: "var(--good)" },
  { key: "callbacks", icon: PhoneOutgoing, value: "2", color: "var(--warn)" },
] as const;

const PEOPLE: { n: string; outcome: Outcome; needs?: boolean }[] = [
  { n: "1", outcome: "callback", needs: true },
  { n: "2", outcome: "booked" },
  { n: "3", outcome: "transferred" },
];

function Tabs({ active, p }: { active: "stats" | "people"; p: (key: string) => string }) {
  const tabs = [
    { key: "stats" as const, icon: BarChart3 },
    { key: "people" as const, icon: Users },
  ];
  return (
    <div className="grid grid-cols-2 gap-1 p-1 mb-2" style={{ background: "var(--chrome-deep)", borderRadius: "var(--r-button)" }}>
      {tabs.map(({ key, icon: Icon }) => (
        <span
          key={key}
          className="flex items-center justify-center gap-1 py-1 text-[10px] font-semibold"
          style={{
            borderRadius: "var(--r-button)",
            background: key === active ? "var(--card)" : "transparent",
            color: key === active ? "var(--wine)" : "var(--chrome-deep-ink)",
          }}
        >
          <Icon className="h-3 w-3" />
          {p(key)}
        </span>
      ))}
    </div>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-2 min-w-0" style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-button)" }}>
      {children}
    </div>
  );
}

function StatsScreen({ p }: { p: (key: string) => string }) {
  const max = Math.max(...BARS);
  return (
    <Screen>
      <Tabs active="stats" p={p} />
      <div className="grid grid-cols-3 gap-1">
        {TILES.map(({ key, icon: Icon, value, color }) => (
          <div key={key} className="px-1.5 py-1.5 min-w-0" style={{ background: "var(--card)", borderRadius: "var(--r-button)", border: "1px solid var(--line)" }}>
            <Icon className="h-3 w-3" style={{ color }} />
            <div className="text-sm font-bold leading-tight mt-0.5" style={{ color: "var(--ink)" }}>{value}</div>
            <div className="text-[9px] truncate" style={{ color: "var(--mute)" }}>{p(key)}</div>
          </div>
        ))}
      </div>
      <p className="text-[9px] mt-2 mb-1" style={{ color: "var(--mute)" }}>{p("week")}</p>
      <svg viewBox="0 0 140 40" width="100%" style={{ maxHeight: 56 }} aria-hidden className="block">
        {BARS.map((v, i) => {
          const h = (v / max) * 36;
          return <rect key={i} x={i * 20 + 4} y={40 - h} width={12} height={h} rx={2} fill="var(--wine)" opacity={i === BARS.length - 2 ? 1 : 0.45} />;
        })}
      </svg>
    </Screen>
  );
}

function PeopleScreen({ p }: { p: (key: string) => string }) {
  return (
    <Screen>
      <Tabs active="people" p={p} />
      <div className="space-y-1">
        {PEOPLE.map(({ n, outcome, needs }) => (
          <MockRow key={n} className="!px-2 !py-1.5">
            <span
              className="shrink-0 h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold"
              style={{ background: "var(--wine-tint)", color: "var(--wine)" }}
            >
              {p(`person${n}`).charAt(0)}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[10px] font-semibold truncate" style={{ color: "var(--ink)" }}>{p(`person${n}`)}</span>
              <span className="block text-[9px] truncate" style={{ color: "var(--mute)" }}>{p(`person${n}Meta`)}</span>
              {needs && <NeedsYou>{p("needsYou")}</NeedsYou>}
            </span>
            <OutcomePill outcome={outcome}>{p(outcome)}</OutcomePill>
          </MockRow>
        ))}
      </div>
    </Screen>
  );
}

export function CallsTabsMock({ k }: { k: K }) {
  const p = (key: string) => k(`illus.tabs.${key}`);
  return (
    <Figure caption={p("caption")} max={560}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <StatsScreen p={p} />
        <PeopleScreen p={p} />
      </div>
    </Figure>
  );
}
