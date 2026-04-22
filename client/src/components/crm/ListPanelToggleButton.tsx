import { PanelLeft, Columns2, PanelLeftClose } from "lucide-react";
import { cn } from "@/lib/utils";
import { useListPanelState } from "@/hooks/useListPanelState";

interface Props {
  className?: string;
}

/**
 * Pill-style button that cycles the shared list-panel state:
 * full → compact → hidden → full. Same visual across Prospects/Leads/Campaigns/Chats.
 */
export function ListPanelToggleButton({ className }: Props) {
  const { state, cycle } = useListPanelState();

  return (
    <button
      onClick={cycle}
      className={cn(
        "hidden lg:inline-flex items-center gap-1 h-9 pl-2 pr-2.5 rounded-full border border-black/[0.125] shrink-0 text-foreground/60 hover:text-foreground transition-colors",
        className,
      )}
      title={
        state === "full" ? "List: full (click for compact)"
        : state === "compact" ? "List: compact (click to hide)"
        : "List: hidden (click to show)"
      }
      aria-label={`List panel: ${state}. Click to change.`}
    >
      {state === "full" ? (
        <PanelLeft className="h-4 w-4" />
      ) : state === "compact" ? (
        <Columns2 className="h-4 w-4" />
      ) : (
        <PanelLeftClose className="h-4 w-4" />
      )}
      <span className="flex items-center gap-0.5" aria-hidden="true">
        <span className={cn("w-1 h-1 rounded-full", state === "full" ? "bg-brand-indigo" : "bg-foreground/20")} />
        <span className={cn("w-1 h-1 rounded-full", state === "compact" ? "bg-brand-indigo" : "bg-foreground/20")} />
        <span className={cn("w-1 h-1 rounded-full", state === "hidden" ? "bg-brand-indigo" : "bg-foreground/20")} />
      </span>
    </button>
  );
}
