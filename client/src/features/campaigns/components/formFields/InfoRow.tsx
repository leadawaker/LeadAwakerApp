import { cn } from "@/lib/utils";

export function InfoRow({
  label,
  value,
  mono = false,
  editChild,
  richText = false,
  icon: Icon,
  onStartEdit,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  editChild?: React.ReactNode;
  richText?: boolean;
  icon?: React.ElementType;
  onStartEdit?: () => void;
}) {
  const renderValue = () => {
    if (value == null) return <span className="text-[12px] text-foreground">{"—"}</span>;
    if (richText && typeof value === "string") {
      return (
        <div
          className={cn(
            "text-[12px] text-foreground break-words leading-relaxed",
            mono && "font-mono text-[11px]"
          )}
          style={{ whiteSpace: "pre-wrap" }}
          dangerouslySetInnerHTML={{
            __html: value
              .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
              .replace(/\*(.*?)\*/g, "<em>$1</em>")
              .replace(/\n/g, "<br/>"),
          }}
        />
      );
    }
    if (typeof value === "string" && value.includes("\n")) {
      return (
        <pre
          className={cn(
            "text-[12px] text-foreground break-words leading-relaxed font-sans",
            mono && "font-mono text-[11px]"
          )}
        >
          {value}
        </pre>
      );
    }
    return (
      <span className={cn("text-[12px] text-foreground break-words", mono && "font-mono text-[11px]")}>
        {value}
      </span>
    );
  };

  const valueNode = editChild ?? (
    <div
      onClick={onStartEdit}
      className={cn(
        onStartEdit && !editChild && "cursor-text rounded px-0.5 -mx-0.5 hover:bg-muted/50 transition-colors"
      )}
    >
      {renderValue()}
    </div>
  );

  return (
    <div className="flex flex-col gap-0.5 py-2 border-b border-border/20 last:border-0">
      <span className="text-[10px] font-medium uppercase tracking-wider text-foreground/40 flex items-center gap-1">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </span>
      {valueNode}
    </div>
  );
}
