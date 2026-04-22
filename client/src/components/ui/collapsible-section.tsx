import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface CollapsibleSectionProps {
  id: string;
  title: string;
  icon?: React.ElementType;
  activeIconClass?: string;
  defaultOpen?: boolean;
  trailing?: React.ReactNode;
  hasData?: boolean;
  hideDivider?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

function getStorageKey(id: string) {
  return `prospect-section-${id}`;
}

function readOpen(id: string, defaultOpen: boolean): boolean {
  try {
    const stored = localStorage.getItem(getStorageKey(id));
    if (stored !== null) return stored === "true";
  } catch {}
  return defaultOpen;
}

export function CollapsibleSection({
  id,
  title,
  icon: Icon,
  activeIconClass,
  defaultOpen = true,
  trailing,
  hasData,
  hideDivider = false,
  open: openProp,
  onOpenChange,
  children,
}: CollapsibleSectionProps) {
  const [openLocal, setOpenLocal] = useState(() => readOpen(id, defaultOpen));
  const open = openProp !== undefined ? openProp : openLocal;

  function toggle() {
    const next = !open;
    setOpenLocal(next);
    try { localStorage.setItem(getStorageKey(id), String(next)); } catch {}
    onOpenChange?.(next);
  }

  const accentActive = open && hasData;

  return (
    <div>
      {!hideDivider && <div className="h-px bg-border/40" />}
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center gap-2 py-2 px-1 select-none"
      >
        {Icon && <Icon className={cn("h-4 w-4", open ? (activeIconClass ?? "text-brand-indigo/60") : "text-foreground/50")} />}
        <span className={cn("text-sm font-medium", open ? "text-foreground/80" : "text-foreground/60")}>
          {title}
        </span>
        {trailing && <span className="ml-auto flex items-center gap-1" onClick={(e) => e.stopPropagation()}>{trailing}</span>}
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 transition-transform duration-200",
            !trailing && "ml-auto",
            !open && "-rotate-90",
            hasData ? "text-foreground/40" : "text-muted-foreground/40",
          )}
        />
      </button>
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className={cn("overflow-hidden", !hasData && "pb-2")}>
          {!hasData ? (
            <div className="border border-dashed border-border/30 rounded-lg px-3 py-2.5">
              {children}
            </div>
          ) : children}
        </div>
      </div>
    </div>
  );
}
