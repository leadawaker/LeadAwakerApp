import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

/**
 * Compact-mode search: a pill-shaped icon button that opens a floating input to the right.
 */
export function CompactSearchOverlay({ value, onChange, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!open) { setRect(null); return; }
    if (btnRef.current) setRect(btnRef.current.getBoundingClientRect());
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        className={cn(
          "h-9 w-9 rounded-full flex items-center justify-center transition-colors",
          open || value
            ? "bg-brand-indigo/10 text-brand-indigo"
            : "text-foreground/50 hover:text-foreground hover:bg-black/[0.04]"
        )}
        onClick={() => setOpen((v) => !v)}
        title={placeholder}
      >
        {open ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
      </button>

      {open && rect && createPortal(
        <div className="fixed z-50" style={{ top: rect.top, left: rect.right + 6 }}>
          <div className="w-[300px] shadow-xl rounded-full overflow-hidden border border-black/[0.08] bg-white dark:bg-card">
            <input
              autoFocus
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              className="w-full h-9 bg-transparent px-4 text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none"
              onKeyDown={(e) => {
                if (e.key === "Escape") { setOpen(false); onChange(""); }
              }}
              onBlur={() => { if (!value) setOpen(false); }}
            />
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
