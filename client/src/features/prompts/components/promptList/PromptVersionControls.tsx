// Topbar edit actions for the selected prompt: preview font and size, save a
// version (Ctrl+Shift+S) and the version history menu.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { RotateCcw, Save, Trash2, Type } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { PromptVersionsState } from "./usePromptVersions";

const PREVIEW_FONTS: { labelKey: string; value: string }[] = [
  { labelKey: "font.mono", value: "var(--mono)" },
  { labelKey: "font.sans", value: "var(--sans)" },
  { labelKey: "font.system", value: "system-ui, -apple-system, sans-serif" },
  { labelKey: "font.humanist", value: "'Trebuchet MS', Helvetica, sans-serif" },
];

export function PromptFontPopover({
  previewFont,
  onPreviewFontChange,
  fontSize,
  onFontSizeChange,
}: {
  previewFont: string;
  onPreviewFontChange: (v: string) => void;
  fontSize: number;
  onFontSizeChange: (v: number) => void;
}) {
  const { t } = useTranslation("prompts");
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="la-btn la-btn--soft la-btn--icon" style={{ flexShrink: 0 }} title={t("font.title")} aria-label={t("font.title")}>
          <Type size={14} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[210px] p-3">
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-[10px] font-mono text-muted-foreground block mb-1.5">{t("font.previewFont")}</label>
            <div className="flex flex-col gap-0.5">
              {PREVIEW_FONTS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => onPreviewFontChange(f.value)}
                  className={cn(
                    "text-left text-[12px] px-2 py-1 rounded transition-colors",
                    previewFont === f.value ? "bg-muted font-medium" : "hover:bg-muted/50",
                  )}
                  style={{ fontFamily: f.value }}
                >
                  {t(f.labelKey)}
                </button>
              ))}
            </div>
          </div>
          <div style={{ height: 1, background: "var(--line)" }} />
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-mono text-muted-foreground">
              {t("font.size")}: {fontSize}px
            </label>
            <input
              type="range"
              min={11}
              max={18}
              step={1}
              value={fontSize}
              onChange={(e) => onFontSizeChange(parseInt(e.target.value, 10))}
              style={{ width: "100%", cursor: "pointer", accentColor: "hsl(var(--primary))" }}
              aria-label={t("font.size")}
            />
            <div className="flex justify-between text-[9px] font-mono text-muted-foreground">
              <span>11</span><span>18 px</span>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function PromptSaveVersionPopover({
  open,
  onOpenChange,
  v,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  v: PromptVersionsState;
}) {
  const { t } = useTranslation("prompts");
  const [bump, setBump] = useState<"minor" | "major">("minor");
  const [label, setLabel] = useState("");
  const submit = () => { v.saveVersion(bump, label); onOpenChange(false); };
  const seg = (on: boolean) => cn("la-btn flex-1 text-xs", on ? "la-btn--soft on" : "la-btn--inset");

  return (
    <Popover open={open} onOpenChange={(o) => { if (o) { setBump("minor"); setLabel(""); } onOpenChange(o); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="la-btn la-btn--soft la-btn--icon"
          disabled={v.savingVersion}
          title={`${t("versions.saveVersion")} (Ctrl+Shift+S)`}
          aria-label={t("versions.saveVersion")}
        >
          <Save className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="p-3 w-60">
        <p className="text-xs font-medium mb-2">{t("versions.saveVersion")}</p>
        <div className="flex gap-2 mb-2">
          <button type="button" onClick={() => setBump("minor")} className={seg(bump === "minor")}>{t("versions.minorUpdate")}</button>
          <button type="button" onClick={() => setBump("major")} className={seg(bump === "major")}>{t("versions.majorUpdate")}</button>
        </div>
        <input
          className="neu-input w-full h-8 px-2.5 text-xs outline-none mb-2"
          placeholder={t("versions.labelPlaceholder")}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
        />
        <button type="button" onClick={submit} disabled={v.savingVersion} className="la-btn la-btn--wine w-full text-xs">
          {t("actions.save")}
        </button>
      </PopoverContent>
    </Popover>
  );
}

export function PromptVersionHistory({ v, promptVersion }: { v: PromptVersionsState; promptVersion?: string | null }) {
  const { t, i18n } = useTranslation("prompts");
  const label = v.versionsLoading
    ? "…"
    : v.selectedVersion
    ? `v${v.selectedVersion}`
    : v.liveSnap
    ? `${t("versions.current")} ●`
    : v.versions.length > 0
    ? `v${v.versions[0].versionNumber}`
    : promptVersion
    ? `v${promptVersion}`
    : "v1";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="la-btn la-btn--soft text-[11px] font-mono shrink-0"
          style={{ height: 32, minWidth: 32, padding: "0 8px", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--mute)" }}
          disabled={v.versionsLoading}
          title={t("versions.history")}
        >
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="p-1 min-w-[220px]">
        {v.liveSnap && (
          <button type="button" onClick={v.revertToCurrent} className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium hover:bg-muted/60" style={{ color: "var(--warn)" }}>
            <RotateCcw className="h-3 w-3" />
            {t("versions.revertToCurrent")}
          </button>
        )}
        {v.versions.length === 0 && !v.liveSnap && (
          <p className="px-2.5 py-1.5 text-xs text-muted-foreground">{t("versions.noVersions")}</p>
        )}
        {v.versions.map((ver) => (
          <div
            key={ver.id}
            className={cn("px-2.5 py-1.5 rounded-md cursor-pointer hover:bg-muted/60 group/vrow", v.selectedVersion === ver.versionNumber && "bg-muted font-medium")}
            onClick={() => v.loadVersion(ver)}
          >
            <div className="flex items-center gap-1">
              <span className="text-xs shrink-0 text-muted-foreground w-[96px]">
                {new Date(ver.savedAt).toLocaleDateString(i18n.language, { month: "short", day: "numeric", year: "numeric" })}
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-xs flex-1 min-w-0 truncate">
                    v{ver.versionNumber}{ver.label ? `: ${ver.label}` : ""}
                  </span>
                </TooltipTrigger>
                {ver.label && (
                  <TooltipContent side="right" className="max-w-[200px] text-xs">{ver.label}</TooltipContent>
                )}
              </Tooltip>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); v.deleteVersion(ver.id); }}
                className="opacity-0 group-hover/vrow:opacity-100 p-0.5 rounded hover:text-destructive transition-opacity shrink-0"
                title={t("versions.deleteVersion")}
                aria-label={t("versions.deleteVersion")}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
}
