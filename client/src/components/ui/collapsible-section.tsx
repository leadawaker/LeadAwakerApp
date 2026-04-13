import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface CollapsibleSectionProps {
  id: string;
  title: string;
  icon?: React.ElementType;
  defaultOpen?: boolean;
  trailing?: React.ReactNode;
  hasData?: boolean;
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
  defaultOpen = true,
  trailing,
  hasData,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(() => readOpen(id, defaultOpen));

  function toggle() {
    setOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(getStorageKey(id), String(next));
      } catch {}
      return next;
    });
  }

  const accentActive = open && hasData;

  return (
    <div className={cn(accentActive && "border-l-2 border-brand-indigo/20 pl-1.5 -ml-1.5")}>
      <div className="h-px bg-border/40" />
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center gap-2 py-2 px-1 select-none"
      >
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 transition-transform duration-200",
            !open && "-rotate-90",
            hasData ? "text-foreground/70" : "text-muted-foreground/60",
          )}
        />
        {Icon && <Icon className={cn("h-3.5 w-3.5", accentActive ? "text-brand-indigo/50" : hasData ? "text-foreground/70" : "text-muted-foreground/60")} />}
        <span className={cn("text-[11px] font-bold uppercase tracking-widest", hasData ? "text-foreground/70" : "text-muted-foreground/60")}>
          {title}
        </span>
        {trailing && <span className="ml-auto">{trailing}</span>}
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
