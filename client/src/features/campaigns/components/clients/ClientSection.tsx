import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { SectionCard } from "@/components/crm/primitives";
import "@/features/automation/automation.css";
import "./clients.css";

/** One block of the persona panel: icon tile, title, a one-line blurb, a short verdict, then the body. */
export function ClientSection({ icon: Icon, title, blurb, aside, children }: {
  icon: LucideIcon;
  title: string;
  blurb?: string;
  /** Right side of the header: a verdict or a small control. */
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <SectionCard padded={false} className="overflow-hidden">
      <div className="am-section-head dp-card-head">
        <span className="am-icon-tile"><Icon className="h-4 w-4" /></span>
        <div style={{ flex: "1 1 220px", minWidth: 0 }}>
          <div className="am-section-title">{title}</div>
          {blurb && <div style={{ fontSize: 12.5, color: "var(--mute)", marginTop: 1, lineHeight: 1.45 }}>{blurb}</div>}
        </div>
        {aside}
      </div>
      <div className="dp-card-body">{children}</div>
    </SectionCard>
  );
}
