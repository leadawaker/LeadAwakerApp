// The website assistant's look, edited beside the live preview of it. The orb
// (her face) can stay liquid metal, swirl the client's colour, or be painted in
// it flat; the eyes follow automatically or are forced black/white. Saved on the
// widget row, so the client's install snippet never changes.
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { WidgetConfigRow } from "../../api/widgetApi";

const MONO = {
  fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.14em",
  textTransform: "uppercase", color: "var(--mute-2)",
} as const;

function Segmented<T extends string>({ value, options, onChange, disabled }: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div style={{ display: "inline-flex", alignSelf: "flex-start", padding: 3, gap: 2, borderRadius: "var(--r-button)", background: "var(--card)", border: "1px solid var(--line)", opacity: disabled ? 0.5 : 1 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            disabled={disabled}
            onClick={() => !on && onChange(o.value)}
            style={{
              border: 0, cursor: disabled ? "default" : "pointer", padding: "6px 11px", fontSize: 12, fontWeight: 500,
              borderRadius: "calc(var(--r-button) - 2px)",
              background: on ? "var(--ink)" : "transparent",
              color: on ? "var(--paper)" : "var(--ink-soft)",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function WidgetAppearance({ cfg, onPatch }: {
  cfg: WidgetConfigRow;
  onPatch: (body: Partial<WidgetConfigRow>) => Promise<void>;
}) {
  const { t } = useTranslation("accounts");
  const style = (cfg.orbStyle || "metal") as "metal" | "tinted" | "solid";
  const eyes = (cfg.orbEyes || "auto") as "auto" | "black" | "white";
  const [color, setColor] = useState(cfg.accentColor || "#6B2737");
  // Bumped after every saved change: the preview is the real frame, and the
  // frame reads its look once, when it loads.
  const [previewRev, setPreviewRev] = useState(0);
  const colorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setColor(cfg.accentColor || "#6B2737"); }, [cfg.accentColor]);
  useEffect(() => () => { if (colorTimer.current) clearTimeout(colorTimer.current); }, []);

  const save = async (body: Partial<WidgetConfigRow>) => {
    await onPatch(body);
    setPreviewRev((n) => n + 1);
  };

  // The native picker fires on every drag step; only the colour it settles on
  // is worth a save and a preview reload.
  const pickColor = (hex: string) => {
    setColor(hex);
    if (colorTimer.current) clearTimeout(colorTimer.current);
    colorTimer.current = setTimeout(() => {
      if (/^#[0-9a-fA-F]{6}$/.test(hex)) void save({ accentColor: hex });
    }, 450);
  };

  return (
    <div>
      <span style={MONO}>{t("websiteChat.appearance")}</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 18, marginTop: 6, alignItems: "flex-start" }}>
        <iframe
          key={previewRev}
          title={t("websiteChat.preview")}
          src={`/widget/frame?key=${encodeURIComponent(cfg.publicKey)}#v=preview0000preview00`}
          allow="microphone"
          style={{ display: "block", flex: "1 1 300px", maxWidth: 390, height: 520, border: "1px solid var(--line)", borderRadius: 20, background: "var(--card)" }}
        />
        <div style={{ flex: "1 1 220px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={MONO}>{t("websiteChat.orbStyle")}</span>
            <Segmented
              value={style}
              onChange={(v) => void save({ orbStyle: v })}
              options={[
                { value: "metal", label: t("websiteChat.orbMetal") },
                { value: "tinted", label: t("websiteChat.orbTinted") },
                { value: "solid", label: t("websiteChat.orbSolid") },
              ]}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={MONO}>{t("websiteChat.orbColor")}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 10, opacity: style === "metal" ? 0.5 : 1 }}>
              <input
                type="color"
                value={color}
                disabled={style === "metal"}
                onChange={(e) => pickColor(e.target.value)}
                style={{ width: 40, height: 32, padding: 0, border: "1px solid var(--line)", borderRadius: "var(--r-button)", background: "var(--card)", cursor: style === "metal" ? "default" : "pointer" }}
              />
              <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink-soft)" }}>{color.toUpperCase()}</span>
            </div>
            {style === "metal" && <span style={{ fontSize: 11, color: "var(--mute-2)" }}>{t("websiteChat.orbColorHint")}</span>}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={MONO}>{t("websiteChat.orbEyes")}</span>
            <Segmented
              value={eyes}
              onChange={(v) => void save({ orbEyes: v })}
              options={[
                { value: "auto", label: t("websiteChat.eyesAuto") },
                { value: "black", label: t("websiteChat.eyesBlack") },
                { value: "white", label: t("websiteChat.eyesWhite") },
              ]}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
