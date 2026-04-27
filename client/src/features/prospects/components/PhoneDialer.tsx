import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Phone, PhoneOff, Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ProspectRow } from "./ProspectListView";

// @twilio/voice-sdk loaded lazily to avoid SSR/build issues
type TwilioDevice = any;

interface PhoneDialerProps {
  prospectId: number;
  prospect: ProspectRow;
  onCallEnded?: () => void;
}

type CallState = "idle" | "connecting" | "in-call" | "ended";

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function PhoneDialer({ prospectId, prospect, onCallEnded }: PhoneDialerProps) {
  const { t } = useTranslation("prospects");

  const recipients = [
    { label: prospect.contact_name || "Contact 1", phone: prospect.contact_phone },
    { label: prospect.contact2_name || "Contact 2", phone: prospect.contact2_phone },
    { label: prospect.company || "Company", phone: prospect.phone },
  ].filter((r) => r.phone) as { label: string; phone: string }[];

  const [selectedPhone, setSelectedPhone] = useState(recipients[0]?.phone ?? "");
  const [callState, setCallState] = useState<CallState>("idle");
  const [muted, setMuted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const deviceRef = useRef<TwilioDevice | null>(null);
  const connectionRef = useRef<any>(null);
  const tokenExpiryRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchToken = useCallback(async () => {
    const res = await fetch("/api/twilio/token", { method: "POST", credentials: "include" });
    if (!res.ok) throw new Error("Token fetch failed");
    const { token, expiresAt } = await res.json();
    tokenExpiryRef.current = expiresAt;
    return token as string;
  }, []);

  const initDevice = useCallback(async () => {
    if (deviceRef.current) return;
    try {
      const { Device } = await import("@twilio/voice-sdk");
      const token = await fetchToken();
      const device = new Device(token, { logLevel: 1 });
      device.on("error", (err: any) => {
        setError(err?.message ?? "Device error");
        setCallState("idle");
      });
      deviceRef.current = device;

      // Refresh token 5 min before expiry
      const msUntilRefresh = tokenExpiryRef.current - Date.now() - 5 * 60 * 1000;
      if (msUntilRefresh > 0) {
        setTimeout(async () => {
          try {
            const newToken = await fetchToken();
            deviceRef.current?.updateToken(newToken);
          } catch {}
        }, msUntilRefresh);
      }
    } catch (err: any) {
      setError("Could not initialize dialer");
    }
  }, [fetchToken]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      deviceRef.current?.destroy();
      deviceRef.current = null;
    };
  }, []);

  if (recipients.length === 0) {
    return (
      <p className="text-[11px] text-muted-foreground/50 italic">
        {t("phoneDialer.noPhone", "No phone number on file")}
      </p>
    );
  }

  const handleCall = async () => {
    setError(null);
    setCallState("connecting");
    setElapsed(0);

    try {
      await initDevice();
      const device = deviceRef.current;
      if (!device) throw new Error("Device not ready");

      const conn = await device.connect({
        params: {
          To: selectedPhone,
          ProspectId: String(prospectId),
        },
      });
      connectionRef.current = conn;

      conn.on("accept", () => {
        setCallState("in-call");
        timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
      });

      conn.on("disconnect", () => {
        if (timerRef.current) clearInterval(timerRef.current);
        setCallState("ended");
        connectionRef.current = null;
        onCallEnded?.();
        setTimeout(() => setCallState("idle"), 3000);
      });

      conn.on("error", (err: any) => {
        if (timerRef.current) clearInterval(timerRef.current);
        setError(err?.message ?? "Call error");
        setCallState("idle");
        connectionRef.current = null;
      });
    } catch (err: any) {
      setError(err?.message ?? "Failed to start call");
      setCallState("idle");
    }
  };

  const handleHangUp = () => {
    connectionRef.current?.disconnect();
  };

  const handleMute = () => {
    if (!connectionRef.current) return;
    const next = !muted;
    connectionRef.current.mute(next);
    setMuted(next);
  };

  const isIdle = callState === "idle" || callState === "ended";
  const isActive = callState === "in-call";
  const isConnecting = callState === "connecting";

  return (
    <div className="flex flex-col gap-3">
      {/* Recipient selector */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
          {t("emailComposer.to", "To")}
        </label>
        {recipients.length > 1 ? (
          <div className="relative">
            <select
              value={selectedPhone}
              onChange={(e) => setSelectedPhone(e.target.value)}
              disabled={!isIdle}
              className="w-full appearance-none text-[12px] rounded-lg border border-border/60 bg-white dark:bg-slate-900 px-2.5 py-1.5 pr-7 outline-none focus:ring-2 focus:ring-brand-indigo/30 text-foreground disabled:opacity-50"
            >
              {recipients.map((r) => (
                <option key={r.phone} value={r.phone}>{r.label} — {r.phone}</option>
              ))}
            </select>
            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground/50 text-[10px]">▾</div>
          </div>
        ) : (
          <span className="text-[12px] text-foreground/70 px-0.5">{recipients[0].label} — {recipients[0].phone}</span>
        )}
      </div>

      {/* Call status / timer */}
      {(isActive || isConnecting) && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
          <span className="text-[12px] font-medium text-emerald-700 dark:text-emerald-400">
            {isConnecting ? t("phoneDialer.calling", "Calling...") : formatDuration(elapsed)}
          </span>
          {isActive && (
            <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-500 opacity-70">
              {t("phoneDialer.recording", "Recording")}
            </span>
          )}
        </div>
      )}

      {callState === "ended" && (
        <div className="text-[11px] text-muted-foreground/60 italic">
          {t("phoneDialer.callEnded", "Call ended")}
        </div>
      )}

      {error && <p className="text-[11px] text-destructive">{error}</p>}

      {/* Action buttons */}
      <div className="flex items-center gap-2 pb-2">
        {isActive && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleMute}
            className="h-8 rounded-xl text-[11px] gap-1.5"
          >
            {muted ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
            {muted ? t("phoneDialer.unmute", "Unmute") : t("phoneDialer.mute", "Mute")}
          </Button>
        )}

        {isActive || isConnecting ? (
          <Button
            size="sm"
            variant="destructive"
            onClick={handleHangUp}
            className="h-8 rounded-xl gap-1.5 ml-auto"
          >
            <PhoneOff className="h-3.5 w-3.5" />
            {t("phoneDialer.hangUp", "Hang Up")}
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={handleCall}
            disabled={!selectedPhone || isConnecting}
            className="h-8 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 ml-auto"
          >
            <Phone className="h-3.5 w-3.5" />
            {t("phoneDialer.call", "Call")}
          </Button>
        )}
      </div>
    </div>
  );
}
