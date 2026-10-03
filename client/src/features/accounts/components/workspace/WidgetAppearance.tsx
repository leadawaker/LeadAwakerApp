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

// Metal in other shades. Silver is the untinted default (null).
const SHADES: { key: string; hex: string | null }[] = [
  { key: "silver", hex: null },
  { key: "gold", hex: "#c9a24a" },
  { key: "copper", hex: "#b87333" },
  { key: "roseGold", hex: "#c48b84" },
  { key: "bronze", hex: "#8c6a3f" },
];

const HEX = /^#[0-9a-fA-F]{6}$/;

// A face photo, centre-cropped to a 256px square: small enough to live on the
// widget row as a data URL and to load instantly on a client's page.
function squarePhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 256;
      const ctx = canvas.getContext("2d");
      if (!ctx) { URL.revokeObjectURL(url); reject(new Error("canvas")); return; }
      ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, 256, 256);
      URL.revokeObjectURL(url);
      const webp = canvas.toDataURL("image/webp", 0.86);
      // Safari cannot encode WebP and quietly hands back a PNG; JPEG is smaller.
      resolve(webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/jpeg", 0.88));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("unreadable")); };
    img.src = url;
  });
}

function Swatch({ hex, label, on, onClick }: { hex: string | null; label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={on}
      onClick={onClick}
      style={{
        width: 30, height: 30, borderRadius: "50%", cursor: "pointer", padding: 0,
        border: on ? "2px solid var(--ink)" : "1px solid var(--line)",
        background: hex
          ? `conic-gradient(from 20deg, color-mix(in srgb, ${hex} 25%, #fff), ${hex} 30%, color-mix(in srgb, ${hex} 70%, #222) 55%, color-mix(in srgb, ${hex} 30%, #fff) 80%, color-mix(in srgb, ${hex} 25%, #fff))`
          : "conic-gradient(from 20deg, #fafafa, #a1a1aa 30%, #52525b 55%, #e4e4e7 80%, #fafafa)",
      }}
    />
  );
}

