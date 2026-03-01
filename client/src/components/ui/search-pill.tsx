import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchPillProps {
  value: string;
  onChange: (value: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  placeholder?: string;
  className?: string;
}

export function SearchPill({ value, onChange, open, onOpenChange, placeholder = "Search...", className }: SearchPillProps) {
  if (open) {
    return (
      <div className={cn("flex items-center gap-1.5 h-10 rounded-full border border-black/[0.125] bg-card/60 px-2.5 shrink-0", className)}>
        <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <input
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          onBlur={() => { if (!value) onOpenChange(false); }}
          className="text-[12px] bg-transparent outline-none w-24 min-w-0 text-foreground placeholder:text-muted-foreground/60"
        />
        <button type="button" onClick={() => { onChange(""); onOpenChange(false); }}>
          <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onOpenChange(true)}
      className={cn(
        "icon-circle-lg icon-circle-base",
        value && "border-brand-indigo/40 text-brand-indigo",
        className,
      )}
    >
      <Search className="h-4 w-4" />
    </button>
  );
}
