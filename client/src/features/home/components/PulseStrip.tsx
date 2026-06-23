import { HomeIcon, type HomeIconName } from "../icons";

export interface PulseItem {
  key: string;
  icon: HomeIconName;
  value: string;
  label: string;
}

function PulseStat({ item, divider }: { item: PulseItem; divider: boolean }) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        display: "flex",
        alignItems: "center",
        gap: 11,
        padding: "12px 16px",
        borderLeft: divider ? "1px solid var(--line)" : "none",
      }}
    >
      <span style={{ color: "var(--mute-2)", display: "flex", flexShrink: 0 }}>
        <HomeIcon name={item.icon} size={17} />
      </span>
      <div style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
        <span style={{ fontFamily: "var(--serif)", fontSize: 28, lineHeight: 1.05, color: "var(--wine)" }}>
          {item.value}
        </span>
        <span
          style={{
            fontFamily: "var(--mono)",
            fontSize: 8,
            letterSpacing: "0.09em",
            textTransform: "uppercase",
            color: "var(--mute)",
            lineHeight: 1.3,
            whiteSpace: "nowrap",
            marginTop: 2,
          }}
        >
          {item.label}
        </span>
      </div>
    </div>
  );
}

export function PulseStrip({ items }: { items: PulseItem[] }) {
  return (
    <div
      style={{
        display: "flex",
        background: "var(--card)",
        boxShadow: "var(--sh-raised-medium)",
        borderRadius: "var(--r-card)",
        padding: "3px 2px",
      }}
    >
      {items.map((item, i) => (
        <PulseStat key={item.key} item={item} divider={i > 0} />
      ))}
    </div>
  );
}
