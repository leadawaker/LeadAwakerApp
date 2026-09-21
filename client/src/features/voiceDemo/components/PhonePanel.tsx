import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Phone } from "lucide-react";
import { Iphone16Pro } from "@/components/ui/iphone-16-pro";
import { SiriWave } from "@/components/siriWave/SiriWave";
import type { AIState } from "@/components/siriOrb/aiCore";
import type { Booking, CallState, VoiceLocale } from "../types";
import type { CallLevels } from "../useCallLevels";
import { callLimitMs } from "../useLiveCall";
import { useWaveMotion } from "../waveMotion";
import { dateLocaleOf, type DemoCopy } from "../copy";

/**
 * The right-hand panel while a call is set up or running: a phone, on an
 * iOS-style call screen, with the Siri wave where her voice is.
 *
 * The screen is dark until the call starts: then a dot appears, breathes
 * while it connects, and grows into the wave, which answers to whoever is
 * talking (see waveMotion). Below it, the appointment once she has actually
 * booked one, and one button where iOS puts it: green to call, then the same
 * button turns red and its handset tips over to hang up. The full CRM
 * takes this panel's place when the call ends.
 */

export function PhonePanel({
  callState,
  aiState,
  readLevels,
  company,
  startedAt,
  booking,
  locale,
  copy,
  error,
  settings,
  onCall,
  onHangup,
}: {
  callState: CallState;
  aiState: AIState;
  readLevels: () => CallLevels;
  company: string;
  startedAt: number | null;
  booking: Booking | null;
  locale: VoiceLocale;
  copy: DemoCopy;
  error: string | null;
  /** Shown under the phone before the call (the settings gear). */
  settings?: ReactNode;
  onCall: () => void;
  onHangup: () => void;
}) {
  const getParams = useWaveMotion(callState, aiState, readLevels);
  const idle = callState === "idle";

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 overflow-hidden p-6">
      <Iphone16Pro className="h-[min(640px,calc(100%-3rem))] max-lg:h-[460px]">
        <div className="flex h-full flex-col items-center px-[8%] pb-[10%] pt-[22%] text-white">
          <div className="text-center">
            <div className="h-[18px] text-[13px] text-white/55">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={callState}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.25 }}
                >
                  {callState === "connecting" ? copy.connecting : callState === "live" ? <Elapsed startedAt={startedAt} /> : "\u00a0"}
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="mt-1 text-[22px] font-medium leading-tight">{company}</div>
          </div>

          {/* Mounted only once there is a call, so an idle page runs no WebGL loop. */}
          <div className="min-h-0 w-full flex-1">
            {!idle && <SiriWave getParams={getParams} className="h-full w-full" />}
          </div>

          <AnimatePresence>
            {booking && (
              <motion.div
                className="w-full"
                initial={{ opacity: 0, y: 12, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 22 }}
              >
                <BookedCard booking={booking} locale={locale} copy={copy} />
              </motion.div>
            )}
          </AnimatePresence>

          {idle && error && <p className="mb-2 text-center text-xs text-red-300">{error}</p>}

          <CallButton callState={callState} copy={copy} onCall={onCall} onHangup={onHangup} />
        </div>
      </Iphone16Pro>

      {/* Height held either way, so the phone does not jump when it goes. */}
      <div className="flex h-9 items-center">
        <AnimatePresence>
          {idle && settings && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {settings}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/** iOS system green and red. Fixed: they sit on the phone's black screen. */
const IOS_GREEN = "#34C759";
const IOS_RED = "#FF3B30";

/**
 * One button for the whole call, as on iOS: green with an upright handset to
 * call, then it turns red and the handset tips over (135deg is exactly the
 * hang-up glyph) to end. The idle button gives off a slow ring, the one
 * invitation on an otherwise still screen.
 */
function CallButton({
  callState,
  copy,
  onCall,
  onHangup,
}: {
  callState: CallState;
  copy: DemoCopy;
  onCall: () => void;
  onHangup: () => void;
}) {
  const idle = callState === "idle";
  const label = idle ? copy.call : copy.hangUp;

  return (
    <div className="mt-[8%] flex flex-none flex-col items-center gap-1.5">
      <div className="relative">
        {idle && (
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full"
            style={{ border: `2px solid ${IOS_GREEN}` }}
            // Keyframes rather than a straight A-to-B loop: that version ended
            // at scale 1.6 / opacity 0 and snapped back to scale 1 / opacity
            // 0.6 in one frame, so the ring reappeared with a visible pop.
            // Starting and ending transparent puts the loop seam where nothing
            // is drawn, and the pause between beats happens at opacity 0.
            initial={false}
            animate={{ scale: [1, 1.18, 1.6], opacity: [0, 0.5, 0] }}
            transition={{
              duration: 2,
              times: [0, 0.3, 1],
              repeat: Infinity,
              repeatDelay: 0.3,
              ease: "easeOut",
            }}
          />
        )}
        <motion.button
          type="button"
          onClick={idle ? onCall : onHangup}
          disabled={callState === "ended"}
          aria-label={label}
          initial={false}
          animate={{ backgroundColor: idle ? IOS_GREEN : IOS_RED }}
          transition={{ duration: 0.35 }}
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.9 }}
          className="relative flex h-[64px] w-[64px] items-center justify-center rounded-full text-white"
        >
          <motion.span
            initial={false}
            animate={{ rotate: idle ? 0 : 135 }}
            transition={{ type: "spring", stiffness: 240, damping: 16 }}
            className="flex"
          >
            <Phone className="h-7 w-7" fill="currentColor" strokeWidth={1.5} />
          </motion.span>
        </motion.button>
      </div>
      <div className="h-[18px] text-[12px] text-white/80">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={label}
            className="block"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
          >
            {label}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
}

const mmss = (secs: number) =>
  `${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;

/** In the last stretch the clock turns amber so the cut-off is never a surprise. */
const WARN_REMAINING_S = 30;

/** Elapsed call time as the iOS call screen shows it, with the maximum beside it. */
function Elapsed({ startedAt }: { startedAt: number | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const max = Math.round(callLimitMs() / 1000);
  const secs = startedAt ? Math.min(max, Math.max(0, Math.floor((now - startedAt) / 1000))) : 0;
  const closing = max - secs <= WARN_REMAINING_S;
  return (
    <span className="tabular-nums transition-colors duration-500" style={closing ? { color: "#FFD60A" } : undefined}>
      {mmss(secs)}
      <span className="opacity-60"> / {mmss(max)}</span>
    </span>
  );
}

function BookedCard({
  booking,
  locale,
  copy,
}: {
  booking: Booking;
  locale: VoiceLocale;
  copy: DemoCopy;
}) {
  const when = booking.iso ? new Date(booking.iso) : null;
  const valid = when && !Number.isNaN(when.getTime());
  const intl = dateLocaleOf(locale);

  // Always on the phone's black screen, so fixed light-on-dark in both themes.
  return (
    <div className="w-full rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-center">
      <div className="mb-1 flex items-center justify-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
        <Check className="h-3 w-3" />
        {copy.booked}
      </div>
      {valid ? (
        <>
          <div className="text-sm font-semibold capitalize">
            {when.toLocaleDateString(intl, { weekday: "long", day: "numeric", month: "long" })}
          </div>
          <div className="text-sm tabular-nums text-white/60">
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
