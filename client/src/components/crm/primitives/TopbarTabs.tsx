// Page tabs for the PageTopbar: the same pill as PillSwitch (solid), the `.la-seg--main` track with
// sans items, a 14px icon and the selected tab a raised wine fill. Optional icons and badges.
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface TopbarTab<Id extends string> {
  id: Id;
  label: string;
  icon?: LucideIcon;
  /** Small trailing content. A number or string renders as the shared `.la-seg-count`
   *  badge, which stays readable (bone) on the selected wine fill. */
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
    <div className={cn("la-seg la-seg--main shrink-0", className)} role="tablist" aria-label={ariaLabel} data-testid={testId}>
      {tabs.map(({ id, label, icon: Icon, badge }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={value === id}
          className={cn("la-seg-btn", value === id && "on")}
          onClick={() => onChange(id)}
          data-testid={testIdPrefix ? `${testIdPrefix}-${id}` : undefined}
        >
          {Icon && <Icon size={14} style={{ flexShrink: 0 }} />}
          {label}
          {typeof badge === "number" || typeof badge === "string" ? <span className="la-seg-count">{badge}</span> : badge}
        </button>
      ))}
    </div>
  );
}
