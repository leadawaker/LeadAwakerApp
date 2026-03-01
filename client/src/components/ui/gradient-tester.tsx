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
  color: string;   // hex "#RRGGBB" or css color keyword like "transparent"
  opacity: number;  // 0-1
  position: number; // 0-100 %
}

export interface GradientLayer {
  id: number;
  label: string;
  enabled: boolean;
  type: "solid" | "radial";
  solidColor?: string;
  ellipseW: number;  // width %
  ellipseH: number;  // height %
  posX: number;      // center x % (0-100)
  posY: number;      // center y % (0-100)
  colorStops: ColorStop[];
}

/* ── Default layers (parsed from current CampaignDetailView gradient) ── */

export const DEFAULT_LAYERS: GradientLayer[] = [
  {
    id: 0, label: "Base", enabled: true, type: "solid",
    solidColor: "#ffffff",
    ellipseW: 100, ellipseH: 100, posX: 50, posY: 50, colorStops: [],
  },
  {
    id: 1, label: "White bloom", enabled: false, type: "radial",
    ellipseW: 72, ellipseH: 56, posX: 100, posY: 0,
    colorStops: [
      { color: "#FFFFFF", opacity: 1, position: 0 },
      { color: "#FFFFFF", opacity: 0.8, position: 30 },
      { color: "#000000", opacity: 0, position: 60 },
    ],
  },
  {
    id: 2, label: "Yellow", enabled: false, type: "radial",
    ellipseW: 95, ellipseH: 80, posX: 0, posY: 0,
    colorStops: [
      { color: "#FFF286", opacity: 1, position: 0 },
      { color: "#FFF286", opacity: 0.60, position: 40 },
      { color: "#FFF286", opacity: 0.25, position: 64 },
      { color: "#000000", opacity: 0, position: 80 },
    ],
  },
  {
    id: 3, label: "Peach", enabled: false, type: "radial",
    ellipseW: 62, ellipseH: 72, posX: 100, posY: 36,
    colorStops: [
      { color: "#F1DAA2", opacity: 0.62, position: 0 },
      { color: "#000000", opacity: 0, position: 64 },
    ],
  },
  {
    id: 4, label: "Pink", enabled: true, type: "radial",
    ellipseW: 79, ellipseH: 101, posX: 42, posY: 91,
    colorStops: [
      { color: "#FF0039", opacity: 0.4, position: 0 },
      { color: "#000000", opacity: 0, position: 69 },
    ],
  },
  {
    id: 5, label: "Yellow glow", enabled: true, type: "radial",
    ellipseW: 200, ellipseH: 200, posX: 2, posY: 2,
    colorStops: [
      { color: "#ffeb84", opacity: 1, position: 5 },
      { color: "#000000", opacity: 0, position: 30 },
    ],
  },
  {
    id: 6, label: "Peach glow", enabled: true, type: "radial",
    ellipseW: 80, ellipseH: 102, posX: 69, posY: 50,
    colorStops: [
      { color: "#FFC2A5", opacity: 0.38, position: 0 },
      { color: "#000000", opacity: 0, position: 66 },
    ],
  },
];

/* ── Layer → CSS style ── */

