import { CalendarCheck, MessageSquare, Phone, UserPlus } from "lucide-react";
import type { CrmReceipt } from "../types";

/**
 * What the engine confirms it wrote to the CRM during the call.
 *
 * Deliberately does NOT repeat the conversation: the transcript already lives
 * in the call panel, and printing every turn twice on one screen made the page
 * read as two transcripts rather than "a call on the left, your CRM filling in
 * on the right". This shows the CRM *record* — the lead, the counts, the
 * booking. Every figure still corresponds to a write acknowledged by
 * `/voice/relay`; nothing is drawn optimistically.
 */
export function CrmPanel({
  receipts,
  leadId,
  phone,
  live,
}: {
  receipts: CrmReceipt[];
  leadId: number | null;
  phone: string;
  live: boolean;
}) {
  const logged = receipts.filter((r) => r.interaction_id);
  const inbound = logged.filter((r) => r.direction === "inbound").length;
  const outbound = logged.length - inbound;
  const booked = receipts.find((r) => r.booked_slot);

  return (
    <div className="flex flex-1 flex-col overflow-hidden border-border max-lg:border-t lg:border-l">
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <div>
          <div className="text-sm font-semibold">In the CRM</div>
          <div className="text-xs text-muted-foreground">Written live, as she talks</div>
        </div>
        {live && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            Live
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {receipts.length === 0 ? (
          <p className="mt-10 text-center text-sm text-muted-foreground">
            Nothing written yet. The moment either of you speaks, a lead is created
            and every turn is saved against it.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="rounded-[var(--r-surface)] border border-border/60 bg-card p-4">
              <div className="mb-3 flex items-center gap-2">
                <UserPlus className="h-4 w-4 flex-none text-primary" />
                <span className="text-sm font-semibold">
                  {leadId ? `Lead #${leadId}` : "Lead"}
                </span>
                <span className="rounded-full bg-highlight-selected px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                  New
                </span>
              </div>
              <dl className="space-y-1.5 text-sm">
                <Row label="Phone" value={phone || "web"} />
                <Row label="Source" value="Inbound call" />
                <Row
                  label="Status"
                  value={booked ? "Appointment booked" : "In conversation"}
                />
              </dl>
            </div>

            <div className="rounded-[var(--r-surface)] border border-border/60 bg-card p-4">
              <div className="mb-3 flex items-center gap-2">
                <MessageSquare className="h-4 w-4 flex-none text-primary" />
                <span className="text-sm font-semibold">Conversation logged</span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <Stat label="Turns" value={logged.length} />
                <Stat label="Caller" value={inbound} />
                <Stat label="Emma" value={outbound} />
              </div>
            </div>

            <div
              className={
                booked
                  ? "flex items-center gap-2.5 rounded-[var(--r-surface)] bg-emerald-50 px-4 py-3 text-sm dark:bg-emerald-900/20"
                  : "flex items-center gap-2.5 rounded-[var(--r-surface)] border border-dashed border-border px-4 py-3 text-sm text-muted-foreground"
              }
            >
              {booked ? (
                <>
                  <CalendarCheck className="h-4 w-4 flex-none text-emerald-600" />
                  <span>Appointment booked · {booked.booked_slot}</span>
                </>
              ) : (
                <>
                  <Phone className="h-4 w-4 flex-none" />
                  <span>No appointment booked yet</span>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <p className="border-t border-border px-5 py-2.5 text-[11px] text-muted-foreground">
        Every figure above is a real write to the CRM, confirmed by the server.
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium">{value}</dd>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[var(--r-surface)] bg-muted px-2 py-2.5">
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}