export function WidgetAppearance({ cfg, onPatch }: {
  cfg: WidgetConfigRow;
  onPatch: (body: Partial<WidgetConfigRow>) => Promise<void>;
}) {
  const { t } = useTranslation("accounts");
  const style = (cfg.orbStyle || "metal") as "metal" | "tinted" | "solid";
  const eyes = (cfg.orbEyes || "auto") as "auto" | "black" | "white";
  const face = (cfg.orbFace || "eyes") as "eyes" | "icon" | "photo";
  const rim = (cfg.orbRim || "metal") as "metal" | "pulse" | "band" | "none";
  const [rimColor, setRimColor] = useState(cfg.orbRimColor || "#a1a1aa");
  const tint = cfg.orbTint && HEX.test(cfg.orbTint) ? cfg.orbTint.toLowerCase() : null;
  const hasPhoto = !!cfg.avatarUrl && cfg.avatarUrl.startsWith("data:image/");
  const [color, setColor] = useState(cfg.accentColor || "#6B2737");
  const [customTint, setCustomTint] = useState(tint || "#9a7b4f");
  const [photoError, setPhotoError] = useState(false);
  // Bumped after every saved change: the preview is the real frame, and the
  // frame reads its look once, when it loads.
  const [previewRev, setPreviewRev] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { setColor(cfg.accentColor || "#6B2737"); }, [cfg.accentColor]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const save = async (body: Partial<WidgetConfigRow>) => {
    await onPatch(body);
    setPreviewRev((n) => n + 1);
  };

  // The native picker fires on every drag step; only the colour it settles on
  // is worth a save and a preview reload.
  const settle = (body: Partial<WidgetConfigRow>) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(body), 450);
  };
  const pickColor = (hex: string) => { setColor(hex); if (HEX.test(hex)) settle({ accentColor: hex }); };
  const pickTint = (hex: string) => { setCustomTint(hex); if (HEX.test(hex)) settle({ orbTint: hex }); };
  const pickRimColor = (hex: string) => { setRimColor(hex); if (HEX.test(hex)) settle({ orbRimColor: hex }); };

  const uploadPhoto = async (file: File) => {
    setPhotoError(false);
    try {
      const dataUrl = await squarePhoto(file);
      await save({ avatarUrl: dataUrl, orbFace: "photo" });
    } catch {
      setPhotoError(true);
    }
  };

  const presetTint = SHADES.some((sh) => sh.hex === tint);
  const label = (k: string) => <span style={MONO}>{t(`websiteChat.${k}`)}</span>;
  const col = { display: "flex", flexDirection: "column", gap: 6 } as const;

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
          <div style={col}>
            {label("orbFace")}
            <Segmented
              value={face}
              onChange={(v) => (v === "photo" && !hasPhoto ? fileRef.current?.click() : void save({ orbFace: v }))}
              options={[
                { value: "eyes", label: t("websiteChat.faceEyes") },
                { value: "icon", label: t("websiteChat.faceIcon") },
                { value: "photo", label: t("websiteChat.facePhoto") },
              ]}
            />
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void uploadPhoto(f); }}
            />
            {face === "photo" && (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {hasPhoto && <img src={cfg.avatarUrl || ""} alt="" style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover" }} />}
                <button type="button" className="la-btn" onClick={() => fileRef.current?.click()}>
                  {t(hasPhoto ? "websiteChat.photoReplace" : "websiteChat.photoUpload")}
                </button>
              </div>
            )}
            {photoError && <span style={{ fontSize: 11, color: "var(--danger, #B3261E)" }}>{t("websiteChat.photoFailed")}</span>}
          </div>

          {face !== "photo" && (
            <>
              <div style={col}>
                {label("orbStyle")}
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

              {style === "metal" ? (
                <div style={col}>
                  {label("orbShade")}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    {SHADES.map((sh) => (
                      <Swatch key={sh.key} hex={sh.hex} label={t(`websiteChat.shade_${sh.key}`)} on={tint === sh.hex}
                        onClick={() => void save({ orbTint: sh.hex })} />
                    ))}
                    <label title={t("websiteChat.shade_custom")} style={{ position: "relative", display: "inline-flex" }}>
                      <Swatch hex={customTint} label={t("websiteChat.shade_custom")} on={!!tint && !presetTint} onClick={() => {}} />
                      <input
                        type="color"
                        value={customTint}
                        onChange={(e) => pickTint(e.target.value)}
                        style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }}
                      />
                    </label>
                  </div>
                </div>
              ) : (
                <div style={col}>
                  {label("orbColor")}
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => pickColor(e.target.value)}
                      style={{ width: 40, height: 32, padding: 0, border: "1px solid var(--line)", borderRadius: "var(--r-button)", background: "var(--card)", cursor: "pointer" }}
                    />
                    <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink-soft)" }}>{color.toUpperCase()}</span>
                  </div>
                </div>
              )}

              <div style={col}>
                {label(face === "icon" ? "orbIconColor" : "orbEyes")}
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
            </>
          )}

          <div style={col}>
            {label("orbRim")}
            <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              {/* The launcher itself, live: the chat preview beside it never
                  shows the button, and the rim only exists there. */}
              <iframe
                key={`launch-${previewRev}`}
                title={t("websiteChat.orbRim")}
                src={`/widget/launcher-preview?key=${encodeURIComponent(cfg.publicKey)}`}
                style={{ width: 112, height: 112, border: "1px solid var(--line)", borderRadius: 16, background: "var(--card)", flexShrink: 0 }}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <Segmented
                  value={rim}
                  onChange={(v) => void save({ orbRim: v })}
                  options={[
                    { value: "metal", label: t("websiteChat.rimMetal") },
                    { value: "pulse", label: t("websiteChat.rimPulse") },
                    { value: "band", label: t("websiteChat.rimBand") },
                    { value: "none", label: t("websiteChat.rimNone") },
                  ]}
                />
                {(rim === "pulse" || rim === "band") && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <input
                      type="color"
                      value={rimColor}
                      onChange={(e) => pickRimColor(e.target.value)}
                      style={{ width: 40, height: 32, padding: 0, border: "1px solid var(--line)", borderRadius: "var(--r-button)", background: "var(--card)", cursor: "pointer" }}
                    />
                    <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink-soft)" }}>{rimColor.toUpperCase()}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
