import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * SectionCard — larger container surface (kanban column, detail section, widget
 * shell). Kept separate from shadcn ui/card.tsx so adopting it never forces a
 * sweep of every existing <Card>.
 *
 * Tokens: --panel-radius, --panel-bg, --panel-pad, --panel-shadow.
 */
export interface SectionCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Bake the standard panel padding. Default true. */
  padded?: boolean;
  /** Resting panel shadow. Default true. */
  elevated?: boolean;
}

export const SectionCard = React.forwardRef<HTMLDivElement, SectionCardProps>(function SectionCard(
  { padded = true, elevated = true, className, children, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        "rounded-[var(--panel-radius)] bg-[var(--panel-bg)]",
        padded && "p-[var(--panel-pad)]",
        elevated && "shadow-[var(--panel-shadow)]",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
});
