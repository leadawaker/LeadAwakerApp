import { CalendarCheck, Database, Download, Phone, Sparkles, UserPlus } from "lucide-react";
import type { Booking, CallIntent, CallSummary, CrmReceipt } from "../types";
import type { DemoCopy } from "../copy";

/**
 * What the engine confirms it wrote to the CRM during the call.
 *
 * Deliberately does NOT repeat the conversation: the transcript already lives
 * in the call panel, and printing every turn twice on one screen made the page
 * read as two transcripts rather than "a call on the left, your CRM filling in
 * on the right". This shows the CRM *record* — what the caller wants, the
 * lead, the appointment, the recording. Everything here corresponds to a write
 * acknowledged by the engine; nothing is drawn optimistically.
 */

/**
 * White card surface. NOT the `bg-card` utility: `design-system.css` defines
 * `--card` as a hex while `tokens.css` maps `--color-card` to
 * `hsl(var(--card))`, so the utility resolves to `hsl(#FFFFFF)` — invalid, and
 * painted as transparent. The raw variable is a valid colour in both themes.
 */
const CARD_BG = { background: "var(--card)" } as const;

/** Reads as an outcome a business owner recognises, not an enum. */
const INTENT_KEY: Record<CallIntent, keyof DemoCopy> = {
  book_appointment: "wantsToBook",
  request_quote: "wantsAQuote",
  ask_advice: "wantsAdvice",
  existing_customer: "existingCustomer",
  complaint_or_fault: "faultOrComplaint",
  not_relevant: "notRelevant",
};

const INTENT_TONE: Record<CallIntent, string> = {
  book_appointment: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-300",
  request_quote: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-300",
  ask_advice: "bg-highlight-selected text-foreground",
  existing_customer: "bg-highlight-selected text-foreground",
  complaint_or_fault: "bg-amber-50 text-amber-800 dark:bg-amber-900/25 dark:text-amber-300",
  not_relevant: "bg-muted text-muted-foreground",
};

