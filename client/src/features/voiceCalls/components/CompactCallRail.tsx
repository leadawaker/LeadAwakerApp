import { useCallback, useRef, type ReactNode } from "react";
import { AudioLines } from "lucide-react";
import { COMPACT_RAIL_WIDTH, CompactHoverCardPortal, useCompactHoverCard } from "@/components/crm/CompactEntityRail";
import type { VoiceCallStatus } from "../status";
import { CallAvatar } from "./bits";

export interface RailItem {
  key: string;
  ini: string;
  status: VoiceCallStatus;
  title: string;
}

export const RAIL_WIDTH = COMPACT_RAIL_WIDTH;

const keyOf = (item: RailItem) => item.key;

/**
 * The minimized list, as on the Chats page: one status-tinted avatar per row,
 * the open one ringed in wine, and the full card floating beside it on hover.
 */
export function CompactCallRail({ items, selection, onSelect, renderCard }: {
  items: RailItem[];
  selection: string | null;
  onSelect: (key: string) => void;
  /** The full list card for one row, shown on hover. */
  renderCard: (key: string) => ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const findEl = useCallback(
    (id: string | number) => rootRef.current?.querySelector<HTMLElement>(`[data-rail-key="${CSS.escape(String(id))}"]`) ?? null,
    [],
  );
  const { hovered, rect, onHover, onHoverEnd, cancelHoverEnd, close } = useCompactHoverCard<RailItem>(keyOf, findEl);

  return (
    <div ref={rootRef} style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden" }}>
      {items.length === 0 ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "24px 0", color: "var(--mute-2)" }}>
          <AudioLines size={18} />
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 9, padding: "12px 0 20px" }}>
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              data-rail-key={item.key}
              aria-label={item.title}
              onClick={() => { onSelect(item.key); close(); }}
              onMouseEnter={(e) => onHover(item, e.currentTarget.getBoundingClientRect())}
              onMouseLeave={onHoverEnd}
              style={{
                flexShrink: 0, padding: 0, border: "none", background: "transparent", cursor: "pointer", borderRadius: 11,
                boxShadow: selection === item.key ? "0 0 0 2px var(--wine)" : "none",
                transition: "box-shadow 120ms",
              }}
            >
              <CallAvatar ini={item.ini} status={item.status} size={38} />
            </button>
          ))}
        </div>
      )}
      {hovered && (
        <CompactHoverCardPortal rect={rect} width={330} onMouseEnter={cancelHoverEnd} onMouseLeave={onHoverEnd}>
          <div onClick={close}>{renderCard(hovered.key)}</div>
        </CompactHoverCardPortal>
      )}
    </div>
  );
}
