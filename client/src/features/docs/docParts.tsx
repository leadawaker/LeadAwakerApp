/**
 * Shared building blocks and stage colours for the in-app documentation
 * (Docs page, ReactivationGuide, ClientGuide).
 */

import { useState } from "react";
import { AlertCircle, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { PIPELINE_HEX } from "@/lib/avatarUtils";

// ── Status colors ─────────────────────────────────────────────────────────────
// Pipeline-stage colors come from the shared PIPELINE_HEX map so the docs match
// the live app. The locale uses lowercase keys; bridge them to PIPELINE_HEX's
// TitleCase keys here, then read everything through STAGE_HEX.
export const STAGE_KEYS = [
  "new", "contacted", "responded", "multipleResponses",
  "qualified", "booked", "closed", "lost", "dnd",
] as const;

export const STAGE_KEY_TO_HEX: Record<string, string> = {
  new:               PIPELINE_HEX.New,
  contacted:         PIPELINE_HEX.Contacted,
  responded:         PIPELINE_HEX.Responded,
  multipleResponses: PIPELINE_HEX["Multiple Responses"],
  qualified:         PIPELINE_HEX.Qualified,
  booked:            PIPELINE_HEX.Booked,
  closed:            PIPELINE_HEX.Closed,
  lost:              PIPELINE_HEX.Lost,
  dnd:               PIPELINE_HEX.DND,
};


export function DocSection({
  id,
  icon: Icon,
  title,
  children,
}: {
  id?: string;
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div id={id} className="neu-raised overflow-hidden scroll-mt-6" style={{ borderRadius: "var(--r-card)" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-foreground/[0.03] transition-colors text-left"
      >
        <Icon className="h-4 w-4 text-brand-indigo shrink-0" />
        <span className="font-semibold text-sm flex-1">{title}</span>
        <ChevronRight
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform duration-150",
            open && "rotate-90"
          )}
        />
      </button>
      {open && (
        <div
          style={{ borderTop: "1px solid var(--line)" }}
          className="px-5 py-5 space-y-4 text-sm text-foreground/80 leading-relaxed"
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-indigo/10 text-brand-indigo text-xs font-bold flex items-center justify-center mt-0.5">
        {n}
      </span>
      {typeof children === "string"
        ? <span dangerouslySetInnerHTML={{ __html: children }} />
        : <span>{children}</span>}
    </div>
  );
}

export function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 p-3 rounded-[var(--r-button)] bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 text-xs text-amber-800 dark:text-amber-200">
      <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-500" />
      {typeof children === "string"
        ? <span dangerouslySetInnerHTML={{ __html: children }} />
        : <span>{children}</span>}
    </div>
  );
}
