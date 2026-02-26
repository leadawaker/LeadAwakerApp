import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { resolveColor, COLOR_PALETTE } from "../types";

/* ════════════════════════════════════════════════════════════════════════════
   ColorPicker — full popover picker for dialogs
   ════════════════════════════════════════════════════════════════════════════ */

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  "data-testid"?: string;
}

export function ColorPicker({ value, onChange, "data-testid": testId }: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const hex = resolveColor(value);
  const label = value.charAt(0).toUpperCase() + value.slice(1);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid={testId}
          className="flex items-center gap-2 w-full h-9 px-3 rounded-md border border-input bg-background text-sm hover:bg-accent hover:text-accent-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          aria-label={`Selected color: ${label}`}
        >
          <span
            className="inline-block h-4 w-4 rounded-full shrink-0 shadow-sm ring-1 ring-black/10"
            style={{ backgroundColor: hex }}
          />
          <span className="flex-1 text-left">{label}</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-3"
        align="start"
        data-testid={testId ? `${testId}-popover` : undefined}
      >
        <div className="mb-2 text-xs font-medium text-muted-foreground">Choose a color</div>
        <div className="grid grid-cols-5 gap-2">
          {COLOR_PALETTE.map(([colorName, colorHex]) => {
            const isSelected = value === colorName;
            return (
              <button
                key={colorName}
                type="button"
                title={colorName.charAt(0).toUpperCase() + colorName.slice(1)}
                data-testid={testId ? `${testId}-swatch-${colorName}` : undefined}
                onClick={() => {
                  onChange(colorName);
                  setOpen(false);
                }}
                className={cn(
                  "relative h-8 w-8 rounded-full transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-1",
                  isSelected && "ring-2 ring-offset-2 ring-foreground scale-110",
                )}
                style={{ backgroundColor: colorHex }}
              >
                {isSelected && (
                  <Check className="absolute inset-0 m-auto h-4 w-4 text-white drop-shadow-sm" />
                )}
              </button>
            );
          })}
        </div>
        <div className="mt-2 text-xs text-center text-muted-foreground capitalize font-medium">
          {label}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   InlineColorPicker — compact picker for table cells
   ════════════════════════════════════════════════════════════════════════════ */

export function InlineColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (c: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const hex = resolveColor(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="h-4 w-4 rounded-full ring-1 ring-black/10 hover:scale-110 transition-transform"
          style={{ backgroundColor: hex }}
        />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="start" side="bottom">
        <div className="grid grid-cols-5 gap-1.5">
          {COLOR_PALETTE.map(([colorName, colorHex]) => (
            <button
              key={colorName}
              type="button"
              title={colorName}
              onClick={() => {
                onChange(colorName);
                setOpen(false);
              }}
              className={cn(
                "h-6 w-6 rounded-full transition-transform hover:scale-110 focus:outline-none",
                value === colorName && "ring-2 ring-offset-1 ring-foreground",
              )}
              style={{ backgroundColor: colorHex }}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
