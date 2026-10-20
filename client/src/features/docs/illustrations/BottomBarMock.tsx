/**
 * Phone mock of the client bottom bar (Home, Calls, Calendar, Chats, More),
 * with the More page open to show that Leads and Account live there.
 */

import { Home, PhoneCall, CalendarDays, MessageSquare, Menu, Building2, Users, BookOpen, LifeBuoy, ChevronRight } from "lucide-react";
import { Figure, MockRow, PhoneFrame, type K } from "./parts";

const BAR = [
  { key: "home", icon: Home },
  { key: "calls", icon: PhoneCall },
  { key: "calendar", icon: CalendarDays },
  { key: "chats", icon: MessageSquare },
  { key: "more", icon: Menu },
] as const;

const MORE_ROWS = [
  { key: "account", icon: Building2 },
  { key: "leads", icon: Users },
  { key: "docs", icon: BookOpen },
  { key: "help", icon: LifeBuoy },
] as const;

export function BottomBarMock({ k }: { k: K }) {
  const p = (key: string) => k(`illus.bar.${key}`);
  return (
    <Figure caption={p("caption")} max={320}>
      <PhoneFrame max={280}>
        {/* More page */}
        <div className="px-3 pt-1 pb-3 space-y-1.5" style={{ background: "var(--chrome-deep)" }}>
          <p className="text-[11px] font-semibold uppercase tracking-wide pb-0.5" style={{ color: "var(--chrome-deep-ink)" }}>
            {p("more")}
          </p>
          {MORE_ROWS.map(({ key, icon: Icon }) => (
            <MockRow key={key}>
              <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--wine)" }} />
              <span className="flex-1 text-[11px] font-medium" style={{ color: "var(--ink)" }}>{p(key)}</span>
              <ChevronRight className="h-3 w-3" style={{ color: "var(--mute-2)" }} />
            </MockRow>
          ))}
        </div>
        {/* Bottom bar */}
        <div
          className="grid grid-cols-5 gap-0.5 px-1.5 py-1.5"
          style={{ background: "var(--chrome-deep)", borderTop: "1px solid var(--line-strong)" }}
        >
          {BAR.map(({ key, icon: Icon }) => {
            const on = key === "more";
            return (
              <div
                key={key}
                className="flex flex-col items-center gap-0.5 py-1 rounded-full min-w-0"
                style={on ? { background: "var(--wine)", color: "var(--on-wine)" } : { color: "var(--chrome-deep-ink)" }}
              >
                <Icon className="h-4 w-4" />
                <span className="text-[9px] font-medium leading-none truncate max-w-full">{p(key)}</span>
              </div>
            );
          })}
        </div>
      </PhoneFrame>
    </Figure>
  );
}
