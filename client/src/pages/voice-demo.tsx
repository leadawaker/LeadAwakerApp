import { useEffect, useRef, useState } from "react";
import { CallPanel } from "@/features/voiceDemo/components/CallPanel";
import { CrmPanel } from "@/features/voiceDemo/components/CrmPanel";
import {
  DEMO_COMPANY,
  PHONE_STORAGE_KEY,
  useVoiceCall,
} from "@/features/voiceDemo/useVoiceCall";
import { DEFAULT_MODEL, DEFAULT_VOICE, DEFAULT_SPEED } from "@/features/voiceDemo/constants";
import type { VoiceLang } from "@/features/voiceDemo/types";

const LANGS: VoiceLang[] = ["en", "nl", "pt"];

/**
 * Pre-configuration from the URL, so one link can be handed to a prospect
 * with their own business name, number and language already filled in:
 *
 *   /voice-demo?company=KL%20Techniek&lang=nl&phone=%2B31612345678&start=1
 *
 * `start=1` skips the setup screen entirely — but only arms it; the call is
 * still begun by a click, because browsers refuse microphone access and audio
 * playback to a page the visitor has not interacted with, and a demo that
 * silently fails on open is worse than one with a button on it.
 */
function readSetupFromUrl() {
  if (typeof window === "undefined") return null;
  const q = new URLSearchParams(window.location.search);
  const lang = q.get("lang") as VoiceLang | null;
  const company = q.get("company");
  const phone = q.get("phone");
  const voice = q.get("voice");
  if (!lang && !company && !phone && !voice) return null;
  return {
    language: lang && LANGS.includes(lang) ? lang : null,
    companyName: company?.trim() || null,
    callerNumber: phone?.trim() || null,
    voice: voice?.trim() || null,
    autoStart: q.get("start") === "1",
  };
}

export default function VoiceDemoPage() {
  const call = useVoiceCall();
  const preset = useRef(readSetupFromUrl()).current;

  const [language, setLanguage] = useState<VoiceLang>(preset?.language ?? "en");
  const [companyName, setCompanyName] = useState(
    preset?.companyName ?? DEMO_COMPANY[preset?.language ?? "en"],
  );
  const [callerNumber, setCallerNumber] = useState(preset?.callerNumber ?? "");
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [voice, setVoice] = useState(preset?.voice ?? DEFAULT_VOICE);
  const [speed, setSpeed] = useState(DEFAULT_SPEED);

  /**
   * Each language's persona has its own demo brand, so switching language
   * moves the default with it — but only while the field is still untouched.
   * A name the user typed themselves is never overwritten.
   */
  const handleLanguage = (next: VoiceLang) => {
    setLanguage(next);
    setCompanyName((current) =>
      Object.values(DEMO_COMPANY).includes(current) ? DEMO_COMPANY[next] : current,
    );
  };

  useEffect(() => {
    // A number in the link wins over whatever this browser used last.
    if (preset?.callerNumber) return;
    try {
      const saved = localStorage.getItem(PHONE_STORAGE_KEY);
      if (saved) setCallerNumber(saved);
    } catch {
      /* private mode */
    }
  }, [preset]);

  const handleCall = () => {
    try {
      if (callerNumber.trim()) localStorage.setItem(PHONE_STORAGE_KEY, callerNumber.trim());
      else localStorage.removeItem(PHONE_STORAGE_KEY);
    } catch {
      /* private mode — not worth failing a call over */
    }
    void call.start({ language, companyName, callerNumber, model, voice, speed });
  };

  return (
    // Bone page ground, so the panels read as sheets sitting ON something.
    // Three deliberate steps of elevation: bone page (#F5F1E8) -> muted panel
    // -> white cards. `--bone` carries its own dark-mode value.
    <div
      className="flex min-h-svh flex-col items-center justify-center p-4 sm:p-8"
      style={{ background: "var(--bone)" }}
    >
      <div className="flex h-[min(80svh,760px)] w-full max-w-[1200px] overflow-hidden rounded-[var(--r-panel)] border border-border shadow-lg max-lg:h-auto max-lg:min-h-[80svh] max-lg:flex-col"
          style={{ background: "var(--card)" }}>
        <div className="flex min-h-0 flex-1 flex-col lg:w-1/2">
          <CallPanel
            state={call.state}
            floor={call.floor}
            turns={call.turns}
            company={call.company}
            startedAt={call.startedAt}
            endedReason={call.endedReason}
            error={call.error}
            busy={call.state === "connecting"}
            language={language}
            companyName={companyName}
            callerNumber={callerNumber}
            model={model}
            voice={voice}
            speed={speed}
            options={call.options}
            simple={preset?.autoStart ?? false}
            onLanguage={handleLanguage}
            onCompany={setCompanyName}
            onCallerNumber={setCallerNumber}
            onModel={setModel}
            onVoice={setVoice}
            onSpeed={setSpeed}
            onCall={handleCall}
            onHangup={() => call.hangup()}
            onReset={call.reset}
          />
        </div>
        <div className="flex min-h-0 flex-1 flex-col lg:w-1/2">
          <CrmPanel
            receipts={call.receipts}
            leadId={call.leadId}
            phone={callerNumber}
            live={call.state === "live"}
            summary={call.summary}
            booking={call.booking}
          />
        </div>
      </div>

      <audio ref={call.audioRef} autoPlay className="hidden" />
    </div>
  );
}
