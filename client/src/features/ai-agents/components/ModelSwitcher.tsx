import { useState, useRef, useEffect } from "react";
import { ChevronDown, Sparkles, Zap, Rabbit } from "lucide-react";
import { cn } from "@/lib/utils";

export const MODEL_OPTIONS = [
  {
    id: "claude-sonnet-4-20250514",
    label: "Sonnet",
    shortLabel: "Sonnet",
    icon: Zap,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    description: "Fast & capable",
  },
  {
    id: "claude-opus-4-20250514",
    label: "Opus",
    shortLabel: "Opus",
    icon: Sparkles,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    description: "Most intelligent",
  },
  {
    id: "claude-haiku-235-20241022",
    label: "Haiku",
    shortLabel: "Haiku",
    icon: Rabbit,
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    description: "Fastest & lightest",
  },
] as const;

function getModelOption(modelId: string | undefined) {
  return MODEL_OPTIONS.find((m) => m.id === modelId) || MODEL_OPTIONS[0];
}

interface ModelSwitcherProps {
  currentModel: string | undefined;
  onModelChange: (model: string) => void;
  disabled?: boolean;
  compact?: boolean;
}

export function ModelSwitcher({
  currentModel,
  onModelChange,
  disabled = false,
  compact = false,
}: ModelSwitcherProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const current = getModelOption(currentModel);
  const Icon = current.icon;

  return (
    <div ref={containerRef} className="relative" data-testid="model-switcher">
      {/* Trigger button */}
      <button
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={cn(
          "flex items-center gap-1 rounded-full border border-border/50 transition-all",
          "hover:border-border hover:bg-muted/50",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]",
        )}
        data-testid="model-switcher-trigger"
      >
        <Icon className={cn("shrink-0", current.color, compact ? "h-3 w-3" : "h-3.5 w-3.5")} />
        <span className="font-medium text-foreground">{current.shortLabel}</span>
        <ChevronDown
          className={cn(
            "shrink-0 text-muted-foreground transition-transform",
            compact ? "h-2.5 w-2.5" : "h-3 w-3",
            open && "rotate-180",
          )}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className={cn(
            "absolute top-full mt-1 right-0 z-[10000] min-w-[180px]",
            "bg-popover border border-border rounded-lg shadow-lg py-1",
            "animate-in fade-in-0 zoom-in-95 duration-150",
          )}
          data-testid="model-switcher-dropdown"
        >
          {MODEL_OPTIONS.map((option) => {
            const OptIcon = option.icon;
            const isSelected = option.id === current.id;
            return (
              <button
                key={option.id}
                onClick={() => {
                  onModelChange(option.id);
                  setOpen(false);
                }}
                className={cn(
                  "flex items-center gap-2.5 w-full px-3 py-2 text-left transition-colors",
                  "hover:bg-muted/50",
                  isSelected && "bg-muted/30",
                )}
                data-testid={`model-option-${option.shortLabel.toLowerCase()}`}
              >
                <div className={cn("h-7 w-7 rounded-full flex items-center justify-center shrink-0", option.bgColor)}>
                  <OptIcon className={cn("h-3.5 w-3.5", option.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-foreground">{option.label}</div>
                  <div className="text-[10px] text-muted-foreground">{option.description}</div>
                </div>
                {isSelected && (
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-indigo shrink-0" data-testid="model-selected-indicator" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
