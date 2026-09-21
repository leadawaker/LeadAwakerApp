import { useEffect, useRef, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useTheme } from "@/hooks/useTheme";
import { TranscriptPanel } from "@/features/voiceDemo/components/TranscriptPanel";
import { CallSettings } from "@/features/voiceDemo/components/CallSettings";
import { demoCallerNumber } from "@/features/voiceDemo/demoNumber";
import { PhonePanel } from "@/features/voiceDemo/components/PhonePanel";
import { CrmPanel } from "@/features/voiceDemo/components/CrmPanel";
import { VoiceDemoLock } from "@/features/voiceDemo/components/VoiceDemoLock";
import { apiFetch } from "@/lib/apiUtils";
import {
  DEMO_COMPANY,
  isValidVoicePassword,
  normalizeVoicePassword,
  PHONE_STORAGE_KEY,
  storedVoicePassword,
  VOICE_DEMO_UNLOCK_KEY,
} from "@/features/voiceDemo/door";
import { ENGINE_BASE_URL, useLiveCall } from "@/features/voiceDemo/useLiveCall";
import type { LiveSetup, VoiceLang, VoiceLocale } from "@/features/voiceDemo/types";
import { copyFor, dateLocaleOf } from "@/features/voiceDemo/copy";

/**
 * The voice receptionist demo, on GPT-Live.
 *
 * Before the call: one panel, and a phone in the middle of it with a green
 * button on its screen (the call's settings sit behind a gear underneath).
 * Pressing call splits the panel: the transcript opens on the left, the
 * phone ends up on the right, and the CRM takes the phone's place once the
 * call is over.
 *
 * The page follows the system's light/dark setting until someone presses the
 * toggle, so the demo can be shown in either.
 */

const LOCALES: VoiceLocale[] = ["en-GB", "en-US", "nl", "pt-BR", "pt-PT"];

/**
 * Old links carry `?lang=en|nl|pt`, which predates locales. They still work,
 * landing on the most likely accent for each, so a link already sent to a
 * prospect does not open on the wrong language.
 */
const LANG_TO_LOCALE: Record<VoiceLang, VoiceLocale> = {
  en: "en-GB",
  nl: "nl",
  pt: "pt-BR",
};

/**
 * Pre-configuration from the URL, so one link can be handed to a prospect with
 * their own business name, number and language already filled in:
 *
 *   /voice-demo?company=KL%20Techniek&locale=nl&phone=%2B31612345678&start=1
 *
 * `start=1` only arms the call; it is still begun by a click, because browsers
 * refuse microphone access to a page the visitor has not interacted with, and
 * a demo that silently fails on open is worse than one with a button on it.
 */
function readSetupFromUrl() {
  if (typeof window === "undefined") return null;
  const q = new URLSearchParams(window.location.search);
  const rawLocale = q.get("locale") as VoiceLocale | null;
  const rawLang = q.get("lang") as VoiceLang | null;
  const company = q.get("company");
  const phone = q.get("phone");
  const voice = q.get("voice");
  if (!rawLocale && !rawLang && !company && !phone && !voice) return null;
  const locale =
    rawLocale && LOCALES.includes(rawLocale)
      ? rawLocale
      : rawLang && LANG_TO_LOCALE[rawLang]
        ? LANG_TO_LOCALE[rawLang]
        : null;
  return {
    locale,
    companyName: company?.trim() || null,
    callerNumber: phone?.trim() || null,
    voice: voice?.trim() || "",
    autoStart: q.get("start") === "1",
  };
}

/**
 * The door's second try: a password set on the Demos page. Checked by the
 * server so the page never holds the list, and only reached once the built-in
 * words have been ruled out.
 */
async function unlockViaServer(raw: string, setUnlocked: (v: boolean) => void): Promise<boolean> {
  try {
    const res = await apiFetch("/api/voice-demo/door", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: raw }),
    });
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean };
    if (!res.ok || !body.ok) return false;
    try {
      localStorage.setItem(VOICE_DEMO_UNLOCK_KEY, normalizeVoicePassword(raw));
    } catch {
      /* private mode: the unlock still holds for this tab */
    }
    setUnlocked(true);
    return true;
  } catch {
    return false;
  }
}

/** A link minted for a prospect, rather than the bare page we test on. */
function isDemoLink(): boolean {
  if (typeof window === "undefined") return false;
  const q = new URLSearchParams(window.location.search);
  return q.get("start") === "1" || /^[A-Za-z0-9]{4,64}$/.test(q.get("token") || "");
}

