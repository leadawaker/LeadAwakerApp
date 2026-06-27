import { useState, useEffect, useMemo } from "react";
import { Phone, MoreHorizontal, Smile, Paperclip, SendHorizonal, PhoneMissed } from "lucide-react";
import type { MissedCall, VoiceView } from "../types";
import { VOICE_CALLS } from "../data";
import { VoiceAvatar, VoiceStatusPill, MonoLabel, VoicemailPlayer, ChatBubble, WaGlyph } from "./atoms";

// ── Views (left-list filters, shown in the topbar) ───────────────────
export function getVoiceViews(): VoiceView[] {
  const recovered = VOICE_CALLS.filter((c) => c.status === "recovered" || c.status === "booked").length;
  const awaiting = VOICE_CALLS.filter((c) => c.status === "texted" || c.status === "noreply").length;
  return [
    { key: "all", label: "All calls", count: VOICE_CALLS.length },
    { key: "recovered", label: "Recovered", count: recovered },
    { key: "awaiting", label: "Awaiting reply", count: awaiting },
  ];
}

function filterByView(view: string): MissedCall[] {
  if (view === "recovered") return VOICE_CALLS.filter((c) => c.status === "recovered" || c.status === "booked");
  if (view === "awaiting") return VOICE_CALLS.filter((c) => c.status === "texted" || c.status === "noreply");
  return VOICE_CALLS;
}

// ── Topbar view chips ────────────────────────────────────────────────
export function VoiceInboxTopControls({ views, view, setView }: { views: VoiceView[]; view: string; setView: (v: string) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {views.map((v) => {
        const on = view === v.key;
        return (
          <button key={v.key} onClick={() => setView(v.key)} style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", border: "none", padding: "6px 11px", borderRadius: "var(--r-pill)", transition: "all 120ms", fontFamily: "var(--sans)", fontSize: 12, fontWeight: on ? 700 : 500, background: on ? "var(--card)" : "transparent", color: on ? "var(--wine)" : "var(--mute)", boxShadow: on ? "var(--sh-raised-crisp)" : "none", whiteSpace: "nowrap" }}>
            {v.label}
            {v.count != null && (
              <span style={{ fontFamily: "var(--mono)", fontSize: 9, fontWeight: 700, minWidth: 16, height: 16, padding: "0 5px", borderRadius: "var(--r-pill)", display: "inline-flex", alignItems: "center", justifyContent: "center", background: on ? "var(--wine-tint)" : "var(--bg)", boxShadow: on ? "none" : "var(--sh-inset-crisp)", color: on ? "var(--wine)" : "var(--mute)" }}>
                {v.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Group header in the list pane ────────────────────────────────────
function VoiceGroupHeader({ label, count }: { label: string; count: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 8px 5px" }}>
      <MonoLabel>{label}</MonoLabel>
      <span style={{ fontFamily: "var(--mono)", fontSize: 9, fontWeight: 700, color: "var(--mute-2)" }}>{count}</span>
      <span style={{ flex: 1, height: 1, background: "var(--line)" }} />
    </div>
  );
}

// ── List row ─────────────────────────────────────────────────────────
function VoiceListCard({ call, active, onClick }: { call: MissedCall; active: boolean; onClick: () => void }) {
  const title = call.name ?? call.phone;
  const lastMsg = call.thread[call.thread.length - 1]?.text ?? "";
  return (
    <div
      onClick={onClick}
      style={{ borderRadius: "var(--r-surface)", position: "relative", cursor: "pointer", background: active ? "var(--card)" : "transparent", boxShadow: active ? "var(--sh-raised-medium), inset 0 0 0 1px var(--line-strong)" : "none", transform: active ? "translateX(2px)" : "none", transition: "background 130ms, transform 130ms, box-shadow 130ms" }}
      onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLDivElement).style.background = "var(--wine-tint)"; }}
      onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
    >
      {active && <div style={{ position: "absolute", left: 0, top: 6, bottom: 6, width: 3, background: "var(--wine)", borderRadius: "0 3px 3px 0" }} />}
      <div style={{ padding: "9px 12px", display: "flex", gap: 10 }}>
        <VoiceAvatar ini={call.ini} size={38} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 2 }}>
            <span style={{ fontFamily: "var(--serif)", fontSize: 15.5, color: "var(--ink)", fontWeight: active ? 600 : 400, lineHeight: 1.1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
            <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--mute-2)", flexShrink: 0, letterSpacing: "0.04em" }}>{call.ago}</span>
          </div>
          <p style={{ margin: "0 0 6px", fontSize: 12, lineHeight: 1.45, color: "var(--mute)", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden" } as React.CSSProperties}>{lastMsg}</p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--mono)", fontSize: 9, color: "var(--mute-2)", letterSpacing: "0.06em" }}>
              <PhoneMissed size={11} style={{ color: "var(--wine)" }} />
              {call.voicemail ? "Voicemail" : "Missed call"}
            </span>
            <VoiceStatusPill status={call.status} small={!active} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Detail header ────────────────────────────────────────────────────
function VoiceDetailHeader({ call }: { call: MissedCall }) {
  return (
    <div style={{ flexShrink: 0, padding: "16px 22px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 14 }}>
      <VoiceAvatar ini={call.ini} size={44} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "var(--serif)", fontSize: 22, color: "var(--ink)", lineHeight: 1.1, marginBottom: 3 }}>{call.name ?? call.phone}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--mute)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
          <span>{call.phone}</span>
          <span style={{ color: "var(--line-strong)" }}>·</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "var(--wine)" }}><PhoneMissed size={11} />Missed call</span>
          <span style={{ color: "var(--line-strong)" }}>·</span>
          <span>{call.day} {call.time}</span>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <button className="la-btn la-btn--icon la-btn--soft" aria-label="Call back"><Phone size={15} /></button>
        <button className="la-btn la-btn--icon la-btn--soft" aria-label="Open WhatsApp" style={{ color: "var(--good)" }}><WaGlyph size={16} /></button>
        <button className="la-btn la-btn--icon la-btn--soft" aria-label="More"><MoreHorizontal size={15} /></button>
      </div>
    </div>
  );
}

// ── Composer ─────────────────────────────────────────────────────────
function VoiceComposer() {
  const [text, setText] = useState("");
  return (
    <div style={{ flexShrink: 0, padding: "12px 20px 18px" }}>
      <div className="neu-raised" style={{ borderRadius: "var(--r-pill)", background: "var(--card)", padding: "5px 6px 5px 16px", display: "flex", alignItems: "center", gap: 10 }}>
        <button className="la-btn la-btn--icon" aria-label="Emoji" style={{ background: "transparent", boxShadow: "none", color: "var(--mute-2)" }}><Smile size={17} /></button>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message…"
          style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", fontSize: 13.5, color: "var(--ink)", fontFamily: "var(--sans)" }}
        />
        <button className="la-btn la-btn--icon" aria-label="Attach" style={{ background: "transparent", boxShadow: "none", color: "var(--mute-2)" }}><Paperclip size={16} /></button>
        <button aria-label="Send" style={{ width: 38, height: 38, flexShrink: 0, borderRadius: "50%", border: "none", cursor: "pointer", background: "var(--wine-grad)", color: "var(--paper)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "var(--sh-raised-crisp)" }}>
          <SendHorizonal size={16} />
        </button>
      </div>
    </div>
  );
}

// ── Detail pane ──────────────────────────────────────────────────────
function VoiceDetail({ call }: { call: MissedCall }) {
  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <VoiceDetailHeader call={call} />
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "20px 22px", display: "flex", flexDirection: "column", gap: 22 }}>
        {call.voicemail && <VoicemailPlayer vm={call.voicemail} />}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ flex: 1, height: 1, background: "var(--line)" }} />
          <MonoLabel>WhatsApp text-back</MonoLabel>
          <span style={{ flex: 1, height: 1, background: "var(--line)" }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {call.thread.map((m) => <ChatBubble key={m.id} msg={m} />)}
        </div>
      </div>
      <VoiceComposer />
    </div>
  );
}

// ── Empty detail ─────────────────────────────────────────────────────
function VoiceEmptyDetail() {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, color: "var(--mute-2)" }}>
      <PhoneMissed size={28} />
      <MonoLabel>Select a missed call</MonoLabel>
    </div>
  );
}

