import { useEffect, useState } from "react";
import type { MotionValue } from "framer-motion";
import { Check } from "lucide-react";
import SiriOrb from "@/components/siriOrb/SiriOrb";
import type { AIState } from "@/components/siriOrb/aiCore";
import type { Booking, VoiceLocale } from "../types";

/**
 * The right-hand panel while a call is running: the orb, and nothing else
 * until there is something worth saying.
 *
 * An earlier build ticked CRM receipts in underneath as they landed. That read
 * as logs to a prospect, which is the opposite of the point, so the only thing
 * that now appears under the orb is the appointment itself, once she has
 * actually booked one. The full CRM takes this panel's place when the call
 * ends.
 */

/**
 * Orb size by breakpoint. Must be px: SiriOrb parses the number out of the
 * string to derive its blur, contrast and dot maths, so a rem or a percentage
 * silently breaks the look.
 *
 * Chosen with matchMedia rather than by rendering one orb per breakpoint and
 * letting CSS hide one. The orb is a stack of animated CSS filters over a
 * backdrop-filter, which is expensive on phones and on Safari; mounting two
 * and painting one is a cost with no upside.
 */
const ORB_PX = { base: 200, lg: 264 };
const LG_QUERY = "(min-width: 1024px)";

function useOrbSize() {
  const [large, setLarge] = useState(
    () => typeof window !== "undefined" && window.matchMedia(LG_QUERY).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(LG_QUERY);
    const onChange = (e: MediaQueryListEvent) => setLarge(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return large ? ORB_PX.lg : ORB_PX.base;
}

/** The locale the card should format the date in, not the browser's. */
const DATE_LOCALE: Record<VoiceLocale, string> = {
  "en-GB": "en-GB",
  "en-US": "en-US",
  nl: "nl-NL",
  "pt-BR": "pt-BR",
  "pt-PT": "pt-PT",
  "es-ES": "es-ES",
};

export function OrbPanel({
  orbState,
  amplitude,
  booking,
  locale,
}: {
  orbState: AIState;
  amplitude: MotionValue<number>;
  booking: Booking | null;
  locale: VoiceLocale;
}) {
  const orbSize = useOrbSize();

  return (
    <div className="flex flex-1 flex-col overflow-hidden border-border bg-muted max-lg:border-t lg:border-l">
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-8 p-6">
        <SiriOrb size={`${orbSize}px`} state={orbState} amplitude={amplitude} />
        {booking && <BookedCard booking={booking} locale={locale} />}
      </div>
    </div>
  );
}

function BookedCard({ booking, locale }: { booking: Booking; locale: VoiceLocale }) {
  const when = booking.iso ? new Date(booking.iso) : null;
  const valid = when && !Number.isNaN(when.getTime());
  const intl = DATE_LOCALE[locale] ?? "en-GB";

  return (
    <div className="w-full max-w-xs rounded-[var(--r-surface)] border border-emerald-500/30 bg-emerald-50 px-4 py-3 text-center dark:bg-emerald-900/20">
      <div className="mb-1 flex items-center justify-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
        <Check className="h-3 w-3" />
        Booked
      </div>
      {valid ? (
        <>
          <div className="text-sm font-semibold capitalize">
            {when.toLocaleDateString(intl, { weekday: "long", day: "numeric", month: "long" })}
          </div>
          <div className="text-sm tabular-nums text-muted-foreground">
            {when.toLocaleTimeString(intl, { hour: "2-digit", minute: "2-digit" })}
          </div>
        </>
      ) : (
        // The diary confirmed a slot it could not give us a timestamp for.
        // Her own words are a better fallback than an empty card.
        <div className="text-sm font-semibold">{booking.spoken}</div>
      )}
    </div>
  );
}
