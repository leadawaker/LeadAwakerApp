import { useState } from "react";
import { Play, Pause, Download, Sparkles, CheckCheck } from "lucide-react";
import type { CallStatus, ThreadMsg, Voicemail } from "../types";

// ── Mono caption label (tiny uppercase, used everywhere) ─────────────
export function MonoLabel({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{ fontFamily: "var(--mono)", fontSize: 9, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: color ?? "var(--mute-2)" }}>
      {children}
    </span>
  );
}

// ── Caller avatar (wine-tinted initials) ─────────────────────────────
export function VoiceAvatar({ ini, size = 38, radius }: { ini: string; size?: number; radius?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: radius != null ? radius : Math.round(size * 0.28), flexShrink: 0, background: "var(--wine-grad)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--paper)", fontFamily: "var(--mono)", fontWeight: 600, fontSize: Math.round(size * 0.34), letterSpacing: "0.01em", boxShadow: "var(--sh-raised-crisp)" }}>
      {ini}
    </div>
  );
}

// ── Status pill ──────────────────────────────────────────────────────
const STATUS_MAP: Record<CallStatus, { label: string; fg: string; bg: string; inset?: boolean }> = {
  booked:    { label: "Booked",      fg: "var(--good)",   bg: "var(--good-tint)" },
  recovered: { label: "Recovered",   fg: "var(--wine)",   bg: "var(--wine-tint)" },
  texted:    { label: "Texted back", fg: "var(--warn)",   bg: "var(--warn-tint)" },
  noreply:   { label: "No reply",    fg: "var(--mute-2)", bg: "var(--bg)", inset: true },
};

export function VoiceStatusPill({ status, small }: { status: CallStatus; small?: boolean }) {
  const c = STATUS_MAP[status];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--mono)", fontSize: small ? 8 : 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", padding: small ? "2px 7px" : "3px 9px", borderRadius: "var(--r-pill)", color: c.fg, background: c.bg, boxShadow: c.inset ? "var(--sh-inset-crisp)" : "none" }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: c.fg }} />
      {c.label}
    </span>
  );
}

// ── WhatsApp glyph (re-used in list rows + thread) ───────────────────
export function WaGlyph({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm5.8 14.13c-.24.68-1.42 1.32-1.95 1.36-.5.05-1.13.07-1.83-.11-.42-.13-.96-.31-1.66-.61-2.92-1.26-4.82-4.2-4.97-4.4-.14-.2-1.19-1.58-1.19-3.01 0-1.43.75-2.13 1.02-2.42.27-.29.58-.36.78-.36.19 0 .39 0 .56.01.18.01.42-.07.66.5.24.59.82 2.02.89 2.17.07.14.12.31.02.51-.1.2-.15.31-.29.48-.15.17-.31.39-.44.52-.15.15-.3.31-.13.6.17.29.76 1.25 1.63 2.02 1.12 1 2.07 1.31 2.36 1.46.29.15.46.12.63-.07.17-.2.73-.85.92-1.14.19-.29.39-.24.66-.15.27.1 1.7.8 1.99.95.29.15.48.22.55.34.07.12.07.71-.17 1.39Z" />
    </svg>
  );
}

// ── Voicemail player — play button, decorative waveform, transcript ──
export function VoicemailPlayer({ vm }: { vm: Voicemail }) {
  const [playing, setPlaying] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <MonoLabel>Voicemail</MonoLabel>
      <div className="neu-raised" style={{ borderRadius: "var(--r-surface)", background: "var(--card)", padding: "12px 14px", display: "flex", alignItems: "center", gap: 14 }}>
        <button
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? "Pause voicemail" : "Play voicemail"}
          style={{ width: 38, height: 38, flexShrink: 0, borderRadius: "50%", border: "none", cursor: "pointer", background: "var(--wine-grad)", color: "var(--paper)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "var(--sh-raised-crisp)" }}
        >
          {playing ? <Pause size={16} /> : <Play size={16} style={{ marginLeft: 2 }} />}
        </button>
        <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 2, height: 34 }}>
          {vm.wave.map((h, i) => (
            <span key={i} style={{ flex: 1, height: `${Math.round(h * 100)}%`, minWidth: 2, borderRadius: 2, background: i / vm.wave.length < 0.18 && playing ? "var(--wine)" : "var(--line-strong)" }} />
          ))}
        </div>
        <span style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, color: "var(--mute)", flexShrink: 0 }}>{vm.duration}</span>
        <button className="la-btn la-btn--icon" aria-label="Download recording" style={{ background: "transparent", boxShadow: "none", color: "var(--mute-2)", flexShrink: 0 }}>
          <Download size={14} />
        </button>
      </div>

      <MonoLabel>Transcript</MonoLabel>
      <div style={{ borderRadius: "var(--r-surface)", background: "var(--bg)", boxShadow: "var(--sh-inset-crisp)", padding: "12px 14px", display: "flex", gap: 10 }}>
        <span style={{ display: "flex", color: "var(--wine)", flexShrink: 0, marginTop: 1 }}><Sparkles size={13} /></span>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "var(--ink-soft)" }}>{vm.transcript}</p>
      </div>
    </div>
  );
}

// ── Chat bubble (AI = wine right-aligned, lead = white left-aligned) ─
export function ChatBubble({ msg }: { msg: ThreadMsg }) {
  const ai = msg.from === "ai";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: ai ? "flex-end" : "flex-start", gap: 4, maxWidth: "78%", alignSelf: ai ? "flex-end" : "flex-start" }}>
      {ai && msg.auto && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <MonoLabel color="var(--wine)"><span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Sparkles size={9} />Auto text-back</span></MonoLabel>
        </span>
      )}
      <div style={{ borderRadius: ai ? "var(--r-card) var(--r-card) 4px var(--r-card)" : "var(--r-card) var(--r-card) var(--r-card) 4px", padding: "9px 13px", fontSize: 13.5, lineHeight: 1.5, background: ai ? "var(--wine-grad)" : "var(--card)", color: ai ? "var(--paper)" : "var(--ink-soft)", boxShadow: ai ? "var(--sh-raised-crisp)" : "var(--sh-raised-crisp), inset 0 0 0 1px var(--line)" }}>
        {msg.text}
      </div>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontFamily: "var(--mono)", fontSize: 9, color: "var(--mute-2)", letterSpacing: "0.04em", padding: "0 2px" }}>
        {msg.time}
        {ai && <CheckCheck size={11} style={{ color: "var(--good)" }} />}
      </span>
    </div>
  );
}