export function CrmPanel({
  receipts,
  leadId,
  phone,
  live,
  summary,
  booking,
  recordingUrl,
  copy,
  dateLocale,
}: {
  receipts: CrmReceipt[];
  leadId: number | null;
  phone: string;
  live: boolean;
  summary: CallSummary | null;
  booking: Booking | null;
  /** Stereo WAV of the call, caller left and her right. Null until it exists. */
  recordingUrl?: string | null;
  copy: DemoCopy;
  /** BCP-47 tag for dates, so the appointment reads in the call's language. */
  dateLocale: string;
}) {
  return (
    // Warm near-white ground with white cards floating on it, header and
    // footer included. `bg-muted` is the same token the call panel's header
    // uses, so the two panels sit on one continuous surface — and it carries
    // its own dark-mode value, so this does not become a light slab on a dark
    // page the way a literal would.
    <div className="flex flex-1 flex-col overflow-hidden border-border bg-muted max-lg:border-t lg:border-l">
      <div className="flex items-center gap-3 border-b border-border px-5 py-3.5">
        <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full border border-border/60 text-muted-foreground" style={CARD_BG}>
          <Database className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">{copy.crmTitle}</div>
          <div className="text-xs text-muted-foreground">
            {live ? copy.crmLive : copy.crmAfter}
          </div>
        </div>
        {live && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            {copy.liveBadge}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {receipts.length === 0 ? (
          <p className="mt-10 text-center text-sm text-muted-foreground">
            {copy.crmEmpty}
          </p>
        ) : (
          <div className="space-y-4">
            <div className="rounded-[var(--r-surface)] border border-border/60 p-4" style={CARD_BG}>
              <div className="mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4 flex-none text-primary" />
                <span className="text-sm font-semibold">{copy.whatTheyCalledAbout}</span>
              </div>
              {summary?.items?.length ? (
                <div className="space-y-3">
                  {summary.items.map((item, i) => (
                    <div
                      key={i}
                      className={i > 0 ? "space-y-1.5 border-t border-border/60 pt-3" : "space-y-1.5"}
                    >
                      <span
                        className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          INTENT_TONE[item.intent] ?? "bg-muted text-muted-foreground"
                        }`}
                      >
                        {copy[INTENT_KEY[item.intent]] ?? item.intent}
                      </span>
                      {item.interest && <p className="text-sm font-medium">{item.interest}</p>}
                      {item.notes && (
                        <p className="text-sm leading-relaxed text-muted-foreground">{item.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {/* Derived from the transcript once the call is over, so
                      there is nothing to show while it is still running. */}
                  {live ? copy.fillsInLater : copy.nothingRecorded}
                </p>
              )}
            </div>

            <div className="rounded-[var(--r-surface)] border border-border/60 p-4" style={CARD_BG}>
              <div className="mb-3 flex items-center gap-2">
                <UserPlus className="h-4 w-4 flex-none text-primary" />
                <span className="text-sm font-semibold">
                  {leadId ? `${copy.lead} #${leadId}` : copy.lead}
                </span>
                <span className="rounded-full bg-highlight-selected px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                  {copy.isNew}
                </span>
              </div>
              <dl className="space-y-1.5 text-sm">
                {summary?.name && <Row label={copy.name} value={summary.name} />}
                <Row label={copy.phone} value={phone || "web"} />
                <Row label={copy.source} value={copy.inboundCall} />
                <Row
                  label={copy.status}
                  value={booking ? copy.appointmentBooked : copy.inConversation}
                />
              </dl>
            </div>

            {recordingUrl && !live && (
              <a
                href={recordingUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2.5 rounded-[var(--r-surface)] border border-border/60 px-4 py-3 text-sm hover:border-primary/50"
                style={CARD_BG}
              >
                <Download className="h-4 w-4 flex-none text-primary" />
                <span>{copy.downloadRecording}</span>
              </a>
            )}

            {booking ? (
              <BookedCard booking={booking} copy={copy} dateLocale={dateLocale} />
            ) : (
              <div className="flex items-center gap-2.5 rounded-[var(--r-surface)] border border-dashed border-border px-4 py-3 text-sm text-muted-foreground" style={CARD_BG}>
                <Phone className="h-4 w-4 flex-none" />
                <span>{copy.noAppointmentYet}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** The appointment, on a real calendar — the moment the demo is selling. */
function BookedCard({
  booking,
  copy,
  dateLocale,
}: {
  booking: Booking;
  copy: DemoCopy;
  dateLocale: string;
}) {
  const when = booking.iso ? new Date(booking.iso) : null;
  const valid = when && !Number.isNaN(when.getTime());

  return (
    <div className="overflow-hidden rounded-[var(--r-surface)] border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-900/20">
      <div className="flex items-center gap-2.5 px-4 py-3 text-sm font-medium">
        <CalendarCheck className="h-4 w-4 flex-none text-emerald-600 dark:text-emerald-400" />
        <span>{copy.appointmentBooked}</span>
      </div>
      {valid ? (
        <div className="flex items-start gap-4 border-t border-emerald-500/20 px-4 py-3.5">
          <MiniMonth date={when!} copy={copy} />
          <div className="min-w-0 pt-0.5">
            <div className="text-sm font-semibold">
              {when!.toLocaleDateString(dateLocale, {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </div>
            <div className="mt-0.5 text-sm text-muted-foreground">
              {when!.toLocaleTimeString(dateLocale, { hour: "numeric", minute: "2-digit" })}
            </div>
            <div className="mt-2 text-xs text-muted-foreground">{copy.siteSurvey}</div>
          </div>
        </div>
      ) : (
        <p className="border-t border-emerald-500/20 px-4 py-3 text-sm">{booking.spoken}</p>
      )}
    </div>
  );
}

/** A four-week strip around the booked day. Enough to read "that's next week". */
function MiniMonth({ date, copy }: { date: Date; copy: DemoCopy }) {
  // Start on the Monday of the booked week's preceding week.
  const start = new Date(date);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7) - 7);

  const days = Array.from({ length: 21 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });

  return (
    <div className="flex-none">
      <div className="grid grid-cols-7 gap-[3px] text-center text-[9px] font-semibold uppercase text-muted-foreground">
        {copy.weekdayInitials.map((d, i) => (
          <span key={i} className="w-5">
            {d}
          </span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-[3px]">
        {days.map((d) => {
          const isBooked = d.toDateString() === date.toDateString();
          const isWeekend = d.getDay() === 0 || d.getDay() === 6;
          return (
            <span
              key={d.toISOString()}
              className={[
                "flex h-5 w-5 items-center justify-center rounded-[4px] text-[10px] tabular-nums",
                isBooked
                  ? "bg-emerald-600 font-bold text-white"
                  : isWeekend
                    ? "text-muted-foreground/40"
                    : "text-muted-foreground",
              ].join(" ")}
            >
              {d.getDate()}
            </span>
          );
        })}
      </div>
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

