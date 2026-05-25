// Dev-only: CTA wood + shine debug panel — adjustments persist in localStorage.

const CTA_TEX_KEY = "cta_texture_adjustments";

const CTA_TEX_DEFAULTS = {
  wood:  { scale: 1.4, tx: 50, ty: 70, rot: 0, flipX: false, brightness: 0.35 },
  shine: { scale: 1.0, tx: 35, ty: 35, rot: 0, flipX: false, brightness: 0.95 },
};

function loadCtaTexAdjustments() {
  try {
    const stored = JSON.parse(localStorage.getItem(CTA_TEX_KEY)) || {};
    return {
      wood:  { ...CTA_TEX_DEFAULTS.wood,  ...(stored.wood  || {}) },
      shine: { ...CTA_TEX_DEFAULTS.shine, ...(stored.shine || {}) },
    };
  } catch { return { ...CTA_TEX_DEFAULTS }; }
}
function saveCtaTexAdjustments(data) {
  try { localStorage.setItem(CTA_TEX_KEY, JSON.stringify(data)); } catch {}
}

function CtaTextureDebug({ adjustments, onUpdate }) {
  const [collapsed, setCollapsed] = React.useState(false);

  const SECTIONS = [
    { key: "wood",  label: "WOOD" },
    { key: "shine", label: "SHINE" },
  ];
  const SLIDERS = [
    { field: "scale",      label: "S", min: 0.2,  max: 4,    step: 0.05, unit: "×" },
    { field: "tx",         label: "X", min: -200, max: 200,  step: 1,    unit: "%" },
    { field: "ty",         label: "Y", min: -200, max: 200,  step: 1,    unit: "%" },
    { field: "rot",        label: "R", min: 0,    max: 360,  step: 1,    unit: "°" },
    { field: "brightness", label: "B", min: 0,    max: 2,    step: 0.01, unit: "" },
  ];

  function reset(sectionKey) {
    Object.entries(CTA_TEX_DEFAULTS[sectionKey]).forEach(([f, v]) => onUpdate(sectionKey, f, v));
  }

  return (
    <div style={{
      position: "fixed", top: 24, right: 24, zIndex: 9999,
      background: "var(--surface, #FAF9F7)",
      border: "1px solid var(--border, rgba(0,0,0,0.12))",
      borderRadius: 8, padding: collapsed ? "6px 10px" : "8px 10px",
      width: collapsed ? "auto" : 240,
      fontSize: 10, fontFamily: "var(--mono, monospace)",
      boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: collapsed ? 0 : 6 }}>
        <strong style={{ color: "var(--ink, #29261b)", letterSpacing: "0.08em", textTransform: "uppercase", fontSize: 9 }}>CTA</strong>
        <button onClick={() => setCollapsed(c => !c)} style={{
          fontSize: 9, color: "var(--mute, #29261b99)", background: "none",
          border: "1px solid var(--border, rgba(0,0,0,0.12))", borderRadius: 3,
          padding: "1px 6px", cursor: "pointer",
        }}>{collapsed ? "+" : "–"}</button>
      </div>

      {!collapsed && SECTIONS.map(({ key, label }) => (
        <div key={key} style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <span style={{ color: "var(--mute, #29261b99)", letterSpacing: "0.08em" }}>
              <strong style={{ color: "var(--ink, #29261b)" }}>{label}</strong>
            </span>
            <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
              <label style={{ display: "inline-flex", gap: 4, alignItems: "center", cursor: "pointer", fontSize: 9, color: "var(--mute, #29261b99)" }}>
                <input
                  type="checkbox"
                  checked={adjustments[key].flipX}
                  onChange={(e) => onUpdate(key, "flipX", e.target.checked)}
                  style={{ margin: 0, width: 11, height: 11 }}
                />
                flip
              </label>
              <button onClick={() => reset(key)} style={{
                fontSize: 9, color: "var(--mute, #29261b99)", background: "none",
                border: "1px solid var(--border, rgba(0,0,0,0.12))", borderRadius: 3,
                padding: "1px 6px", cursor: "pointer",
              }}>reset</button>
            </span>
          </div>
          {SLIDERS.map(({ field, label: sLabel, min, max, step, unit }) => (
            <div key={field} style={{ display: "grid", gridTemplateColumns: "10px 1fr 44px", gap: 6, alignItems: "center", marginBottom: 3 }}>
              <span style={{ color: "var(--mute, #29261b99)" }}>{sLabel}</span>
              <input
                type="range" min={min} max={max} step={step}
                value={adjustments[key][field]}
                onChange={(e) => onUpdate(key, field, parseFloat(e.target.value))}
                style={{ width: "100%", accentColor: "var(--wine, #7A2E3E)", cursor: "pointer", height: 3 }}
              />
              <span style={{ color: "var(--ink, #29261b)", textAlign: "right" }}>
                {Number.isInteger(adjustments[key][field]) ? adjustments[key][field] : adjustments[key][field].toFixed(2)}{unit}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
