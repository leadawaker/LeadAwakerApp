import { CheckCircle2, XCircle } from "lucide-react";

export function BoolRow({
  label,
  value,
  editChild,
  icon: Icon,
}: {
  label: string;
  value: boolean | null | undefined;
  editChild?: React.ReactNode;
  icon?: React.ElementType;
}) {
  return (
    <div className="flex flex-col gap-0.5 py-2 border-b border-border/20 last:border-0">
      <span className="text-[10px] font-medium uppercase tracking-wider text-foreground/40 flex items-center gap-1">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </span>
      {editChild ?? (
        value
          ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          : <XCircle className="w-4 h-4 text-foreground/25" />
      )}
    </div>
  );
}
