import { useEffect, useRef, useState } from "react";
import { LiveCallPanel } from "@/features/voiceDemo/components/LiveCallPanel";
import { OrbPanel } from "@/features/voiceDemo/components/OrbPanel";
import { CrmPanel } from "@/features/voiceDemo/components/CrmPanel";
import { VoiceDemoLock } from "@/features/voiceDemo/components/VoiceDemoLock";
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
 * Two panels: the transcript on the left, the orb on the right while the call
 * runs, and the CRM in the orb's place once it is over. The orb holds the
 * prospect's eye during the call; the CRM receipts tick in underneath it so
 * the evidence is accumulating in plain sight rather than being claimed at the
 * end.
 */

const LOCALES: VoiceLocale[] = ["en-GB", "en-US", "nl", "pt-BR", "pt-PT", "es-ES"];

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
    void call.start(setup, storedVoicePassword());
  };

  const copy = copyFor(setup.locale);

  if (!unlocked) {
    return (
      <VoiceDemoLock
        copy={copy}
        onUnlock={(raw) => {
          if (!isValidVoicePassword(raw)) return false;
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

  const ended = call.state === "ended";

  return (
    // Bone page ground, so the panels read as sheets sitting ON something.
    <div
      className="flex min-h-svh flex-col items-center justify-center p-3 sm:p-5"
      style={{ background: "var(--bone)" }}
    >
      <div
        className="flex h-[min(92svh,940px)] w-full max-w-[1200px] overflow-hidden rounded-[var(--r-panel)] border border-border shadow-lg max-lg:h-auto max-lg:min-h-[88svh] max-lg:flex-col"
        style={{ background: "var(--card)" }}
      >
        <div className="flex min-h-0 flex-1 flex-col lg:w-1/2">
          <LiveCallPanel
            state={call.state}
            turns={call.turns}
            company={call.company}
            startedAt={call.startedAt}
            endedReason={call.endedReason}
            error={call.error}
            setup={setup}
            options={call.options}
            simple={simple}
            copy={copy}
            onSetup={updateSetup}
            onCall={handleCall}
            onHangup={() => call.hangup()}
            onReset={call.reset}
          />
        </div>
        <div className="flex min-h-0 flex-1 flex-col lg:w-1/2">
          {ended ? (
            <CrmPanel
              receipts={call.receipts}
              leadId={call.leadId}
              phone={setup.callerNumber}
              live={false}
              summary={call.summary}
              booking={call.booking}
              recordingUrl={call.recordingUrl}
              copy={copy}
              dateLocale={dateLocaleOf(setup.locale)}
            />
          ) : (
            <OrbPanel
              orbState={call.orbState}
              amplitude={call.amplitude}
              booking={call.booking}
              locale={setup.locale}
              copy={copy}
            />
          )}
        </div>
      </div>

      <audio ref={call.audioRef} autoPlay className="hidden" />
    </div>
  );
}

/** The content language a locale reads, mirroring the engine's LOCALES table. */
function localeLanguage(locale: VoiceLocale): VoiceLang {
  if (locale.startsWith("nl")) return "nl";
  if (locale.startsWith("pt")) return "pt";
  return "en";
}
