import { HomeIcon, type HomeIconName } from "../icons";
import { SectionLabel } from "./atoms";

const CARD = {
  background: "var(--card)",
  boxShadow: "var(--sh-raised-medium)",
  borderRadius: "var(--r-card)",
  minWidth: 0,
} as const;

/* ── Recent activity feed ──────────────────────────────────────────── */

export interface ActivityRowItem {
  id: number;
  icon: HomeIconName;
  color: string;
  svcName: string;
  title: string;
  meta: string;
  time: string;
}

function ActivityRow({ item, last }: { item: ActivityRowItem; last: boolean }) {
  return (
    <div
      className="home-act-row row"
      style={{ gap: 13, padding: "12px 8px", borderBottom: last ? "none" : "1px solid var(--line)", borderRadius: "var(--r-surface)" }}
    >
      <span
        style={{
          width: 34,
          height: 34,
          flexShrink: 0,
          borderRadius: "var(--r-surface)",
          background: "var(--surface)",
          boxShadow: "var(--sh-inset-crisp)",
          color: item.color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <HomeIcon name={item.icon} size={16} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {item.title}
        </div>
        <div style={{ fontSize: 12, color: "var(--mute)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {item.meta}
        </div>
      </div>
      <div className="hidden md:flex" style={{ width: 100, flexShrink: 0 }}>
        <span className="home-tag" style={{ color: item.color }}>{item.svcName}</span>
      </div>
      <span
        style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--mute-2)", whiteSpace: "nowrap", width: 50, textAlign: "right", flexShrink: 0 }}
      >
        {item.time}
      </span>
    </div>
  );
}

export function ActivityFeed({ title, allServicesLabel, items }: { title: string; allServicesLabel: string; items: ActivityRowItem[] }) {
  return (
    <div style={{ ...CARD, padding: "18px 16px", display: "flex", flexDirection: "column" }}>
      <SectionLabel
        text={title}
        style={{ padding: "0 8px" }}
        right={
          <span className="row" style={{ gap: 6, fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mute)" }}>
            {allServicesLabel} <HomeIcon name="arrow" size={11} />
          </span>
        }
      />
      {items.map((item, i) => (
        <ActivityRow key={item.id} item={item} last={i === items.length - 1} />
      ))}
    </div>
  );
}

/* ── Quick actions ─────────────────────────────────────────────────── */

export interface QuickActionItem {
  key: string;
  label: string;
  icon: HomeIconName;
  onClick: () => void;
}

export function QuickActions({ title, items }: { title: string; items: QuickActionItem[] }) {
  return (
    <div style={{ ...CARD, padding: "18px 20px" }}>
      <SectionLabel text={title} />
      <div className="row" style={{ gap: 16, alignItems: "stretch" }}>
        {items.map((q) => (
          <button
            key={q.key}
            type="button"
            onClick={q.onClick}
            className="home-quick"
            style={{
              flex: 1,
              border: "none",
              cursor: "pointer",
              background: "var(--card)",
              boxShadow: "var(--sh-raised-crisp)",
              borderRadius: "var(--r-card)",
              padding: "24px 16px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
            }}
            data-testid={`home-quick-${q.key}`}
          >
            <span style={{ color: "var(--wine)" }}>
              <HomeIcon name={q.icon} size={26} sw={1.5} />
            </span>
            <span style={{ fontFamily: "var(--sans)", fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{q.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