function stopToCss(stop: ColorStop): string {
  if (stop.opacity === 0) return `transparent ${stop.position}%`;
  if (stop.opacity === 1) return `${stop.color} ${stop.position}%`;
  // Convert hex + opacity → rgba
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

  // Color for each control point dot
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

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        {/* Color swatch */}
        <button
          className="h-5 w-5 shrink-0 rounded border border-gray-300 cursor-pointer"
          style={{ backgroundColor: stop.opacity === 0 ? "transparent" : safeHex, opacity: stop.opacity === 0 ? 0.3 : 1 }}
          onClick={() => setPickerOpen(!pickerOpen)}
          title="Pick color"
        />
        {/* Hex input */}
        <input
          type="text"
          value={stop.opacity === 0 ? "transparent" : stop.color.toUpperCase()}
          onChange={(e) => {
            let val = e.target.value;
            if (val.toLowerCase() === "transparent") {
              onChange({ opacity: 0 });
              return;
            }
            if (!val.startsWith("#")) val = "#" + val;
            if (/^#[0-9a-fA-F]{6}$/.test(val)) {
              onChange({ color: val.toLowerCase(), opacity: stop.opacity === 0 ? 1 : stop.opacity });
            }
          }}
          className="min-w-0 flex-1 rounded border border-gray-200 bg-gray-50 px-1 py-0.5 font-mono text-[10px] text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          maxLength={11}
        />
        {/* Opacity */}
        <input
          type="number"
          min={0} max={1} step={0.05}
          value={stop.opacity}
          onChange={(e) => onChange({ opacity: parseFloat(e.target.value) || 0 })}
          className="w-12 rounded border border-gray-200 bg-gray-50 px-1 py-0.5 font-mono text-[10px] text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-400"
        />
        {/* Position % */}
        <input
          type="number"
          min={0} max={100} step={1}
          value={stop.position}
          onChange={(e) => onChange({ position: parseInt(e.target.value) || 0 })}
          className="w-10 rounded border border-gray-200 bg-gray-50 px-1 py-0.5 font-mono text-[10px] text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-400"
        />
        <span className="text-[9px] text-gray-400">%</span>
        {/* Remove */}
        <button onClick={onRemove} className="rounded p-0.5 hover:bg-gray-100" title="Remove stop">
          <Trash2 className="h-3 w-3 text-gray-400" />
        </button>
      </div>
      {pickerOpen && stop.opacity > 0 && (
        <div className="pl-1">
          <HsvPicker
            value={safeHex}
            onChange={(hex) => onChange({ color: hex })}
          />
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
      colorStops: [...layer.colorStops, { color: last?.color || "#888888", opacity: 0.5, position: Math.min((last?.position || 50) + 10, 100) }],
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
          {layer.type === "solid" ? (
            /* Solid layer: just a color picker */
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
          ) : (
            /* Radial layer */
            <>
              {/* Position */}
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

              {/* Ellipse size */}
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

              {/* Color stops */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[9px] font-semibold uppercase tracking-wide text-gray-400">Color Stops</label>
                  <button onClick={addStop} className="rounded p-0.5 hover:bg-gray-100" title="Add stop">
                    <Plus className="h-3 w-3 text-gray-400" />
                  </button>
                </div>
                <div className="space-y-1.5">
                  {layer.colorStops.map((stop, idx) => (
                    <StopEditor
                      key={idx}
                      stop={stop}
                      onChange={(patch) => updateStop(idx, patch)}
                      onRemove={() => removeStop(idx)}
                    />
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
}: {
  open: boolean;
  onClose: () => void;
  layers: GradientLayer[];
  onUpdateLayer: (id: number, patch: Partial<GradientLayer>) => void;
  onResetLayers: () => void;
  dragMode: boolean;
  onToggleDragMode: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"layers" | "export">("layers");
  const [nextId, setNextId] = useState(layers.length);

  const addLayer = useCallback(() => {
    const id = nextId;
    setNextId(id + 1);
    onUpdateLayer(-1, {
      id,
      label: `Layer ${id}`,
      enabled: true,
      type: "radial",
      ellipseW: 50,
      ellipseH: 50,
      posX: 50,
      posY: 50,
      colorStops: [
        { color: "#FFFFFF", opacity: 0.5, position: 0 },
        { color: "#000000", opacity: 0, position: 60 },
      ],
    } as GradientLayer);
  }, [nextId, onUpdateLayer]);

  const removeLayer = useCallback((id: number) => {
    onUpdateLayer(id, { id: -999 } as any); // sentinel: remove
  }, [onUpdateLayer]);

  if (!open) return null;

  const exportCode = layers
    .map(layerToTailwind)
    .join("\n");

  return (
    <div
      className="fixed right-3 bottom-3 z-[9999] flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl"
      style={{ width: 320, maxHeight: "calc(100vh - 70px)" }}
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-3 py-2">
        <span className="text-[13px] font-semibold text-gray-900">Gradient Tester</span>
        <div className="flex items-center gap-1">
          <button
            onClick={onToggleDragMode}
            className={cn("rounded p-1", dragMode ? "bg-indigo-100 text-indigo-600" : "hover:bg-gray-100 text-gray-500")}
            title={dragMode ? "Disable drag mode" : "Enable drag mode"}
          >
            <Move className="h-3.5 w-3.5" />
          </button>
          <button onClick={onResetLayers} className="rounded p-1 hover:bg-gray-100" title="Reset all layers">
            <RotateCcw className="h-3.5 w-3.5 text-gray-500" />
          </button>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100" title="Close">
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
                removable={layer.id >= 7}
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
    </div>
  );
}
