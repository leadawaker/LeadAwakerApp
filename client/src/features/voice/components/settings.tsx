import { useState } from "react";
import {
  PhoneMissed, Copy, Check, Mic, Upload, Trash2, Sparkles, Play,
  ArrowRight, Bell, Phone, MessageSquare,
} from "lucide-react";
import { WaGlyph } from "./atoms";

// ── Toggle ───────────────────────────────────────────────────────────
function VToggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  const w = 46, h = 26, k = h - 6;
  return (
    <button onClick={() => onChange(!on)} aria-pressed={on} style={{ width: w, height: h, flexShrink: 0, border: "none", cursor: "pointer", padding: 0, borderRadius: "var(--r-pill)", position: "relative", transition: "background 180ms", background: on ? "var(--wine)" : "var(--bg)", boxShadow: on ? "var(--sh-raised-crisp), inset 0 1px 2px rgba(0,0,0,0.18)" : "var(--sh-inset-crisp)" }}>
      <span style={{ position: "absolute", top: 3, left: on ? w - k - 3 : 3, width: k, height: k, borderRadius: "50%", background: on ? "var(--paper)" : "var(--card)", boxShadow: "var(--sh-raised-crisp)", transition: "left 180ms" }} />
    </button>
  );
}

// ── Setting row ──────────────────────────────────────────────────────
function SettingRow({ title, desc, children, last }: { title: string; desc?: string; children?: React.ReactNode; last?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 18, padding: "15px 0", borderBottom: last ? "none" : "1px solid var(--line)" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>{title}</div>
        {desc && <div style={{ fontSize: 12, lineHeight: 1.5, color: "var(--mute)", marginTop: 3 }}>{desc}</div>}
      </div>
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 10, paddingTop: 1 }}>{children}</div>
    </div>
  );
}

// ── Panel shell ──────────────────────────────────────────────────────
function SettingsPanel({ eyebrow, title, desc, children, accent, status }: { eyebrow: string; title: string; desc?: string; children: React.ReactNode; accent?: string; status?: React.ReactNode }) {
  return (
    <div className="neu-raised" style={{ borderRadius: "var(--r-card)", background: "var(--card)", overflow: "hidden" }}>
      {accent && <div style={{ height: 3, background: accent }} />}
      <div style={{ padding: "20px 24px 8px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div className="eyebrow eyebrow-sm" style={{ color: "var(--wine)" }}>{eyebrow}</div>
          {status}
        </div>
        <div style={{ fontFamily: "var(--serif)", fontSize: 24, color: "var(--ink)", lineHeight: 1.15, marginTop: 6 }}>{title}</div>
        {desc && <p style={{ margin: "7px 0 0", fontSize: 13, lineHeight: 1.55, color: "var(--mute)", maxWidth: 620 }}>{desc}</p>}
      </div>
      <div style={{ padding: "4px 24px 18px" }}>{children}</div>
    </div>
  );
}

// ── Stepper ──────────────────────────────────────────────────────────
function Stepper({ value, onChange, min = 0, max = 999, step = 1, suffix }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; suffix?: string }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 2, background: "var(--bg)", boxShadow: "var(--sh-inset-crisp)", borderRadius: "var(--r-button)", padding: 3 }}>
      <button onClick={() => onChange(Math.max(min, value - step))} className="la-btn la-btn--soft la-btn--icon" style={{ width: 26, height: 26 }}>−</button>
      <span style={{ minWidth: 64, textAlign: "center", fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, color: "var(--ink)" }}>{value}{suffix ? ` ${suffix}` : ""}</span>
      <button onClick={() => onChange(Math.min(max, value + step))} className="la-btn la-btn--soft la-btn--icon" style={{ width: 26, height: 26 }}>+</button>
    </div>
  );
}

