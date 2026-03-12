import { useState, useRef, useEffect } from "react";
import { ChevronDown, BrainCircuit, BrainCog, Brain, CircleOff } from "lucide-react";
import { cn } from "@/lib/utils";

export const THINKING_OPTIONS = [
  {
    id: "none",
    label: "Off",
    icon: CircleOff,
    color: "text-muted-foreground",
    bgColor: "bg-muted/30",
    description: "No extended thinking",
  },
  {
    id: "low",
    label: "Low",
    icon: Brain,
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    description: "Brief reasoning",
  },
  {
    id: "medium",
    label: "Medium",
    icon: BrainCog,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    description: "Balanced thinking",
  },
  {
    id: "high",
    label: "High",
    icon: BrainCircuit,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    description: "Deep reasoning",
  },
] as const;

function getThinkingOption(level: string | undefined) {
  return THINKING_OPTIONS.find((t) => t.id === level) || THINKING_OPTIONS[2]; // default medium
}

interface ThinkingToggleProps {
  currentLevel: string | undefined;
  onLevelChange: (level: string) => void;
  disabled?: boolean;
  compact?: boolean;
}

export function ThinkingToggle({
  currentLevel,
  onLevelChange,
  disabled = false,
  compact = false,
}: ThinkingToggleProps) {
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

  const current = getThinkingOption(currentLevel);
  const Icon = current.icon;
  const isEnabled = current.id !== "none";

  return (
    <div ref={containerRef} className="relative" data-testid="thinking-toggle">
      {/* Trigger button */}
      <button
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={cn(
          "flex items-center gap-1 rounded-full border transition-all",
          "hover:border-border hover:bg-muted/50",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          isEnabled
            ? "border-border/50"
            : "border-border/30 opacity-70",
          compact ? "px-2 py-0.5 text-[10px] max-md:px-3 max-md:py-2 max-md:text-xs max-md:min-h-[44px]" : "px-2.5 py-1 text-[11px]",
        )}
        data-testid="thinking-toggle-trigger"
        title={`Thinking: ${current.label}`}
      >
        <Icon className={cn("shrink-0", current.color, compact ? "h-3 w-3" : "h-3.5 w-3.5")} />
        <span className="font-medium text-foreground">{current.label}</span>
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
          data-testid="thinking-toggle-dropdown"
        >
          {THINKING_OPTIONS.map((option) => {
            const OptIcon = option.icon;
            const isSelected = option.id === current.id;
            return (
              <button
                key={option.id}
                onClick={() => {
                  onLevelChange(option.id);
                  setOpen(false);
                }}
                className={cn(
                  "flex items-center gap-2.5 w-full px-3 py-2 max-md:py-3 max-md:min-h-[44px] text-left transition-colors",
                  "hover:bg-muted/50",
                  isSelected && "bg-muted/30",
                )}
                data-testid={`thinking-option-${option.id}`}
              >
                <div className={cn("h-7 w-7 rounded-full flex items-center justify-center shrink-0", option.bgColor)}>
                  <OptIcon className={cn("h-3.5 w-3.5", option.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-foreground">{option.label}</div>
                  <div className="text-[10px] text-muted-foreground">{option.description}</div>
                </div>
                {isSelected && (
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-indigo shrink-0" data-testid="thinking-selected-indicator" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