export default function VoiceDemoPage() {
  const call = useLiveCall();
  const preset = useRef(readSetupFromUrl()).current;
  const simple = useRef(isDemoLink()).current;
  const showSettings = useRef(isAppHost()).current;

  const [unlocked, setUnlocked] = useState(() => isValidVoicePassword(storedVoicePassword()));

  const [setup, setSetup] = useState<LiveSetup>(() => {
    const locale = preset?.locale ?? "en-GB";
    return {
      locale,
      companyName: preset?.companyName ?? DEMO_COMPANY[localeLanguage(locale)],
      callerNumber: preset?.callerNumber ?? "",
      voice: preset?.voice ?? "",
    };
  });

  /**
   * A typed company name outranks anything the token fetch may still be about
   * to fill in, and outranks the default that follows a language change.
   */
  const touchedRef = useRef(false);

  const updateSetup = (next: Partial<LiveSetup>) => {
    if (next.companyName !== undefined) touchedRef.current = true;
    setSetup((prev) => {
      const merged = { ...prev, ...next };
      // Each language's persona has its own demo brand, so switching language
      // moves the default with it — but only while the field is untouched.
      if (next.locale && !touchedRef.current) {
        merged.companyName = DEMO_COMPANY[localeLanguage(next.locale)];
      }
      return merged;
    });
  };

  /**
   * A `?token=` link carries a prospect persona minted on the +New Demo form,
   * so the setup screen should already say their company and their language
   * rather than asking the presenter to retype both mid-call.
   */
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token") || "";
    if (!/^[A-Za-z0-9]{4,64}$/.test(token)) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`${ENGINE_BASE_URL}/voice/demo-context?token=${token}`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || !data?.found) return;
        setSetup((prev) => {
          const lang = data.language as VoiceLang | undefined;
          // Order of authority: the link, then the persona's own accent, then
          // the language's default. A dealership in the Azores is "pt" like
          // every other Portuguese client, and only `voice_locale` can say it
          // should not sound Brazilian.
          const fromPersona = LOCALES.includes(data.voice_locale as VoiceLocale)
            ? (data.voice_locale as VoiceLocale)
            : null;
          const locale =
            preset?.locale ?? fromPersona ?? (lang && LANG_TO_LOCALE[lang]) ?? prev.locale;
          return {
            ...prev,
            locale,
            companyName:
              !touchedRef.current && data.company_name ? data.company_name : prev.companyName,
          };
        });
      } catch {
        // A themed link that cannot reach the engine still runs as the plain
        // demo, which is a better failure than a blocked setup screen.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [preset]);

  useEffect(() => {
    // A number in the link wins over whatever this browser used last.
    if (preset?.callerNumber) return;
    try {
      const saved = localStorage.getItem(PHONE_STORAGE_KEY);
      if (saved) setSetup((prev) => ({ ...prev, callerNumber: saved }));
    } catch {
      /* private mode */
    }
  }, [preset]);

  const handleCall = () => {
    try {
      if (setup.callerNumber.trim()) localStorage.setItem(PHONE_STORAGE_KEY, setup.callerNumber.trim());
      else localStorage.removeItem(PHONE_STORAGE_KEY);
    } catch {
      /* private mode — not worth failing a call over */
    }
    // No number typed or in the link: the caller gets a made-up local one, so
    // the AI hears a caller ID and the CRM files them as their own caller.
    const callerNumber = setup.callerNumber.trim() || demoCallerNumber(setup.locale);
    void call.start({ ...setup, callerNumber }, storedVoicePassword());
  };

  const copy = copyFor(setup.locale);

  // The phone outlives the call by a beat, so the wave can shrink back into
  // its dot before the phone fades out and the CRM fades in.
  const showCrm = useDelayedFlag(call.state === "ended", PHONE_LINGER_MS);
  const split = call.state !== "idle";
  const large = useMediaQuery("(min-width: 1024px)");

  if (!unlocked) {
    return (
      <VoiceDemoLock
        copy={copy}
        onUnlock={(raw) => {
          if (!isValidVoicePassword(raw)) return unlockViaServer(raw, setUnlocked);
          try {
            localStorage.setItem(VOICE_DEMO_UNLOCK_KEY, normalizeVoicePassword(raw));
          } catch {
            // Private mode: unlock still holds for this tab via the state below.
          }
          setUnlocked(true);
          // Straight into the call on a minted link. This runs inside the
          // unlock click, which is the user gesture browsers require before
          // they will hand over a microphone; a later effect would not be one,
          // and the prospect would be looking at a second button to press.
          if (simple) window.setTimeout(handleCall, 0);
          return true;
        }}
      />
    );
  }

  return (
    // Bone page ground, so the panels read as sheets sitting ON something.
    <div
      className="flex min-h-svh flex-col items-center justify-center p-3 sm:p-5"
      style={{ background: "var(--bone)" }}
    >
      <ThemeToggle copy={copy} />
      <div
        className="flex h-[min(92svh,940px)] w-full max-w-[1200px] overflow-hidden rounded-[var(--r-panel)] border border-border shadow-lg max-lg:h-auto max-lg:min-h-[88svh] max-lg:flex-col"
        style={{ background: "var(--card)" }}
      >
        {/*
          Before the call there is one panel with the phone in the middle.
          Pressing call opens the transcript beside it, and the phone glides
          across with the shrinking panel: nothing moves the phone itself,
          it simply stays centred in a panel that is getting narrower.
        */}
        <AnimatePresence initial={false}>
          {split && (
            <motion.div
              key="transcript"
              className="flex min-h-0 flex-none flex-col overflow-hidden border-border max-lg:order-2 max-lg:border-t lg:border-r"
              initial={large ? { width: 0, opacity: 0 } : { height: 0, opacity: 0 }}
              animate={large ? { width: "50%", opacity: 1 } : { height: "45svh", opacity: 1 }}
              exit={large ? { width: 0, opacity: 0 } : { height: 0, opacity: 0 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: call.state === "connecting" ? 0.25 : 0 }}
            >
              {/* Fixed width inside, so text does not reflow while it opens. */}
              <div className="flex min-h-0 flex-1 flex-col lg:w-[min(600px,calc(50vw-1.25rem))]">
                <TranscriptPanel
                  turns={call.turns}
                  endedReason={call.endedReason}
                  error={call.error}
                  copy={copy}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* The ground stays put while the phone and the CRM swap on top of it. */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-muted">
          <AnimatePresence mode="wait" initial={false}>
            {showCrm ? (
              <motion.div key="crm" className="flex min-h-0 flex-1 flex-col" {...PANEL_IN}>
                <CrmPanel
                  receipts={call.receipts}
                  leadId={call.leadId}
                  phone={setup.callerNumber.trim() || demoCallerNumber(setup.locale)}
                  live={false}
                  summary={call.summary}
                  booking={call.booking}
                  recordingUrl={call.recordingUrl}
                  copy={copy}
                  dateLocale={dateLocaleOf(setup.locale)}
                  onAgain={call.reset}
                />
              </motion.div>
            ) : (
              <motion.div key="phone" className="flex min-h-0 flex-1 flex-col" {...PANEL_IN}>
                <PhonePanel
                  callState={call.state}
                  aiState={call.orbState}
                  readLevels={call.readLevels}
                  company={call.company || setup.companyName}
                  startedAt={call.startedAt}
                  booking={call.booking}
                  locale={setup.locale}
                  copy={copy}
                  error={call.error}
                  settings={
                    showSettings ? (
                      <CallSettings
                        setup={setup}
                        options={call.options}
                        simple={simple}
                        copy={copy}
                        onSetup={updateSetup}
                      />
                    ) : undefined
                  }
                  onCall={handleCall}
                  onHangup={() => call.hangup()}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <audio ref={call.audioRef} autoPlay className="hidden" />
    </div>
  );
}

/**
 * The settings gear is for us. The public site (www.leadawaker.com) shows the
 * phone and nothing else; only the app host, and local development, get it.
 */
function isAppHost(): boolean {
  const host = window.location.hostname;
  return host.startsWith("app.") || host === "localhost" || host === "127.0.0.1";
}

/** How long the phone stays after the call ends, for the wave's exit. */
const PHONE_LINGER_MS = 650;

/** Shared enter/exit for the right-hand panel swap. */
const PANEL_IN = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, scale: 0.97, transition: { duration: 0.4, ease: [0.4, 0, 1, 1] } },
} as const;

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

/** `value`, but a true only lands after `delayMs`; a false lands at once. */
function useDelayedFlag(value: boolean, delayMs: number): boolean {
  const [flag, setFlag] = useState(value);
  useEffect(() => {
    if (!value) {
      setFlag(false);
      return;
    }
    const id = window.setTimeout(() => setFlag(true), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);
  return flag;
}

/**
 * Day/night switch. Until it is pressed the page follows the system setting
 * (the theme's default); pressing it pins the opposite of what is showing.
 */
function ThemeToggle({ copy }: { copy: ReturnType<typeof copyFor> }) {
  const { isDark, setThemeMode } = useTheme();
  const label = isDark ? copy.dayMode : copy.nightMode;
  return (
    <button
      type="button"
      onClick={() => setThemeMode(isDark ? "light" : "dark")}
      aria-label={label}
      title={label}
      className="fixed bottom-4 right-4 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition hover:text-foreground"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

/** The content language a locale reads, mirroring the engine's LOCALES table. */
function localeLanguage(locale: VoiceLocale): VoiceLang {
  if (locale.startsWith("nl")) return "nl";
  if (locale.startsWith("pt")) return "pt";
  return "en";
}
