import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Option {
  value: string;
  label: string;
  className?: string;
}

interface SimpleSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
  contentClassName?: string;
}

export function SimpleSelect({
  value,
  onValueChange,
  options,
  placeholder,
  className,
  contentClassName
}: SimpleSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.value === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex h-7 w-full items-center justify-between whitespace-nowrap rounded-md border border-border/40 bg-transparent px-2 py-1 text-[11px] shadow-none transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
      >
        <span className="truncate">
          {selectedOption?.label || placeholder || "Select..."}
        </span>
        <ChevronDown className={cn("h-3 w-3 shrink-0 opacity-50 transition-transform duration-200", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div
          className={cn(
            "absolute left-0 top-full mt-1 min-w-full z-[9999] overflow-hidden rounded-md border bg-white dark:bg-slate-900 shadow-lg animate-in fade-in-0 zoom-in-95",
            contentClassName
          )}
        >
          <div className="p-1">
            {options.map((option) => (
              <div
                key={option.value}
                onClick={() => {
                  onValueChange(option.value);
                  setIsOpen(false);
                }}
                className={cn(
                  "relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none transition-colors hover:bg-gray-100 dark:hover:bg-slate-800",
                  option.value === value && "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
                  option.className
                )}
              >
                <span className="truncate">{option.label}</span>
                {option.value === value && (
                  <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
                    <Check className="h-4 w-4" />
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}