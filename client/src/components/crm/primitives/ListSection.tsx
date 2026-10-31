// A titled section: the title sits on the page ground, the content on its own white raised card.
// Splits one long panel into smaller cards (list groups and the lead panels on Calls and Chats).
import type { ReactNode } from "react";

export interface ListSectionProps {
  /** No label: the card alone. */
  label?: ReactNode;
  count?: number;
  /** Sits at the right end of the title row. */
  trailing?: ReactNode;
  children: ReactNode;
  testId?: string;
}

export function ListSection({ label, count, trailing, children, testId }: ListSectionProps) {
  return (
    <section className="la-list-section" data-testid={testId}>
      {label != null && (
        <h3 className="la-list-section-title">
          {label}
          {count !== undefined && <span className="la-list-section-count">{count}</span>}
          {trailing && <span className="la-list-section-trailing">{trailing}</span>}
        </h3>
      )}
      <div className="la-list-section-card">{children}</div>
    </section>
  );
}
