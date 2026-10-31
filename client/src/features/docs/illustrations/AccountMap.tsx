/**
 * A map of the Account page: the header with Request a change, the tab strip,
 * and what each tab holds.
 */

import { Building2, LayoutGrid, PhoneCall, MessageSquare, Plug, MessageSquarePlus } from "lucide-react";
import { Figure, type K } from "./parts";

const TABS = [
  { key: "overview", icon: LayoutGrid },
  { key: "phone", icon: PhoneCall },
  { key: "chat", icon: MessageSquare },
  { key: "integrations", icon: Plug },
] as const;

export function AccountMap({ k }: { k: K }) {
  const p = (key: string) => k(`illus.account.${key}`);
  return (
    <Figure caption={p("caption")} max={560}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <span className="shrink-0 h-8 w-8 rounded-full flex items-center justify-center" style={{ background: "var(--wine-tint)", color: "var(--wine)" }}>
          <Building2 className="h-4 w-4" />
        </span>
        <span className="flex-1 min-w-0 text-xs font-semibold truncate" style={{ color: "var(--ink)" }}>{p("title")}</span>
        <span
          className="shrink-0 inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold rounded-full"
          style={{ background: "var(--wine)", color: "var(--on-wine)" }}
        >
          <MessageSquarePlus className="h-3 w-3" />
          {p("request")}
        </span>
      </div>

      {/* Tab strip */}
      <div className="flex flex-wrap gap-1 p-1 mb-2" style={{ background: "var(--chrome-deep)", borderRadius: "var(--r-button)" }}>
        {TABS.map(({ key }, i) => (
          <span
            key={key}
            className="px-2 py-0.5 text-[10px] font-semibold"
            style={{
              borderRadius: "var(--r-button)",
              background: i === 0 ? "var(--card)" : "transparent",
              color: i === 0 ? "var(--wine)" : "var(--chrome-deep-ink)",
            }}
          >
            {p(key)}
          </span>
        ))}
      </div>

      {/* What each tab holds */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {TABS.map(({ key, icon: Icon }) => (
          <div
            key={key}
            className="flex items-start gap-2 px-2.5 py-2"
            style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-button)" }}
          >
            <Icon className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: "var(--wine)" }} />
            <span className="min-w-0">
              <span className="block text-[11px] font-semibold" style={{ color: "var(--ink)" }}>{p(key)}</span>
              <span className="block text-[10px] leading-snug" style={{ color: "var(--mute)" }}>{p(`${key}Sub`)}</span>
            </span>
          </div>
        ))}
        <div
          className="flex items-start gap-2 px-2.5 py-2"
          style={{ background: "var(--wine-tint)", border: "1px solid var(--line)", borderRadius: "var(--r-button)" }}
        >
          <MessageSquarePlus className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: "var(--wine)" }} />
          <span className="min-w-0">
            <span className="block text-[11px] font-semibold" style={{ color: "var(--ink)" }}>{p("request")}</span>
            <span className="block text-[10px] leading-snug" style={{ color: "var(--mute)" }}>{p("requestSub")}</span>
          </span>
        </div>
      </div>
      <p className="text-[10px] mt-2" style={{ color: "var(--mute)" }}>{p("note")}</p>
    </Figure>
  );
}