// ── Copy row (mono value + copy button) ──────────────────────────────
function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard?.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, borderRadius: "var(--r-surface)", background: "var(--bg)", boxShadow: "var(--sh-inset-crisp)", padding: "10px 14px" }}>
      <span style={{ width: 118, flexShrink: 0, fontFamily: "var(--mono)", fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mute-2)" }}>{label}</span>
      <span style={{ flex: 1, minWidth: 0, fontFamily: "var(--mono)", fontSize: 13, color: "var(--ink-soft)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span>
      <button onClick={copy} className="la-btn la-btn--icon" style={{ background: "transparent", boxShadow: "none", color: copied ? "var(--good)" : "var(--mute-2)", flexShrink: 0 }} aria-label={`Copy ${label}`}>
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </div>
  );
}

// ── Status pill ──────────────────────────────────────────────────────
function StatusPill({ on }: { on: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--mono)", fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", padding: "3px 10px", borderRadius: "var(--r-pill)", color: on ? "var(--good)" : "var(--mute-2)", background: on ? "var(--good-tint)" : "var(--bg)", boxShadow: on ? "none" : "var(--sh-inset-crisp)" }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: on ? "var(--good)" : "var(--mute-2)" }} />
      {on ? "Live" : "Off"}
    </span>
  );
}

// ── How-it-works mini flow ───────────────────────────────────────────
function FlowStep({ n, icon, tint, title, desc }: { n: string; icon: React.ReactNode; tint: string; title: string; desc: string }) {
  return (
    <div style={{ flex: 1, minWidth: 0, borderRadius: "var(--r-surface)", background: "var(--card)", boxShadow: "var(--sh-raised-crisp)", padding: 15 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 9 }}>
        <span style={{ width: 28, height: 28, borderRadius: "var(--r-button)", background: tint, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--paper)", flexShrink: 0 }}>{icon}</span>
        <span style={{ fontFamily: "var(--mono)", fontSize: 8.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--mute-2)" }}>Step {n}</span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", lineHeight: 1.25 }}>{title}</div>
      <div style={{ fontSize: 11.5, lineHeight: 1.5, color: "var(--mute)", marginTop: 5 }}>{desc}</div>
    </div>
  );
}

function HowItWorks() {
  const arrow = <div style={{ display: "flex", alignItems: "center", color: "var(--mute-2)" }}><ArrowRight size={18} /></div>;
  return (
    <div style={{ background: "var(--bg)", boxShadow: "var(--sh-inset-crisp)", borderRadius: "var(--r-card)", padding: 16 }}>
      <div style={{ display: "flex", alignItems: "stretch", gap: 12, flexWrap: "wrap" }}>
        <FlowStep n="1" icon={<PhoneMissed size={15} />} tint="var(--wine)" title="Caller misses you" desc="Your line forwards unanswered calls to the number we provision — every one is already a missed call." />
        {arrow}
        <FlowStep n="2" icon={<WaGlyph size={15} />} tint="var(--good)" title="Instant text-back" desc="Within seconds the caller gets a WhatsApp from your own number: “Sorry we missed you…”." />
        {arrow}
        <FlowStep n="3" icon={<Sparkles size={14} />} tint="var(--wine-grad)" title="AI takes the conversation" desc="When they reply, the AI qualifies and books — reading the voicemail transcript if they left one." />
      </div>
    </div>
  );
}