// ── Inbox ────────────────────────────────────────────────────────────
export function VoiceInbox({ selection, setSelection, query, view }: { selection: string | null; setSelection: (id: string | null) => void; query: string; view: string }) {
  const [vw, setVw] = useState(typeof window !== "undefined" ? window.innerWidth : 1600);
  useEffect(() => {
    const onR = () => setVw(window.innerWidth);
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, []);
  const narrow = vw < 920;

  const items = useMemo(() => {
    let list = filterByView(view);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((c) => (c.name ?? "").toLowerCase().includes(q) || c.phone.includes(q) || (c.voicemail?.transcript ?? "").toLowerCase().includes(q));
    }
    return list;
  }, [view, query]);

  const sections = useMemo(() => {
    const today = items.filter((c) => c.ageHours < 24);
    const earlier = items.filter((c) => c.ageHours >= 24);
    return [
      { key: "today", label: "Today", items: today },
      { key: "earlier", label: "Earlier", items: earlier },
    ].filter((s) => s.items.length > 0);
  }, [items]);

  const resolved = selection ? VOICE_CALLS.find((c) => c.id === selection) ?? null : null;

  // Open onto the first call — desktop only.
  useEffect(() => {
    if (narrow) return;
    if (!resolved && items.length > 0) setSelection(items[0].id);
  }, [narrow, resolved, items, setSelection]);

  const listPane = (
    <div style={{ width: narrow ? "100%" : 348, flexShrink: 0, display: "flex", flexDirection: "column", minHeight: 0, borderRight: narrow ? "none" : "1px solid var(--line)", background: "var(--surface)" }}>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "6px 10px 8px" }}>
        {items.length === 0 ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
            <MonoLabel>Nothing here</MonoLabel>
          </div>
        ) : (
          sections.map((sec) => (
            <div key={sec.key}>
              <VoiceGroupHeader label={sec.label} count={sec.items.length} />
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {sec.items.map((c) => (
                  <VoiceListCard key={c.id} call={c} active={selection === c.id} onClick={() => setSelection(c.id)} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
      <div style={{ flexShrink: 0, padding: "8px 16px", borderTop: "1px solid var(--line)" }}>
        <MonoLabel>Showing {items.length} of {VOICE_CALLS.length}</MonoLabel>
      </div>
    </div>
  );

  const rightPane = (
    <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--bg)" }}>
      {narrow && resolved && (
        <button onClick={() => setSelection(null)} className="la-btn la-btn--soft" style={{ margin: "12px 0 0 14px", alignSelf: "flex-start" }}>‹ Back</button>
      )}
      {resolved ? <VoiceDetail call={resolved} /> : <VoiceEmptyDetail />}
    </div>
  );

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden", background: "var(--bg)" }}>
      {narrow ? (resolved ? rightPane : listPane) : <>{listPane}{rightPane}</>}
    </div>
  );
}
