import { HomeIcon, type HomeIconName } from "../icons";
import type { DeltaDir } from "../data";
import { Sparkline } from "./Sparkline";
import { Delta } from "./atoms";

export interface NorthStarCellProps {
  name: string;
  icon: HomeIconName;
  color: string;
  /** Mascot illustration src; when absent an icon badge fills the slot. */
  mascot?: string;
  northLabel: string;
  northValue: string;
  northSuffix?: string;
  northValueIcon?: HomeIconName;
  deltaText: string;
  deltaDir: DeltaDir;
  support: { label: string; value: string }[];
  spark: number[];
  openLabel: string;
  onOpen?: () => void;
}

/**
 * Editorial north-star service card — faithful port of the mockup's
 * `NorthStarCell`. Clickable header (mascot or icon badge above the serif name),
 * big serif number + suffix + value icon, trend delta, full-width interactive
 * sparkline, support metrics with dividers, and a raised "Open" button pinned to
 * the bottom. The number renders in `--ink` to match the mockup's default.
 */
export function NorthStarCell(props: NorthStarCellProps) {
  const { name, icon, color, mascot, northLabel, northValue, northSuffix, northValueIcon, deltaText, deltaDir, support, spark, openLabel, onOpen } = props;

  const open = () => onOpen?.();
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      open();
    }
  };

  return (
    <div
      className="home-card"
      style={{
        background: "var(--card)",
        boxShadow: "var(--sh-raised-medium)",
        borderRadius: "var(--r-card)",
        minWidth: 0,
        padding: 24,
        display: "flex",
        flexDirection: "column",
      }}
      data-testid={`home-service-${name.toLowerCase().replace(/\s+/g, "-")}`}
    >
      {/* Clickable header — mascot (or icon badge) above the serif name */}
      <div
        className="home-nsopen"
        role="button"
        tabIndex={0}
        onClick={open}
        onKeyDown={onKey}
        title={`${openLabel} ${name}`}
        aria-label={`${openLabel} ${name}`}
        style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", cursor: "pointer", outline: "none" }}
      >
        {mascot ? (
          <img
            className="ns-mascot"
            src={mascot}
            alt=""
            style={{ height: 152, width: "auto", objectFit: "contain", objectPosition: "left bottom", display: "block", marginBottom: 12 }}
          />
        ) : (
          <span
            className="ns-mascot"
            style={{
              width: 96,
              height: 96,
              marginBottom: 16,
              borderRadius: "var(--r-card)",
              flexShrink: 0,
              background: `color-mix(in srgb, ${color} 12%, transparent)`,
              color,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <HomeIcon name={icon} size={44} sw={1.5} />
          </span>
        )}
        <div
          className="ns-name"
          style={{ fontFamily: "var(--serif)", fontSize: 28, color: "var(--ink)", lineHeight: 1.04, letterSpacing: "-0.01em" }}
        >
          {name}
        </div>
      </div>

      {/* North-star description */}
      <div className="eyebrow eyebrow-sm" style={{ color: "var(--mute-2)", marginTop: 22 }}>
        {northLabel}
      </div>

      {/* Big number + suffix + value icon */}
      <div className="row" style={{ alignItems: "flex-end", gap: 6, marginTop: 8 }}>
        <span style={{ fontFamily: "var(--serif)", fontSize: 80, lineHeight: 0.78, color: "var(--ink)", letterSpacing: "-0.02em" }}>
          {northValue}
        </span>
        {northSuffix && (
          <span style={{ fontFamily: "var(--serif)", fontSize: 34, lineHeight: 1, color, paddingBottom: 4 }}>{northSuffix}</span>
        )}
        {northValueIcon && (
          <span style={{ color, display: "flex", alignSelf: "flex-end", paddingBottom: 6 }}>
            <HomeIcon name={northValueIcon} size={28} sw={1.7} />
          </span>
        )}
      </div>

      {/* Trend */}
      <div style={{ marginTop: 10 }}>
        <Delta text={deltaText} dir={deltaDir} />
      </div>

      {/* Sparkline */}
      <div style={{ marginTop: 16 }}>
        <Sparkline pts={spark} color={color} width={260} height={62} strokeWidth={2} full dots interactive peak={parseFloat(northValue)} suffix={northSuffix || ""} />
      </div>

      {/* Support metrics — number above label, vertical divider between */}
      <div className="row" style={{ justifyContent: "flex-start", alignItems: "stretch", gap: 18, marginTop: 16 }}>
        {support.map((sup, i) => (
          <div key={sup.label} className="row" style={{ gap: 18 }}>
            {i > 0 && <div style={{ width: 1, background: "var(--line)", alignSelf: "stretch" }} />}
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 19, fontWeight: 700, color: "var(--ink-soft)" }}>{sup.value}</div>
              <div className="eyebrow eyebrow-sm" style={{ fontSize: 9, whiteSpace: "nowrap", marginTop: 4 }}>
                {sup.label}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Open — raised card pinned to the bottom */}
      <button
        type="button"
        onClick={open}
        className="home-openbtn row"
        style={{
          marginTop: "auto",
          width: "100%",
          justifyContent: "center",
          gap: 8,
          border: "none",
          cursor: "pointer",
          background: "var(--surface)",
          boxShadow: "var(--sh-raised-crisp)",
          borderRadius: "var(--r-card)",
          padding: 14,
          marginBlockStart: 18,
          fontFamily: "var(--mono)",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--wine)",
        }}
      >
        {openLabel} <HomeIcon name="arrow" size={14} sw={2} />
      </button>
    </div>
  );
}
