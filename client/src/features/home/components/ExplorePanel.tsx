import { HomeIcon } from "../icons";
import { UPSELL } from "../data";

export interface ExploreUpsellItem {
  key: string;
  name: string;
  blurb: string;
}

/**
 * Explore-services panel — the dashed 4th cell beside the live service cards.
 * Faithful port of the mockup's `ExplorePanel`: a plus badge, "Explore services"
 * heading + blurb, then one add-this-service tile per not-yet-enabled service.
 */
export function ExplorePanel({
  title,
  blurb,
  addLabel,
  items,
  onAdd,
}: {
  title: string;
  blurb: string;
  addLabel: string;
  items: ExploreUpsellItem[];
  onAdd?: (key: string) => void;
}) {
  return (
    <div
      className="home-card"
      style={{
        borderRadius: "var(--r-card)",
        padding: 24,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        background: "transparent",
        border: "1.5px dashed var(--wine-glow)",
        minWidth: 0,
      }}
      data-testid="home-explore"
    >
      <span
        style={{
          width: 56,
          height: 56,
          borderRadius: "var(--r-pill)",
          flexShrink: 0,
          border: "1.5px dashed var(--wine)",
          color: "var(--wine)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <HomeIcon name="plus" size={24} sw={1.8} />
      </span>
      <div
        style={{
          fontFamily: "var(--serif)",
          fontSize: 24,
          color: "var(--ink)",
          marginTop: 16,
          lineHeight: 1.1,
          letterSpacing: "-0.01em",
          textAlign: "center",
        }}
      >
        {title}
      </div>
      <p style={{ fontSize: 12.5, color: "var(--mute)", margin: "8px 0 0", lineHeight: 1.5, textAlign: "center" }}>{blurb}</p>

      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 16, marginTop: "auto", paddingTop: 22 }}>
        {items.map((u, i) => {
          const cfg = UPSELL[i];
          return (
            <div key={u.key} style={{ width: "100%" }}>
              <div className="row" style={{ gap: 8, alignItems: "center" }}>
                {cfg && (
                  <span style={{ color: "var(--wine)", display: "flex", flexShrink: 0 }}>
                    <HomeIcon name={cfg.icon} size={15} />
                  </span>
                )}
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{u.name}</span>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--mute)", margin: "4px 0 10px", lineHeight: 1.4 }}>{u.blurb}</div>
              <button
                type="button"
                onClick={() => onAdd?.(u.key)}
                className="home-addbtn row"
                style={{
                  width: "100%",
                  gap: 8,
                  padding: "9px 12px",
                  borderRadius: "var(--r-button)",
                  cursor: "pointer",
                  border: "1px solid var(--wine)",
                  background: "transparent",
                  color: "var(--wine)",
                  justifyContent: "center",
                  fontFamily: "var(--mono)",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  transition: "background 120ms",
                }}
              >
                {addLabel} <HomeIcon name="arrow" size={13} sw={2} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
