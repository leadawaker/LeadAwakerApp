import { useEffect, useRef } from "react";
import { CalendarCheck, Phone, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CrmReceipt } from "../types";

/**
 * Mirrors what the engine confirms it wrote to the CRM during the call, so a
 * prospect watches the lead and its conversation appear while they talk. Every
 * row here corresponds to a real Leads/Interactions write acknowledged by
 * `/voice/relay`; nothing is drawn optimistically.
 */
export function CrmPanel({
  receipts,
  leadId,
  live,
}: {
  receipts: CrmReceipt[];
  leadId: number | null;
  live: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [receipts]);

  const logged = receipts.filter((r) => r.interaction_id);
  const booked = receipts.find((r) => r.booked_slot);

  return (
    <div className="flex flex-1 flex-col overflow-hidden border-border max-lg:border-t lg:border-l">
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <div>
          <div className="text-sm font-semibold">In the CRM</div>
          <div className="text-xs text-muted-foreground">
            {leadId ? `Lead #${leadId}` : "Waiting for the first turn"}
          </div>
        </div>
        {live && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            Live
          </span>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-5">
        {receipts.length === 0 ? (
          <p className="mt-10 text-center text-sm text-muted-foreground">
            Nothing written yet. As soon as either of you speaks, the lead and every
            turn are saved here.
          </p>
        ) : (
          <ol className="space-y-2.5">
            {receipts.some((r) => r.created_lead) && (
              <li className="flex items-center gap-2.5 rounded-[var(--r-surface)] bg-highlight-selected px-3.5 py-2.5 text-sm">
                <UserPlus className="h-4 w-4 flex-none text-primary" />
                <span>
                  Lead created{leadId ? ` · #${leadId}` : ""}
                </span>
              </li>
            )}

            {logged.map((r) => (
              <li
                key={r.interaction_id}
                className="rounded-[var(--r-surface)] border border-border/60 bg-card px-3.5 py-2.5"
              >
                <div className="mb-1 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
                    <Phone className="h-2.5 w-2.5" />
                    Call
                  </span>
                  <span className="text-xs font-medium">{r.who}</span>
                  <span
                    className={cn(
                      "text-[10px] uppercase tracking-wide",
                      r.direction === "inbound" ? "text-sky-600" : "text-muted-foreground",
                    )}
                  >
                    {r.direction}
                  </span>
                </div>
                <p className="line-clamp-3 text-sm leading-relaxed text-foreground/90">
                  {r.content}
                </p>
              </li>
            ))}

            {booked && (
              <li className="flex items-center gap-2.5 rounded-[var(--r-surface)] bg-emerald-50 px-3.5 py-2.5 text-sm dark:bg-emerald-900/20">
                <CalendarCheck className="h-4 w-4 flex-none text-emerald-600" />
                <span>Appointment booked · {booked.booked_slot}</span>
              </li>
            )}
          </ol>
        )}
      </div>

      <p className="border-t border-border px-5 py-2.5 text-[11px] text-muted-foreground">
        Every row above is a real write to the CRM, confirmed by the server.
      </p>
    </div>
  );
}
