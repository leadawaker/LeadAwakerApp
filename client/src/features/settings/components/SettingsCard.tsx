import type { ElementType, HTMLAttributes, ReactNode } from "react";
import { SectionCard } from "@/components/crm/primitives";
import { cn } from "@/lib/utils";

/**
 * One block on the Profile / Preferences tabs: a SectionCard with an optional
 * icon + title + description header above its content.
 */
export function SettingsCard({
  icon: Icon,
  title,
  description,
  action,
  className,
  children,
  ...rest
}: {
  icon?: ElementType;
  title?: ReactNode;
  description?: ReactNode;
  /** Right-aligned header slot (e.g. a status or a small control). */
  action?: ReactNode;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <SectionCard className={cn("p-5 space-y-4", className)} {...rest}>
      {title && (
        <div className="flex items-start gap-3">
          {Icon && (
            <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-foreground">{title}</div>
            {description && <div className="text-xs text-muted-foreground mt-0.5">{description}</div>}
          </div>
          {action}
        </div>
      )}
      {children}
    </SectionCard>
  );
}
