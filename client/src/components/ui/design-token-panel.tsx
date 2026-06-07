/**
 * DesignTokenPanel — dev-only live tuner for the surface primitive tokens.
 *
 * Every primitive (ListCard/GroupHeader/SectionCard/Pill) reads its dimensions from
 * CSS vars in variables.css, so writing those vars on document.documentElement updates
 * the whole app live — no React state plumbing. Dial it in here, hit "Copy CSS", paste
 * into client/src/styles/variables.css to make it permanent. This is the payoff of the
 * token system: a full re-skin (e.g. going neumorphic) is a visual edit, then a commit.
 *
 * Self-contained: renders its own floating launcher. Mount once (dev only) in CrmShell.
 */
import { useState, useEffect, useCallback } from "react";
import { X, RotateCcw, Copy, Check, SlidersHorizontal } from "lucide-react";

const STORAGE_KEY = "design-token-overrides";

type Unit = "rem" | "px";

interface TokenControl {
  var: string;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: Unit;
  /** default value in the unit, mirrored from variables.css */
  def: number;
}

const GROUPS: { title: string; controls: TokenControl[] }[] = [
  {
    title: "List card",
    controls: [
      { var: "--list-card-radius",        label: "Radius",        min: 0, max: 2,   step: 0.0625, unit: "rem", def: 0.75 },
      { var: "--list-card-radius-mobile", label: "Radius (mobile)", min: 0, max: 2.5, step: 0.0625, unit: "rem", def: 1.5 },
      { var: "--list-card-pad-x",         label: "Padding X",     min: 0, max: 1.5, step: 0.0625, unit: "rem", def: 0.625 },
      { var: "--list-card-pad-y",         label: "Padding Y",     min: 0, max: 1.5, step: 0.0625, unit: "rem", def: 0.5 },
      { var: "--list-card-min-h",         label: "Min height",    min: 0, max: 6,   step: 0.125,  unit: "rem", def: 3.5 },
    ],
  },
  {
    title: "Panel",
    controls: [
      { var: "--panel-radius", label: "Radius",  min: 0, max: 2,   step: 0.0625, unit: "rem", def: 0.5 },
      { var: "--panel-pad",    label: "Padding", min: 0, max: 1.5, step: 0.0625, unit: "rem", def: 0.75 },
    ],
  },
  {
    title: "Group header",
    controls: [
      { var: "--group-header-pad-x", label: "Padding X", min: 0, max: 1.5, step: 0.0625, unit: "rem", def: 0.75 },
      { var: "--group-header-pad-y", label: "Padding Y", min: 0, max: 1.5, step: 0.0625, unit: "rem", def: 0.75 },
    ],
  },
  {
    title: "Pill",
    controls: [
      { var: "--pill-pad-x", label: "Padding X", min: 0, max: 1, step: 0.0625, unit: "rem", def: 0.375 },
      { var: "--pill-pad-y", label: "Padding Y", min: 0, max: 1, step: 0.0625, unit: "rem", def: 0.125 },
    ],
  },
];

const ALL = GROUPS.flatMap((g) => g.controls);

function fmt(v: number, unit: Unit): string {
  // trim trailing zeros
  return `${parseFloat(v.toFixed(4))}${unit}`;
}

export function DesignTokenPanel() {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, number>>(() => {
    const base: Record<string, number> = {};
    ALL.forEach((c) => (base[c.var] = c.def));
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      Object.assign(base, saved);
    } catch { /* ignore */ }
    return base;
  });
  const [copied, setCopied] = useState(false);

  // Apply a single var to the document root.
  const apply = useCallback((c: TokenControl, v: number) => {
    document.documentElement.style.setProperty(c.var, fmt(v, c.unit));
  }, []);

  // Re-apply all overrides that differ from default whenever values change.
  useEffect(() => {
    ALL.forEach((c) => {
      if (values[c.var] !== c.def) apply(c, values[c.var]);
    });
    const dirty: Record<string, number> = {};
    ALL.forEach((c) => { if (values[c.var] !== c.def) dirty[c.var] = values[c.var]; });
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(dirty)); } catch { /* ignore */ }
  }, [values, apply]);

  const set = (c: TokenControl, v: number) => setValues((prev) => ({ ...prev, [c.var]: v }));

  const resetOne = (c: TokenControl) => {
    document.documentElement.style.removeProperty(c.var);
    setValues((prev) => ({ ...prev, [c.var]: c.def }));
  };

  const resetAll = () => {
    ALL.forEach((c) => document.documentElement.style.removeProperty(c.var));
    const base: Record<string, number> = {};
    ALL.forEach((c) => (base[c.var] = c.def));
    setValues(base);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  };

  const dirtyControls = ALL.filter((c) => values[c.var] !== c.def);

  const copyCss = () => {
    const lines = dirtyControls.length
      ? dirtyControls.map((c) => `  ${c.var}: ${fmt(values[c.var], c.unit)};`)
      : ["  /* no overrides — all tokens at default */"];
    const css = `:root {\n${lines.join("\n")}\n}`;
    navigator.clipboard.writeText(css).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed right-0 top-1/2 -translate-y-1/2 z-[9998] flex items-center gap-1.5 rounded-l-lg bg-foreground/85 text-background px-2 py-2.5 text-[11px] font-semibold shadow-lg hover:bg-foreground"
        title="Design tokens (dev)"
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
      </button>
    );
  }

  return (
    <div className="fixed right-3 top-1/2 -translate-y-1/2 z-[9999] w-[270px] max-h-[88vh] overflow-y-auto rounded-xl bg-popover text-popover-foreground border border-border/60 shadow-xl">
      <div className="sticky top-0 flex items-center justify-between gap-2 bg-popover px-3 py-2.5 border-b border-border/40">
        <span className="text-[12px] font-bold tracking-wide flex items-center gap-1.5">
          <SlidersHorizontal className="h-3.5 w-3.5" /> Surface tokens
        </span>
        <div className="flex items-center gap-1">
          <button onClick={resetAll} title="Reset all" className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setOpen(false)} title="Close" className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="p-3 space-y-3">
        {GROUPS.map((g) => (
          <div key={g.title}>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/70 mb-1.5">{g.title}</p>
            <div className="space-y-2">
              {g.controls.map((c) => {
                const v = values[c.var];
                const dirty = v !== c.def;
                return (
                  <div key={c.var}>
                    <div className="flex items-center justify-between text-[11px] mb-0.5">
                      <span className={dirty ? "font-semibold text-foreground" : "text-foreground/70"}>{c.label}</span>
                      <button
                        onClick={() => dirty && resetOne(c)}
                        className={`tabular-nums ${dirty ? "text-primary font-semibold" : "text-muted-foreground/60"}`}
                        title={dirty ? "Click to reset" : ""}
                      >
                        {fmt(v, c.unit)}
                      </button>
                    </div>
                    <input
                      type="range"
                      min={c.min}
                      max={c.max}
                      step={c.step}
                      value={v}
                      onChange={(e) => set(c, parseFloat(e.target.value))}
                      className="w-full h-1.5 accent-primary cursor-pointer"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="sticky bottom-0 bg-popover px-3 py-2.5 border-t border-border/40">
        <button
          onClick={copyCss}
          className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-primary text-primary-foreground text-[12px] font-semibold py-2 hover:opacity-90"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied!" : `Copy CSS (${dirtyControls.length})`}
        </button>
        <p className="text-[10px] text-muted-foreground/60 mt-1.5 leading-tight">
          Paste into <code className="text-foreground/70">styles/variables.css</code> → <code className="text-foreground/70">:root</code> to persist.
        </p>
      </div>
    </div>
  );
}
