import { Search, X } from "lucide-react";
import { useRef, useState } from "react";
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
  const inputRef = useRef<HTMLInputElement>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  const expanded = open || hovered || focused || !!value;

  return (
    <div
      role="search"
      className={cn(
        "inline-flex items-center h-9 pl-[9px] pr-2.5 rounded-full border font-medium overflow-hidden shrink-0 cursor-text",
        "transition-[max-width,color,border-color] duration-200",
        expanded ? "max-w-[180px]" : "max-w-9",
        value || focused
          ? "border-brand-indigo/40 text-brand-indigo"
          : "border-black/[0.125] text-foreground/60 hover:text-foreground",
        className
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => inputRef.current?.focus()}
    >
      <Search className="h-4 w-4 shrink-0" />
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        onFocus={() => { setFocused(true); onOpenChange(true); }}
        onBlur={() => { setFocused(false); if (!value) onOpenChange(false); }}
        className={cn(
          "bg-transparent outline-none min-w-0 text-[12px] text-foreground placeholder:text-muted-foreground/60 w-[130px]",
          "pl-1.5 transition-opacity duration-150",
          expanded ? "opacity-100" : "opacity-0"
        )}
      />
      {value && (
        <button
          type="button"
          className="ml-0.5 shrink-0"
          onClick={(e) => { e.stopPropagation(); onChange(""); inputRef.current?.focus(); }}
        >
          <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
        </button>
      )}
    </div>
  );
}
