/**
 * Gradient Tester — dev tool for experimenting with multi-layer radial gradient backgrounds.
 * Shows a floating panel with per-layer controls (color, position, size, opacity, color stops).
 * Draggable control points overlay the host panel for visual positioning.
 */
import { useState, useCallback, useRef, type PointerEvent as RPointerEvent } from "react";
import { X, RotateCcw, ChevronDown, ChevronRight, Plus, Trash2, Copy, Move } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { HsvPicker } from "@/components/ui/color-picker-widget";
import { cn } from "@/lib/utils";

/* ── Types ── */

export interface ColorStop {
  color: string;   // hex "#RRGGBB"
  opacity: number;  // 0-1
  position: number; // 0-100 %
}

export interface GradientLayer {
  id: number;
  label: string;
  enabled: boolean;
  type: "solid" | "radial" | "linear";
  solidColor?: string;
  angle?: number;    // degrees 0-360, only used when type === "linear"
  ellipseW: number;  // width %
  ellipseH: number;  // height %
  posX: number;      // center x % (0-100)
  posY: number;      // center y % (0-100)
  colorStops: ColorStop[];
}

/* ── Default layers ── */

export const DEFAULT_LAYERS: GradientLayer[] = [
  {
    id: 0, label: "Base", enabled: true, type: "solid",
    solidColor: "#ffffff",
    ellipseW: 100, ellipseH: 100, posX: 50, posY: 50, colorStops: [],
  },
  {
    id: 1, label: "Social1 gradient", enabled: true, type: "linear",
    angle: 135,
    ellipseW: 100, ellipseH: 100, posX: 50, posY: 50,
    colorStops: [
      { color: "#003bff", opacity: 0.20, position: 0 },
      { color: "#ffffff", opacity: 1,    position: 50 },
      { color: "#ffbb00", opacity: 0.30, position: 100 },
    ],
  },
];

/* ── Layer → CSS style ── */

