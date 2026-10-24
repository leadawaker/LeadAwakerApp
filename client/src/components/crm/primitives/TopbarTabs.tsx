// Page tabs for the PageTopbar: the la-seg track with mono uppercase items and
// a 13px icon, as on Billing, Campaigns, Demos and Reputation.
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface TopbarTab<Id extends string> {
  id: Id;
  label: string;
  icon?: LucideIcon;
  /** Small trailing content, e.g. a count badge. */
  badge?: ReactNode;
}

export function TopbarTabs<Id extends string>({ tabs, value, onChange, ariaLabel, testId, testIdPrefix, className }: {
  tabs: TopbarTab<Id>[];
  value: Id;
  onChange: (id: Id) => void;
  ariaLabel?: string;
  /** data-testid of the track. */
  testId?: string;
  /** data-testid of each item becomes `${testIdPrefix}-${id}`. */
  testIdPrefix?: string;
  className?: string;
}) {
  return (
    <div className={cn("la-seg la-seg--fill shrink-0", className)} role="tablist" aria-label={ariaLabel} data-testid={testId}>
      {tabs.map(({ id, label, icon: Icon, badge }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={value === id}
          className={cn("la-seg-btn", value === id && "on")}
          style={{ padding: "8px 12px", fontSize: 11, letterSpacing: "0.13em" }}
          onClick={() => onChange(id)}
          data-testid={testIdPrefix ? `${testIdPrefix}-${id}` : undefined}
        >
          {Icon && <span className="flex items-center"><Icon size={13} /></span>}
          {label}
          {badge}
        </button>
      ))}
    </div>
  );
}
