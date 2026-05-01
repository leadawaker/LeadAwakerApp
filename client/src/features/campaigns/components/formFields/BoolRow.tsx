import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function BoolRow({
  label,
  value,
  editChild,
  icon: Icon,
  onDirectToggle,
}: {
  label: string;
  value: boolean | null | undefined;
  editChild?: React.ReactNode;
  icon?: React.ElementType;
  onDirectToggle?: () => void;
}) {
  return (
    <div className="flex flex-col gap-0.5 py-2 border-b border-border/20 last:border-0">
      <span className="text-[12px] font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
        {Icon && <Icon className="w-4 h-4 text-brand-indigo" />}
        {label}
      </span>
      {editChild ?? (
        <div
          onClick={onDirectToggle}
          className={cn(onDirectToggle && "cursor-pointer w-fit rounded px-0.5 -mx-0.5 hover:opacity-70 transition-opacity")}
        >
          {value
            ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            : <XCircle className="w-4 h-4 text-foreground/25" />
          }
        </div>
      )}
    </div>
  );
}