function stopToCss(stop: ColorStop): string {
  if (stop.opacity === 0) return `transparent ${stop.position}%`;
  if (stop.opacity === 1) return `${stop.color} ${stop.position}%`;
  const r = parseInt(stop.color.slice(1, 3), 16);
  const g = parseInt(stop.color.slice(3, 5), 16);
  const b = parseInt(stop.color.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${stop.opacity}) ${stop.position}%`;
}

export function layerToStyle(layer: GradientLayer): React.CSSProperties | null {
  if (!layer.enabled) return null;
  if (layer.type === "solid") {
    return { background: layer.solidColor || "#F8F3EB" };
  }
  const stops = layer.colorStops.map(stopToCss).join(",");
  if (layer.type === "linear") {
    return { background: `linear-gradient(${layer.angle ?? 135}deg, ${stops})` };
  }
  return {
    background: `radial-gradient(ellipse ${layer.ellipseW}% ${layer.ellipseH}% at ${layer.posX}% ${layer.posY}%, ${stops})`,
  };
}

/* ── Layer → Tailwind export string ── */

export function layerToTailwind(layer: GradientLayer): string {
  if (!layer.enabled) return `{/* Layer ${layer.id}: ${layer.label} — disabled */}`;
  if (layer.type === "solid") {
    return `<div className="absolute inset-0 bg-[${layer.solidColor}]" />`;
  }
  const stops = layer.colorStops.map((s) => {
    const css = stopToCss(s);
    return css.replace(/ /g, "_");
  }).join(",");
  if (layer.type === "linear") {
    const grad = `linear-gradient(${layer.angle ?? 135}deg,${stops})`;
    return `<div className="absolute inset-0 bg-[${grad}]" />`;
  }
  const grad = `radial-gradient(ellipse_${layer.ellipseW}%_${layer.ellipseH}%_at_${layer.posX}%_${layer.posY}%,${stops})`;
  return `<div className="absolute inset-0 bg-[${grad}]" />`;
}

/* ── Draggable control points overlay ── */

export function GradientControlPoints({
  layers,
  onUpdateLayer,
}: {
  layers: GradientLayer[];
  onUpdateLayer: (id: number, patch: Partial<GradientLayer>) => void;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);

  const handlePointer = useCallback((e: RPointerEvent<HTMLDivElement>, layerId: number) => {
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    onUpdateLayer(layerId, { posX: Math.round(x), posY: Math.round(y) });
  }, [onUpdateLayer]);

  const onDown = useCallback((e: RPointerEvent<HTMLDivElement>, layerId: number) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    handlePointer(e, layerId);
  }, [handlePointer]);

  const dotColor = (layer: GradientLayer): string => {
    if (layer.colorStops.length > 0 && layer.colorStops[0].opacity > 0) {
      return layer.colorStops[0].color;
    }
    return "#888";
  };

  return (
    <div ref={overlayRef} className="absolute inset-0 z-[50] cursor-crosshair">
      {layers.filter(l => l.enabled && l.type === "radial").map((layer) => (
        <div
          key={layer.id}
          className="absolute w-5 h-5 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.3),0_2px_8px_rgba(0,0,0,0.2)] -translate-x-1/2 -translate-y-1/2 flex items-center justify-center text-[8px] font-bold text-white cursor-grab active:cursor-grabbing select-none"
          style={{
            left: `${layer.posX}%`,
            top: `${layer.posY}%`,
            backgroundColor: dotColor(layer),
          }}
          onPointerDown={(e) => onDown(e, layer.id)}
          onPointerMove={(e) => { if (e.buttons > 0) handlePointer(e, layer.id); }}
        >
          {layer.id}
        </div>
      ))}
    </div>
  );
}

/* ── Color stop mini-editor ── */

function StopEditor({
  stop,
  onChange,
  onRemove,
}: {
  stop: ColorStop;
  onChange: (patch: Partial<ColorStop>) => void;
  onRemove: () => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const safeHex = /^#[0-9a-fA-F]{6}$/.test(stop.color) ? stop.color : "#888888";
  const opacityPct = Math.round(stop.opacity * 100);

  return (
    <div className="space-y-1.5 rounded-lg bg-gray-50 border border-gray-200 p-1.5">
      {/* Row 1: swatch + hex + position */}
      <div className="flex items-center gap-1.5">
        <button
          className="h-5 w-5 shrink-0 rounded border border-gray-300 cursor-pointer"
          style={{ backgroundColor: safeHex, opacity: stop.opacity }}
          onClick={() => setPickerOpen(!pickerOpen)}
          title="Pick color"
        />
        <input
          type="text"
          value={safeHex.toUpperCase()}
          onChange={(e) => {
            let val = e.target.value;
            if (!val.startsWith("#")) val = "#" + val;
            if (/^#[0-9a-fA-F]{6}$/.test(val)) onChange({ color: val.toLowerCase() });
          }}
          className="min-w-0 flex-1 rounded border border-gray-200 bg-white px-1 py-0.5 font-mono text-[10px] text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          maxLength={7}
        />
        <span className="text-[9px] text-gray-400">@</span>
        <input
          type="number"
          min={0} max={100} step={1}
          value={stop.position}
          onChange={(e) => onChange({ position: parseInt(e.target.value) || 0 })}
          className="w-10 rounded border border-gray-200 bg-white px-1 py-0.5 font-mono text-[10px] text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-400"
        />
        <span className="text-[9px] text-gray-400">%</span>
        <button onClick={onRemove} className="rounded p-0.5 hover:bg-gray-200" title="Remove stop">
          <Trash2 className="h-3 w-3 text-gray-400" />
        </button>
      </div>
      {/* Row 2: opacity slider */}
      <div className="flex items-center gap-2 px-0.5">
        <span className="text-[9px] text-gray-400 w-12 shrink-0">Opacity</span>
        <Slider
          value={[opacityPct]}
          min={0} max={100} step={1}
          onValueChange={([v]) => onChange({ opacity: v / 100 })}
          className="flex-1"
        />
        <span className="text-[10px] font-mono text-gray-500 w-7 text-right">{opacityPct}%</span>
      </div>
      {pickerOpen && (
        <div className="pl-1">
          <HsvPicker value={safeHex} onChange={(hex) => onChange({ color: hex })} />
        </div>
      )}
    </div>
  );
}

/* ── Single layer row (expandable) ── */

function LayerRow({
  layer,
  onUpdate,
  onRemove,
  removable,
}: {
  layer: GradientLayer;
  onUpdate: (patch: Partial<GradientLayer>) => void;
  onRemove?: () => void;
  removable: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const dotColor = layer.type === "solid"
    ? (layer.solidColor || "#F8F3EB")
    : (layer.colorStops.length > 0 && layer.colorStops[0].opacity > 0 ? layer.colorStops[0].color : "#888");

  const updateStop = (idx: number, patch: Partial<ColorStop>) => {
    const stops = [...layer.colorStops];
    stops[idx] = { ...stops[idx], ...patch };
    onUpdate({ colorStops: stops });
  };

  const removeStop = (idx: number) => {
    onUpdate({ colorStops: layer.colorStops.filter((_, i) => i !== idx) });
  };

  const addStop = () => {
    const last = layer.colorStops[layer.colorStops.length - 1];
    onUpdate({
      colorStops: [...layer.colorStops, {
        color: last?.color || "#888888",
        opacity: 0,
        position: Math.min((last?.position || 50) + 20, 100),
      }],
    });
  };

  return (
    <div className={cn("rounded-lg border border-gray-200 overflow-hidden", !layer.enabled && "opacity-50")}>
      {/* Header */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 bg-gray-50 cursor-pointer select-none" onClick={() => setExpanded(!expanded)}>
        <Switch
          checked={layer.enabled}
          onCheckedChange={(v) => onUpdate({ enabled: v })}
          className="h-4 w-7 [&>span]:h-3 [&>span]:w-3"
          onClick={(e) => e.stopPropagation()}
        />
        <div className="h-4 w-4 rounded-full border border-gray-300 shrink-0" style={{ backgroundColor: dotColor }} />
        <span className="text-[11px] font-medium text-gray-700 flex-1">{layer.label}</span>
        {layer.type === "radial" && (
          <span className="text-[9px] text-gray-400 font-mono">{layer.posX},{layer.posY}</span>
        )}
        {layer.type === "linear" && (
          <span className="text-[9px] text-gray-400 font-mono">{layer.angle ?? 135}°</span>
        )}
        {removable && (
          <button onClick={(e) => { e.stopPropagation(); onRemove?.(); }} className="rounded p-0.5 hover:bg-gray-200" title="Delete layer">
            <Trash2 className="h-3 w-3 text-gray-400" />
          </button>
        )}
        {expanded ? <ChevronDown className="h-3 w-3 text-gray-400" /> : <ChevronRight className="h-3 w-3 text-gray-400" />}
      </div>

      {/* Expanded controls */}
      {expanded && (
        <div className="px-2 py-2 space-y-2.5 border-t border-gray-100">
          {/* Type switcher */}
          <div className="flex gap-1">
            {(["solid", "linear", "radial"] as const).map((t) => (
              <button
                key={t}
                onClick={() => onUpdate({ type: t })}
                className={cn(
                  "flex-1 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide transition-colors",
                  layer.type === t
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-100 text-gray-400 hover:text-gray-600"
                )}
              >
                {t}
              </button>
            ))}
          </div>
          {layer.type === "solid" ? (
            <div className="space-y-1">
              <label className="text-[9px] font-semibold uppercase tracking-wide text-gray-400">Color</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={(layer.solidColor || "#F8F3EB").toUpperCase()}
                  onChange={(e) => {
                    let val = e.target.value;
                    if (!val.startsWith("#")) val = "#" + val;
                    if (/^#[0-9a-fA-F]{6}$/.test(val)) onUpdate({ solidColor: val.toLowerCase() });
                  }}
                  className="flex-1 rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-mono text-[10px] text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  maxLength={7}
                />
              </div>
              <HsvPicker
                value={/^#[0-9a-fA-F]{6}$/.test(layer.solidColor || "") ? layer.solidColor! : "#F8F3EB"}
                onChange={(hex) => onUpdate({ solidColor: hex })}
              />
            </div>
          ) : layer.type === "linear" ? (
            <>
              <div className="space-y-1">
                <label className="text-[9px] font-semibold uppercase tracking-wide text-gray-400">Angle</label>
                <div className="flex items-center gap-2">
                  <Slider value={[layer.angle ?? 135]} min={0} max={360} step={1} onValueChange={([v]) => onUpdate({ angle: v })} className="flex-1" />
                  <span className="text-[10px] font-mono text-gray-500 w-8 text-right">{layer.angle ?? 135}°</span>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[9px] font-semibold uppercase tracking-wide text-gray-400">Color Stops</label>
                  <button onClick={addStop} className="rounded p-0.5 hover:bg-gray-100" title="Add stop">
                    <Plus className="h-3 w-3 text-gray-400" />
                  </button>
                </div>
                <div className="space-y-1.5">
                  {layer.colorStops.map((stop, idx) => (
                    <StopEditor key={idx} stop={stop} onChange={(p) => updateStop(idx, p)} onRemove={() => removeStop(idx)} />
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1">
                <label className="text-[9px] font-semibold uppercase tracking-wide text-gray-400">Position X / Y</label>
                <div className="flex items-center gap-2">
                  <Slider value={[layer.posX]} min={0} max={100} step={1} onValueChange={([v]) => onUpdate({ posX: v })} className="flex-1" />
                  <span className="text-[10px] font-mono text-gray-500 w-8 text-right">{layer.posX}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <Slider value={[layer.posY]} min={0} max={100} step={1} onValueChange={([v]) => onUpdate({ posY: v })} className="flex-1" />
                  <span className="text-[10px] font-mono text-gray-500 w-8 text-right">{layer.posY}%</span>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-semibold uppercase tracking-wide text-gray-400">Ellipse W / H</label>
                <div className="flex items-center gap-2">
                  <Slider value={[layer.ellipseW]} min={1} max={200} step={1} onValueChange={([v]) => onUpdate({ ellipseW: v })} className="flex-1" />
                  <span className="text-[10px] font-mono text-gray-500 w-8 text-right">{layer.ellipseW}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <Slider value={[layer.ellipseH]} min={1} max={200} step={1} onValueChange={([v]) => onUpdate({ ellipseH: v })} className="flex-1" />
                  <span className="text-[10px] font-mono text-gray-500 w-8 text-right">{layer.ellipseH}%</span>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[9px] font-semibold uppercase tracking-wide text-gray-400">Color Stops</label>
                  <button onClick={addStop} className="rounded p-0.5 hover:bg-gray-100" title="Add stop">
                    <Plus className="h-3 w-3 text-gray-400" />
                  </button>
                </div>
                <div className="space-y-1.5">
                  {layer.colorStops.map((stop, idx) => (
                    <StopEditor key={idx} stop={stop} onChange={(p) => updateStop(idx, p)} onRemove={() => removeStop(idx)} />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Main GradientTester panel ── */

export function GradientTester({
  open,
  onClose,
  layers,
  onUpdateLayer,
  onResetLayers,
  dragMode,
  onToggleDragMode,
  onSaveToSlot,
}: {
  open: boolean;
  onClose: () => void;
  layers: GradientLayer[];
  onUpdateLayer: (id: number, patch: Partial<GradientLayer>) => void;
  onResetLayers: () => void;
  dragMode: boolean;
  onToggleDragMode: () => void;
  onSaveToSlot?: (slot: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<"layers" | "export">("layers");
  const [nextId, setNextId] = useState(100);

  // ── Panel drag state ──
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelPos, setPanelPos] = useState<{ x: number; y: number } | null>(null);
  const dragState = useRef<{ startX: number; startY: number; startLeft: number; startTop: number } | null>(null);

  const handleHeaderPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragState.current = { startX: e.clientX, startY: e.clientY, startLeft: rect.left, startTop: rect.top };
  };

  const handleHeaderPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState.current || !(e.buttons & 1)) return;
    const { startX, startY, startLeft, startTop } = dragState.current;
    const panelH = panelRef.current?.offsetHeight ?? 60;
    const x = Math.max(0, Math.min(window.innerWidth - 320, startLeft + (e.clientX - startX)));
    const y = Math.max(0, Math.min(window.innerHeight - panelH, startTop + (e.clientY - startY)));
    setPanelPos({ x, y });
  };

  const handleHeaderPointerUp = () => {
    dragState.current = null;
  };

  const addLayer = useCallback(() => {
    const id = nextId;
    setNextId(id + 1);
    onUpdateLayer(-1, {
      id,
      label: `Layer ${id}`,
      enabled: true,
      type: "radial",
      angle: 135,
      ellipseW: 80,
      ellipseH: 80,
      posX: 50,
      posY: 50,
      colorStops: [
        { color: "#6366f1", opacity: 0.4, position: 0 },
        { color: "#6366f1", opacity: 0,   position: 80 },
      ],
    } as GradientLayer);
  }, [nextId, onUpdateLayer]);

  const removeLayer = useCallback((id: number) => {
    onUpdateLayer(id, { id: -999 } as any);
  }, [onUpdateLayer]);

  if (!open) return null;

  const exportCode = layers.map(layerToTailwind).join("\n");

  const panelStyle: React.CSSProperties = panelPos
    ? { width: 320, maxHeight: "calc(100vh - 24px)", top: panelPos.y, left: panelPos.x }
    : { width: 320, maxHeight: "calc(100vh - 70px)", right: 12, bottom: 12 };

  return (
    <div
      ref={panelRef}
      className="fixed z-[9999] flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl"
      style={panelStyle}
    >
      {/* Header — draggable */}
      <div
        className="flex shrink-0 items-center justify-between border-b border-gray-200 px-3 py-2 cursor-grab active:cursor-grabbing select-none"
        onPointerDown={handleHeaderPointerDown}
        onPointerMove={handleHeaderPointerMove}
        onPointerUp={handleHeaderPointerUp}
      >
        <span className="text-[13px] font-semibold text-gray-900">Gradient Tester</span>
        <div className="flex items-center gap-1">
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onToggleDragMode}
            className={cn("rounded p-1", dragMode ? "bg-indigo-100 text-indigo-600" : "hover:bg-gray-100 text-gray-500")}
            title={dragMode ? "Disable control-point drag" : "Enable control-point drag"}
          >
            <Move className="h-3.5 w-3.5" />
          </button>
          <button onPointerDown={(e) => e.stopPropagation()} onClick={onResetLayers} className="rounded p-1 hover:bg-gray-100" title="Reset all layers">
            <RotateCcw className="h-3.5 w-3.5 text-gray-500" />
          </button>
          <button onPointerDown={(e) => e.stopPropagation()} onClick={onClose} className="rounded p-1 hover:bg-gray-100" title="Close">
            <X className="h-3.5 w-3.5 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex shrink-0 border-b border-gray-200">
        <button
          className={cn(
            "flex-1 py-1.5 text-[11px] font-medium transition-colors",
            activeTab === "layers" ? "text-gray-900 border-b-2 border-indigo-500" : "text-gray-400 hover:text-gray-600"
          )}
          onClick={() => setActiveTab("layers")}
        >
          Layers ({layers.filter(l => l.enabled).length}/{layers.length})
        </button>
        <button
          className={cn(
            "flex-1 py-1.5 text-[11px] font-medium transition-colors",
            activeTab === "export" ? "text-gray-900 border-b-2 border-indigo-500" : "text-gray-400 hover:text-gray-600"
          )}
          onClick={() => setActiveTab("export")}
        >
          Export
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-2 [scrollbar-width:thin]">
        {activeTab === "layers" ? (
          <div className="space-y-1.5">
            {layers.map((layer) => (
              <LayerRow
                key={layer.id}
                layer={layer}
                onUpdate={(patch) => onUpdateLayer(layer.id, patch)}
                onRemove={() => removeLayer(layer.id)}
                removable={layer.id !== 0}
              />
            ))}
            <button
              onClick={addLayer}
              className="w-full flex items-center justify-center gap-1 py-1.5 rounded-lg border border-dashed border-gray-300 text-[11px] font-medium text-gray-400 hover:text-gray-600 hover:border-gray-400 transition-colors"
            >
              <Plus className="h-3 w-3" />
              Add Layer
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-2 overflow-x-auto">
              <pre className="text-[10px] font-mono text-gray-700 whitespace-pre-wrap leading-relaxed">{exportCode}</pre>
            </div>
            <button
              onClick={() => navigator.clipboard.writeText(exportCode)}
              className="w-full flex items-center justify-center gap-1 py-1.5 rounded-lg bg-indigo-600 text-white text-[11px] font-medium hover:opacity-90 transition-opacity"
            >
              <Copy className="h-3 w-3" />
              Copy All
            </button>
          </div>
        )}
      </div>

      {/* Save to Slot footer */}
      {onSaveToSlot && (
        <div className="shrink-0 border-t border-gray-200 bg-gray-50 px-2 py-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 shrink-0">Save to</span>
            {(["social1", "social2", "social3", "social4"] as const).map((slot, i) => (
              <button
                key={slot}
                onClick={() => onSaveToSlot(slot)}
                className="flex-1 py-1 rounded text-[10px] font-bold bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 transition-colors"
              >
                #{i + 1}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
