import { cn } from "@/lib/utils";
import { useListPanelState } from "@/hooks/useListPanelState";

interface Props {
  className?: string;
}

/* ── Layout state icons (custom SVG, no border, no dots) ── */

function IconFull() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
      <rect x="1" y="1" width="5" height="14" rx="1.2" />
      <rect x="8" y="1" width="7" height="14" rx="1.2" />
    </svg>
  );
}

function IconCompact() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
      <rect x="1" y="1" width="2.5" height="14" rx="1" />
      <rect x="5.5" y="1" width="9.5" height="14" rx="1.2" />
    </svg>
  );
}

function IconHidden() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
      <rect x="1" y="1" width="14" height="14" rx="1.2" />
    </svg>
  );
}

/**
 * Icon-only button that cycles the shared list-panel state:
 * full → compact → hidden → full. Same visual across all pages.
 */
export function ListPanelToggleButton({ className }: Props) {
  const { state, cycle } = useListPanelState();

  return (
    <button
      onClick={cycle}
      className={cn(
        "hidden lg:inline-flex la-btn la-btn--soft la-btn--icon",
        className,
      )}
      title={
        state === "full" ? "Compact list panel"
        : state === "compact" ? "Hide list panel"
        : "Show list panel"
      }
      aria-label={`List panel: ${state}. Click to change.`}
    >
      {state === "full" ? <IconFull /> : state === "compact" ? <IconCompact /> : <IconHidden />}
    </button>
  );
}
