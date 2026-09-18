// The widget demo's launcher colour, picked from the Demos table's widget
// column. Only the launcher button takes it: the chat itself stays neutral.
//
// Detected from the prospect's screenshot by default (server/brandColor.ts),
// so most rows never need touching; this is the override for the ones the
// detector got wrong, and "Detected" puts a row back on the automatic colour.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useSetWidgetColor, useWidgetColors } from "../api/demoSettingsApi";

// Black first (the default), then a spread of common brand colours.
const PRESETS = ["#000000", "#1e3a8a", "#2563eb", "#0891b2", "#059669", "#65a30d", "#eab308", "#f97316", "#dc2626", "#be185d", "#7c3aed", "#57534e"];
const BLACK = "#000000";

function Dot({ color, size = 14, ring }: { color: string; size?: number; ring?: boolean }) {
  return (
    <span
      style={{
        width: size, height: size, borderRadius: "50%", flexShrink: 0, display: "inline-block",
        background: color,
        boxShadow: ring ? "0 0 0 2px var(--card), 0 0 0 3.5px var(--ink)" : "inset 0 0 0 1px rgba(0,0,0,.18)",
      }}
    />
  );
}

export function WidgetColorSwatch({ niche }: { niche: string }) {
  const { t } = useTranslation("demos");
  const { data } = useWidgetColors();
  const set = useSetWidgetColor(niche);
  const [open, setOpen] = useState(false);

  const entry = data?.[niche];
  const current = (entry?.color || BLACK).toLowerCase();
  const pick = (c: string | null) => set.mutate(c);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={t("widgetColor.title")}
          aria-label={t("widgetColor.title")}
          className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-muted"
        >
          {set.isPending ? <Loader2 className="h-3 w-3 animate-spin" style={{ color: "var(--mute-2)" }} /> : <Dot color={current} size={13} />}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[220px] p-3">
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)" }}>{t("widgetColor.title")}</div>
        <div style={{ fontSize: 11, color: "var(--mute)", marginTop: 2, marginBottom: 10 }}>{t("widgetColor.hint")}</div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }}>
          {PRESETS.map((c) => (
            <button key={c} type="button" onClick={() => pick(c)} aria-label={c} className="flex items-center justify-center" style={{ height: 22 }}>
              <Dot color={c} size={20} ring={current === c} />
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2" style={{ marginTop: 12, fontSize: 11.5, color: "var(--ink-soft)", cursor: "pointer" }}>
          {/* The native picker commits on close, so a drag does not fire a
              save per pixel. */}
          <input
            type="color"
            defaultValue={current}
            key={current}
            onBlur={(e) => e.target.value.toLowerCase() !== current && pick(e.target.value)}
            style={{ width: 26, height: 22, padding: 0, border: "1px solid var(--line)", borderRadius: 6, background: "transparent" }}
          />
          {t("widgetColor.custom")}
        </label>

        {entry?.manual && (
          <button
            type="button"
            onClick={() => pick(null)}
            className="flex w-full items-center gap-2 rounded hover:bg-muted"
            style={{ marginTop: 10, padding: "5px 4px", fontSize: 11.5, color: "var(--mute)" }}
          >
            <Dot color={entry.auto || BLACK} size={12} />
            {entry.auto ? t("widgetColor.detected") : t("widgetColor.default")}
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
