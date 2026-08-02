import { useEffect, useState } from "react";
import { CallPanel } from "@/features/voiceDemo/components/CallPanel";
import { CrmPanel } from "@/features/voiceDemo/components/CrmPanel";
import {
  DEFAULT_COMPANY,
  PHONE_STORAGE_KEY,
  useVoiceCall,
} from "@/features/voiceDemo/useVoiceCall";
import type { VoiceLang } from "@/features/voiceDemo/types";

/**
 * Public voice-receptionist demo. Deliberately unauthenticated so a link can
 * be sent to a prospect: it reads no CRM data, and the CRM panel renders only
 * the write receipts the engine returns for this call.
 */
export default function VoiceDemoPage() {
  const call = useVoiceCall();
  const [language, setLanguage] = useState<VoiceLang>("en");
  const [companyName, setCompanyName] = useState(DEFAULT_COMPANY);
  const [callerNumber, setCallerNumber] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(PHONE_STORAGE_KEY);
      if (saved) setCallerNumber(saved);
    } catch {
      /* private mode */
    }
  }, []);

  const handleCall = () => {
    try {
      if (callerNumber.trim()) localStorage.setItem(PHONE_STORAGE_KEY, callerNumber.trim());
      else localStorage.removeItem(PHONE_STORAGE_KEY);
    } catch {
      /* private mode — not worth failing a call over */
    }
    void call.start({ language, companyName, callerNumber });
  };

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background p-4 sm:p-8">
      <div className="flex h-[min(80svh,760px)] w-full max-w-[1200px] overflow-hidden rounded-[var(--r-panel)] border border-border bg-card shadow-lg max-lg:h-auto max-lg:min-h-[80svh] max-lg:flex-col">
        <div className="flex min-h-0 flex-1 flex-col lg:w-1/2">
          <CallPanel
            state={call.state}
            floor={call.floor}
            turns={call.turns}
            company={call.company}
            startedAt={call.startedAt}
            error={call.error}
            busy={call.state === "connecting"}
            language={language}
            companyName={companyName}
            callerNumber={callerNumber}
            onLanguage={setLanguage}
            onCompany={setCompanyName}
            onCallerNumber={setCallerNumber}
            onCall={handleCall}
            onHangup={call.hangup}
            onReset={call.reset}
          />
        </div>
        <div className="flex min-h-0 flex-1 flex-col lg:w-1/2">
          <CrmPanel
            receipts={call.receipts}
            leadId={call.leadId}
            live={call.state === "live"}
          />
        </div>
      </div>

      <audio ref={call.audioRef} autoPlay className="hidden" />
    </div>
  );
}