// ── Settings tab ─────────────────────────────────────────────────────
export function VoiceSettings() {
  const [enabled, setEnabled] = useState(true);
  const [campaign, setCampaign] = useState("missed-call-reactivation");
  const [greetingMode, setGreetingMode] = useState<"silent" | "voice">("voice");
  const [hasGreeting, setHasGreeting] = useState(true);
  const [ttsText, setTtsText] = useState("");
  const [ttsLocale, setTtsLocale] = useState<"nl" | "en" | "pt">("nl");
  const [voicemail, setVoicemail] = useState(true);
  const [dailyCap, setDailyCap] = useState(100);
  const [notify, setNotify] = useState(true);
  const [notifyChannel, setNotifyChannel] = useState<"whatsapp" | "email" | "slack">("whatsapp");

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 24, background: "var(--bg)" }}>
      <div style={{ maxWidth: 880, margin: "0 auto", display: "flex", flexDirection: "column", gap: 18 }}>

        {/* 1 · Service */}
        <SettingsPanel eyebrow="Voice service" accent="var(--wine-grad)" status={<StatusPill on={enabled} />}
          title="Missed-Call Text-Back"
          desc="When a call goes unanswered, the caller gets an instant WhatsApp from your own number and drops straight into the AI conversation. No missed call is ever lost, no staff time spent.">
          <HowItWorks />
          <SettingRow title="Enable missed-call text-back" desc="Master switch for this account. Forwarding and a campaign must be set below." last>
            <VToggle on={enabled} onChange={setEnabled} />
          </SettingRow>
        </SettingsPanel>

        {enabled && (
          <>
            {/* 2 · Call forwarding */}
            <SettingsPanel eyebrow="Connect your line" accent="var(--good)"
              title="Call forwarding"
              desc="Keep your published number. Set conditional forwarding (on no-answer / busy / unreachable) to the Twilio voice number we provisioned — you never touch the Twilio console.">
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
                <CopyRow label="Voice number" value="+31 97 010 256 18" />
                <CopyRow label="Forward code" value="*61*+31970102561 8#" />
              </div>
              <p style={{ fontSize: 11.5, color: "var(--mute)", fontStyle: "italic", marginTop: 10, lineHeight: 1.5 }}>
                Dial the forward code from the business phone to route unanswered calls. The exact code varies by carrier — we show yours here.
              </p>
            </SettingsPanel>

            {/* 3 · Campaign */}
            <SettingsPanel eyebrow="The opener" accent="var(--stage-contacted)"
              title="Text-back campaign"
              desc="Which campaign fires the first WhatsApp. It uses that campaign's approved cold-open template and persona, then hands off to the AI on reply.">
              <SettingRow title="Missed-call campaign" desc="Sends the approved opener from your own number." last>
                <select value={campaign} onChange={(e) => setCampaign(e.target.value)} className="neu-input" style={{ fontSize: 12.5, padding: "8px 12px", minWidth: 220 }}>
                  <option value="missed-call-reactivation">Missed-Call Reactivation</option>
                  <option value="solar-inbound">Solar Inbound</option>
                  <option value="discovery-demo">Discovery Demo</option>
                </select>
              </SettingRow>
            </SettingsPanel>

            {/* 4 · Greeting */}
            <SettingsPanel eyebrow="What the caller hears" accent="var(--wine)"
              title="Call greeting"
              desc="What plays when the forwarded call is answered before it hangs up. Silent picks up and ends quietly; Voice plays a short greeting you record or generate.">
              <SettingRow title="Greeting mode" desc="Both still fire the WhatsApp text-back.">
                <div className="la-seg">
                  {(["silent", "voice"] as const).map((m) => (
                    <button key={m} onClick={() => setGreetingMode(m)} className={`la-seg-btn${greetingMode === m ? " on" : ""}`} style={{ textTransform: "capitalize" }}>{m}</button>
                  ))}
                </div>
              </SettingRow>

              {greetingMode === "voice" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "14px 15px", marginTop: 6, borderRadius: "var(--r-surface)", background: "var(--bg)", boxShadow: "var(--sh-inset-crisp)" }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button className="la-btn la-btn--soft"><Mic size={13} />Record</button>
                    <button className="la-btn la-btn--soft"><Upload size={13} />Upload</button>
                    {hasGreeting && <button className="la-btn la-btn--soft" onClick={() => setHasGreeting(false)} style={{ color: "var(--wine)" }}><Trash2 size={13} />Remove</button>}
                  </div>
                  {hasGreeting && (
                    <div style={{ display: "flex", alignItems: "center", gap: 12, borderRadius: "var(--r-surface)", background: "var(--card)", boxShadow: "var(--sh-raised-crisp)", padding: "9px 13px" }}>
                      <button className="la-btn la-btn--icon la-btn--wine" aria-label="Play greeting" style={{ borderRadius: "50%" }}><Play size={13} style={{ marginLeft: 1 }} /></button>
                      <span style={{ flex: 1, fontSize: 12, color: "var(--mute)", fontStyle: "italic" }}>greeting-nl.mp3 · 0:06</span>
                    </div>
                  )}
                  <div style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
                      <Sparkles size={13} style={{ color: "var(--wine)" }} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)" }}>Generate from your cloned voice</span>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <input value={ttsText} onChange={(e) => setTtsText(e.target.value)} placeholder="Type the greeting…" className="neu-input" style={{ flex: 1, minWidth: 180, fontSize: 12, padding: "8px 12px" }} />
                      <select value={ttsLocale} onChange={(e) => setTtsLocale(e.target.value as any)} className="neu-input" style={{ fontSize: 12, padding: "8px 10px" }}>
                        {(["nl", "en", "pt"] as const).map((l) => <option key={l} value={l}>{l.toUpperCase()}</option>)}
                      </select>
                      <button className="la-btn la-btn--soft" disabled={!ttsText.trim()} onClick={() => setHasGreeting(true)}><Play size={13} />Generate</button>
                    </div>
                  </div>
                </div>
              )}
            </SettingsPanel>

            {/* 5 · Voicemail (Tier 2) */}
            <SettingsPanel eyebrow="Tier 2" accent="var(--good)"
              title="Record a voicemail"
              desc="Let the caller leave a message. It's transcribed and read by the AI before it replies, so the first real answer already knows why they called. The raw recording is deleted after transcription.">
              <SettingRow title="Enable voicemail" desc="Adds a beep-and-record step to the call, then transcribes it onto the lead." last>
                <VToggle on={voicemail} onChange={setVoicemail} />
              </SettingRow>
            </SettingsPanel>

            {/* 6 · Delivery & guardrails */}
            <SettingsPanel eyebrow="Safety net" accent="var(--warn)"
              title="Delivery & guardrails"
              desc="Keep costs and your number's quality rating safe, and make sure a human knows when a call comes in.">
              <SettingRow title="Daily text-back cap" desc="A generous circuit-breaker against spam-dial floods — not a product limit. Each text-back is a paid template send.">
                <Stepper value={dailyCap} onChange={setDailyCap} min={10} max={500} step={10} suffix="/ day" />
              </SettingRow>
              <SettingRow title="Notify me on a new missed call" desc="A heads-up the moment a forwarded call lands.">
                <VToggle on={notify} onChange={setNotify} />
              </SettingRow>
              {notify && (
                <SettingRow title="Notify via" last>
                  <div className="la-seg">
                    <button onClick={() => setNotifyChannel("whatsapp")} className={`la-seg-btn${notifyChannel === "whatsapp" ? " on" : ""}`}><WaGlyph size={12} />WhatsApp</button>
                    <button onClick={() => setNotifyChannel("email")} className={`la-seg-btn${notifyChannel === "email" ? " on" : ""}`}><MessageSquare size={12} />Email</button>
                    <button onClick={() => setNotifyChannel("slack")} className={`la-seg-btn${notifyChannel === "slack" ? " on" : ""}`}><Bell size={12} />Slack</button>
                  </div>
                </SettingRow>
              )}
            </SettingsPanel>
          </>
        )}

        {/* save bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "4px 4px 8px" }}>
          <button className="la-btn la-btn--wine la-btn--lg"><Check size={14} />Save changes</button>
          <button className="la-btn la-btn--soft la-btn--lg">Discard</button>
          <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 7, fontFamily: "var(--mono)", fontSize: 9.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--mute-2)" }}>
            <Phone size={12} style={{ color: enabled ? "var(--good)" : "var(--mute-2)" }} />
            {enabled ? "Service live" : "Service off"}
          </span>
        </div>
      </div>
    </div>
  );
}
