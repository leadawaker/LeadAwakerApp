// CalendarDnd.tsx — drag/drop primitives shared by the mobile (legacy) and the
// redesigned desktop calendar. Rendered inside the page-level <DndContext>.
import type React from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import type { Appointment } from "../lib/calendarDesign";

// ── Draggable booking card ───────────────────────────────────────────────────
export function DraggableBookingCard({
  appt,
  onClick,
  className,
  style,
  children,
}: {
  appt: Appointment;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `booking-${appt.id}`,
    data: { appt },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick?.(e as any); } }}
      className={cn(className, isDragging && "opacity-30")}
      style={{ ...style, cursor: isDragging ? "grabbing" : "grab", touchAction: "none" }}
      data-testid={`booking-card-${appt.id}`}
    >
      {children}
    </div>
  );
}

// ── Droppable day cell ───────────────────────────────────────────────────────
export function DroppableDay({
  dateKey,
  children,
  className,
  style,
  onClick,
  onKeyDown,
  wineHighlight,
  "aria-label": ariaLabel,
  "data-testid": dataTestId,
}: {
  dateKey: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  wineHighlight?: boolean;
  "aria-label"?: string;
  "data-testid"?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-drop-${dateKey}`, data: { dateKey } });

  return (
    <div
      ref={setNodeRef}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={onKeyDown}
      aria-label={ariaLabel}
      className={cn(
        className,
        isOver && (wineHighlight
          ? "ring-2 ring-inset ring-[var(--wine)] bg-[var(--wine-tint)]"
          : "ring-2 ring-inset ring-brand-indigo bg-brand-indigo/10"),
      )}
      style={style}
      data-testid={dataTestId}
    >
      {children}
    </div>
  );
}

// ── Droppable time slot (week/day grid) ──────────────────────────────────────
export function DroppableTimeSlot({
  dateKey,
  hour,
  top,
  height,
  wineHighlight,
}: {
  dateKey: string;
  hour: number;
  top: number | string;
  height: number | string;
  wineHighlight?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `timeslot-drop-${dateKey}-${hour}`,
    data: { dateKey, hour },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "absolute left-0 right-0",
        isOver && (wineHighlight ? "bg-[var(--wine-tint)]" : "bg-brand-indigo/10"),
      )}
      style={{ top, height }}
      data-testid={`timeslot-${dateKey}-${hour}`}
    />
  );
}
