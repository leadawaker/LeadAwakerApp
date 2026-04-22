import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import type { CompactTab } from "./CompactTabPuck";

interface Props {
  tabs: CompactTab[];
  activeId: string;
  onChange: (id: string) => void;
}

/**
 * Single-icon tab trigger that opens a horizontal popover revealing all tabs.
 * Saves vertical space in compact rails: one 36px slot instead of N stacked tabs.
 */
export function CompactTabPopover({ tabs, activeId, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const activeTab = tabs.find((t) => t.id === activeId) ?? tabs[0];
  const ActiveIcon = activeTab?.icon;

  useEffect(() => {
    if (!open) { setRect(null); return; }
    if (btnRef.current) setRect(btnRef.current.getBoundingClientRect());
  }, [open]);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (popoverRef.current?.contains(e.target as Node)) return;
      if (btnRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="flex justify-center pt-3 pb-1.5 shrink-0">
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        title={activeTab?.label}
        className={cn(
          "relative h-9 w-9 rounded-full border border-black/[0.125] bg-white dark:bg-card shadow-sm flex items-center justify-center text-foreground transition-colors hover:bg-card-hover"
        )}
      >
        {ActiveIcon && <ActiveIcon className="h-4 w-4 shrink-0" />}
      </button>

      {open && rect && createPortal(
        <div
          ref={popoverRef}
          className="fixed z-50"
          style={{ top: rect.top, left: rect.right + 6 }}
        >
          <div className="relative inline-flex items-center h-9 rounded-full border border-black/[0.125] bg-muted/50 backdrop-blur p-0.5 shadow-xl">
            <div
              className="absolute top-0.5 bottom-0.5 w-9 rounded-full bg-white dark:bg-card shadow-sm transition-transform duration-200 ease-out"
              style={{
                transform: `translateX(${Math.max(0, tabs.findIndex((t) => t.id === activeId)) * 36}px)`,
                left: 2,
              }}
            />
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeId === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => { onChange(tab.id); setOpen(false); }}
                  title={tab.label}
                  className={cn(
                    "relative h-9 w-9 rounded-full flex items-center justify-center transition-colors duration-200",
                    isActive ? "text-foreground" : "text-foreground/40 hover:text-foreground"
                  )}
                >
                  {Icon && <Icon className="h-4 w-4 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
