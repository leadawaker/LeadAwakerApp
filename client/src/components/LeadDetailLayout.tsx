import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { DataEmptyState } from "@/components/crm/DataEmptyState";
import { Tag, Play, Pause, Mic } from "lucide-react";

export type LeadDetailLead = {
  id: number;
  account_id: number;
  campaign_id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  phone: string;
  email: string;
  conversion_status: string;
  automation_status: string;
  source: string;
  notes: string;
  priority?: string;
  timezone?: string;
};

export type LeadDetailMessage = {
  id: number;
  lead_id: number;
  direction: string;
  content: string;
  created_at: string;
  type?: string;
  status?: string;
  who?: string;
  agent_name?: string;
  attachment?: string | null;
};

export function LeadDetailLayout({
  mode,
  lead,
  messages,
  tags,
  onBack,
}: {
  mode: "agency" | "subaccount";
  lead: LeadDetailLead;
  messages: LeadDetailMessage[];
  tags: string[];
  onBack: () => void;
}) {
  const [showTags, setShowTags] = useState(false);
  const [draft, setDraft] = useState(() => ({
    first_name: lead.first_name ?? "",
    last_name: lead.last_name ?? "",
    email: lead.email ?? "",
    phone: lead.phone ?? "",
    dob: "",
    source: lead.source ?? "",
    type: "",
    utm_content: "",
    utm_source: "",
    utm_campaign: "",
    utm_medium: "",
    consent: "",
    wants_to_schedule: "",
    platform: "",
  }));

  const ordered = useMemo(() => {
    return [...messages].sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  }, [messages]);

  return (
    <div className="py-4" data-testid="page-contact-detail">
      {/* Top header */}
      <div className="flex items-start justify-between gap-4" data-testid="header-contact">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground" data-testid="text-contact-header-label">
            Contact
          </div>
          <div className="text-2xl font-extrabold tracking-tight truncate" data-testid="text-contact-name">
            {lead.full_name}
          </div>
          <div className="mt-1 text-sm text-muted-foreground" data-testid="text-contact-meta">
            {lead.phone || "—"} {lead.email ? `• ${lead.email}` : ""}
          </div>
        </div>

        <div className="flex items-center gap-2" data-testid="badges-contact">
          <span
            className="px-2 py-1 rounded-full text-xs border border-border bg-muted/20"
            data-testid="badge-conversion-status"
          >
            {lead.conversion_status || "—"}
          </span>
          <span
            className="px-2 py-1 rounded-full text-xs border border-border bg-muted/20"
            data-testid="badge-automation-status"
          >
            {lead.automation_status || "—"}
          </span>
          <span
            className={cn(
              "px-2 py-1 rounded-full text-xs border",
              mode === "agency" ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-muted/20",
            )}
            data-testid="badge-workspace-mode"
          >
            {mode}
          </span>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 xl:grid-cols-[360px_1fr_320px] gap-6" data-testid="layout-contact">
        {/* Left sidebar: form */}
        <aside className="rounded-2xl border border-border bg-background overflow-hidden" data-testid="panel-left">
          <Section title="Contact" testId="section-contact">
            <Row label="first_name" testId="row-first_name">
              <Input value={draft.first_name} onChange={(v) => setDraft((p) => ({ ...p, first_name: v }))} testId="input-first_name" />
            </Row>
            <Row label="last_name" testId="row-last_name">
              <Input value={draft.last_name} onChange={(v) => setDraft((p) => ({ ...p, last_name: v }))} testId="input-last_name" />
            </Row>
            <Row label="email" testId="row-email">
              <Input value={draft.email} onChange={(v) => setDraft((p) => ({ ...p, email: v }))} testId="input-email" />
            </Row>
            <Row label="phone" testId="row-phone">
              <Input value={draft.phone} onChange={(v) => setDraft((p) => ({ ...p, phone: v }))} testId="input-phone" />
            </Row>
            <Row label="DOB" testId="row-dob">
              <Input value={draft.dob} onChange={(v) => setDraft((p) => ({ ...p, dob: v }))} testId="input-dob" placeholder="YYYY-MM-DD" />
            </Row>
            <Row label="Source" testId="row-source">
              <Input value={draft.source} onChange={(v) => setDraft((p) => ({ ...p, source: v }))} testId="input-source" />
            </Row>
            <Row label="Type" testId="row-type">
              <Input value={draft.type} onChange={(v) => setDraft((p) => ({ ...p, type: v }))} testId="input-type" />
            </Row>
            <ReadRow label="Automation Status" value={lead.automation_status || "—"} testId="text-contact-automation-status" />
          </Section>

          <Section title="Attribution" testId="section-attribution">
            <Row label="utm_content" testId="row-utm_content">
              <Input value={draft.utm_content} onChange={(v) => setDraft((p) => ({ ...p, utm_content: v }))} testId="input-utm_content" />
            </Row>
            <Row label="utm_source" testId="row-utm_source">
              <Input value={draft.utm_source} onChange={(v) => setDraft((p) => ({ ...p, utm_source: v }))} testId="input-utm_source" />
            </Row>
            <Row label="utm_campaign" testId="row-utm_campaign">
              <Input value={draft.utm_campaign} onChange={(v) => setDraft((p) => ({ ...p, utm_campaign: v }))} testId="input-utm_campaign" />
            </Row>
            <Row label="utm_medium" testId="row-utm_medium">
              <Input value={draft.utm_medium} onChange={(v) => setDraft((p) => ({ ...p, utm_medium: v }))} testId="input-utm_medium" />
            </Row>
          </Section>

          <Section title="Qualification" testId="section-qualification">
            <Row label="consent" testId="row-consent">
              <Input value={draft.consent} onChange={(v) => setDraft((p) => ({ ...p, consent: v }))} testId="input-consent" />
            </Row>
            <Row label="wants_to_schedule" testId="row-wants_to_schedule">
              <Input value={draft.wants_to_schedule} onChange={(v) => setDraft((p) => ({ ...p, wants_to_schedule: v }))} testId="input-wants_to_schedule" />
            </Row>
            <Row label="platform" testId="row-platform">
              <Input value={draft.platform} onChange={(v) => setDraft((p) => ({ ...p, platform: v }))} testId="input-platform" />
            </Row>
          </Section>
        </aside>

        {/* Center: chat */}
        <section className="rounded-2xl border border-border bg-background overflow-hidden flex flex-col" data-testid="panel-center">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between" data-testid="chat-head">
            <div>
              <div className="text-sm font-semibold" data-testid="text-chat-title">Interactions</div>
              <div className="text-xs text-muted-foreground" data-testid="text-chat-sub">Inbound left • Outbound right</div>
            </div>
            {/* Tag toggle button */}
            <div className="relative shrink-0" data-testid="wrap-tag-toggle">
              <button
                type="button"
                onClick={() => setShowTags((v) => !v)}
                className="h-7 w-7 rounded-full border border-border bg-muted/20 flex items-center justify-center"
                title={showTags ? "Hide tags" : "Show tags"}
                data-testid="button-toggle-tags"
              >
                <Tag className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              {!showTags && (
                <svg
                  className="absolute inset-0 pointer-events-none text-muted-foreground"
                  viewBox="0 0 28 28"
                  width="28"
                  height="28"
                >
                  <line x1="5" y1="5" x2="23" y2="23" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-auto p-4 space-y-3" data-testid="chat-scroll">
            {showTags && (tags.length > 0 || lead.conversion_status) && (
              <div className="flex flex-wrap gap-1.5 pb-3 mb-1 border-b border-border/40" data-testid="strip-tags">
                {lead.conversion_status && (
                  <span
                    className="px-2 py-0.5 rounded-full text-xs border border-primary/30 bg-primary/10 text-primary font-medium"
                    data-testid="pill-conversion-status-chat"
                  >
                    {lead.conversion_status}
                  </span>
                )}
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 rounded-full text-xs border border-border bg-muted/20"
                    data-testid={`pill-tag-chat-${tag}`}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {ordered.length === 0 ? (
              <div data-testid="empty-chat">
                <DataEmptyState variant="conversations" compact title="No conversations yet" description="Messages will appear here once the lead receives outreach." />
              </div>
            ) : (
              ordered.map((m) => <MessageBubble key={m.id} item={m} />)
            )}
          </div>

          <div className="p-4 border-t border-border" data-testid="chat-compose">
            <ManualCompose disabled={false} />
          </div>
        </section>

        {/* Right sidebar */}
        <aside className="rounded-2xl border border-border bg-background overflow-hidden" data-testid="panel-right">
          <Section title="Tags" testId="section-tags">
            <div className="flex flex-wrap gap-2" data-testid="wrap-tags">
              {tags.length === 0 ? (
                <div data-testid="text-tags-empty">
                  <DataEmptyState variant="tags" compact title="No tags" description="Tags will appear here once assigned to this lead." />
                </div>
              ) : (
                tags.map((t) => (
                  <span
                    key={t}
                    className="px-2 py-1 rounded-full text-xs border border-border bg-muted/20"
                    data-testid={`pill-tag-${t}`}
                  >
                    {t}
                  </span>
                ))
              )}
            </div>
          </Section>

          <Section title="Automation" testId="section-automation">
            <ReadRow label="automation_status" value={lead.automation_status || "—"} testId="text-automation-status" />
          </Section>

          <Section title="Actions" testId="section-actions">
            <select
              className="h-10 w-full rounded-xl border border-border bg-muted/20 px-3 text-sm"
              defaultValue=""
              data-testid="select-actions"
            >
              <option value="" disabled>
                Actions
              </option>
              <option value="mark_dnd">Mark as DND</option>
              <option value="pause_ai">Pause AI</option>
              <option value="assign">Assign owner</option>
            </select>

            <button
              type="button"
              className="mt-3 h-10 w-full rounded-xl border border-border bg-muted/20 hover:bg-muted/30 text-sm font-semibold"
              onClick={onBack}
              data-testid="button-back"
            >
              Back to list
            </button>
          </Section>
        </aside>
      </div>
    </div>
  );
}

function Section({ title, children, testId }: { title: string; children: React.ReactNode; testId: string }) {
  return (
    <div className="p-4 border-b border-border last:border-b-0" data-testid={testId}>
      <div className="text-sm font-semibold" data-testid={`${testId}-title`}>
        {title}
      </div>
      <div className="mt-3 space-y-3" data-testid={`${testId}-body`}>
        {children}
      </div>
    </div>
  );
}

function Row({ label, children, testId }: { label: string; children: React.ReactNode; testId: string }) {
  return (
    <div data-testid={testId}>
      <div className="flex items-center justify-between" data-testid={`${testId}-label-row`}>
        <label className="text-xs text-muted-foreground" data-testid={`${testId}-label`}>
          {label}
        </label>
      </div>
      <div className="mt-1" data-testid={`${testId}-control`}>
        {children}
      </div>
    </div>
  );
}

function Input({
  value,
  onChange,
  testId,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  testId: string;
  placeholder?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-10 w-full rounded-xl border border-border bg-muted/20 px-3 text-sm"
      data-testid={testId}
    />
  );
}

function ReadRow({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="text-sm" data-testid={testId}>
      <div className="text-xs text-muted-foreground" data-testid={`${testId}-label`}>
        {label}
      </div>
      <div className="mt-1 break-words" data-testid={`${testId}-value`}>
        {value}
      </div>
    </div>
  );
}

const BAR_COUNT_VM = 60;

function VoiceMemoPlayer({ url, color = "#0ABFA3" }: { url: string; color?: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState<1 | 1.5 | 2>(1);
  const rafRef = useRef<number | null>(null);

  const startRaf = useCallback(() => {
    const tick = () => {
      const a = audioRef.current;
      if (!a) return;
      setCurrentTime(a.currentTime);
      if (!a.paused && !a.ended) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const stopRaf = useCallback(() => {
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
  }, []);

  useEffect(() => () => stopRaf(), [stopRaf]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onMeta = () => setDuration(isFinite(a.duration) ? a.duration : 0);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("durationchange", onMeta);
    if (isFinite(a.duration) && a.duration > 0) setDuration(a.duration);
    return () => { a.removeEventListener("loadedmetadata", onMeta); a.removeEventListener("durationchange", onMeta); };
  }, [url]);

  const [bars, setBars] = useState<number[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(url);
        const arrayBuffer = await res.arrayBuffer();
        if (cancelled) return;
        const ctx = new AudioContext();
        const decoded = await ctx.decodeAudioData(arrayBuffer);
        ctx.close();
        if (cancelled) return;
        const channelData: Float32Array[] = [];
        for (let c = 0; c < decoded.numberOfChannels; c++) channelData.push(decoded.getChannelData(c));
        const totalSamples = decoded.length;
        const samplesPerBar = Math.floor(totalSamples / BAR_COUNT_VM);
        const heights = Array.from({ length: BAR_COUNT_VM }, (_, i) => {
          const start = i * samplesPerBar;
          const end = Math.min(start + samplesPerBar, totalSamples);
          let sum = 0, count = 0;
          for (let s = start; s < end; s++) {
            let val = 0;
            for (const ch of channelData) val += ch[s];
            val /= channelData.length;
            sum += val * val;
            count++;
          }
          return count > 0 ? Math.sqrt(sum / count) : 0;
        });
        const maxRms = Math.max(...heights, 0.001);
        const normalized = heights.map(v => Math.round(2 + (v / maxRms) * 18));
        if (!cancelled) setBars(normalized);
      } catch {
        if (!cancelled) {
          const seed = url.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
          setBars(Array.from({ length: BAR_COUNT_VM }, (_, i) => {
            const h = Math.abs(Math.sin((seed + i * 137.5) * 0.1));
            return Math.round(2 + h * 18);
          }));
        }
      }
    })();
    return () => { cancelled = true; };
  }, [url]);

  const fmt = (s: number) => {
    if (!isFinite(s) || isNaN(s) || s <= 0) return "0:00";
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  };

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
      stopRaf();
    } else {
      a.play().then(() => { setPlaying(true); startRaf(); }).catch(() => {});
    }
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current;
    if (!a) return;
    const dur = isFinite(a.duration) && a.duration > 0 ? a.duration : duration;
    if (!dur) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    a.currentTime = ratio * dur;
    setCurrentTime(a.currentTime);
  };

  const cycleSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    const a = audioRef.current;
    const next: 1 | 1.5 | 2 = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
    setSpeed(next);
    if (a) a.playbackRate = next;
  };

  const liveTime = audioRef.current?.currentTime ?? currentTime;
  const liveDur = (audioRef.current && isFinite(audioRef.current.duration) && audioRef.current.duration > 0)
    ? audioRef.current.duration : duration;
  const progress = liveDur > 0 ? liveTime / liveDur : 0;
  const playedCount = Math.round(progress * BAR_COUNT_VM);

  return (
    <div className="flex items-center gap-2.5" style={{ minWidth: 220, maxWidth: 280 }}>
      <audio
        ref={audioRef}
        src={url}
        preload="auto"
        onLoadedMetadata={() => {
          const a = audioRef.current;
          if (a && isFinite(a.duration)) setDuration(a.duration);
        }}
        onEnded={() => { setPlaying(false); stopRaf(); setCurrentTime(0); }}
      />
      <button
        type="button"
        onClick={toggle}
        className="h-10 w-10 rounded-full text-white flex items-center justify-center shrink-0 transition-colors shadow-sm"
        style={{ backgroundColor: color }}
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing
          ? <Pause className="h-4 w-4 fill-white stroke-none" />
          : <Play className="h-4 w-4 fill-white stroke-none ml-0.5" />}
      </button>
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        <div
          className="flex items-center gap-[1px] cursor-pointer"
          style={{ height: 24 }}
          onClick={seek}
          title="Seek"
        >
          {bars === null
            ? Array.from({ length: BAR_COUNT_VM }, (_, i) => (
                <div key={i} className="shrink-0 animate-pulse" style={{ width: 2, height: 4, borderRadius: 1, backgroundColor: "rgba(160,160,160,0.25)" }} />
              ))
            : bars.map((h, i) => (
                <div
                  key={i}
                  className="shrink-0"
                  style={{
                    width: 2,
                    height: h,
                    borderRadius: 1,
                    backgroundColor: i < playedCount ? color : "rgba(160,160,160,0.35)",
                    transition: "background-color 60ms linear",
                  }}
                />
              ))
          }
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] opacity-60 tabular-nums">{fmt(liveTime)}</span>
          <button
            type="button"
            onClick={cycleSpeed}
            className="text-[10px] font-bold opacity-60 hover:opacity-90 tabular-nums"
          >
            {speed}×
          </button>
          <span className="text-[11px] opacity-60 tabular-nums">{fmt(liveDur)}</span>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ item }: { item: LeadDetailMessage }) {
  const outbound = String(item.direction || "").toLowerCase() === "outbound";
  const isVoiceNote = item.type === "voice_note";

  const VOICE_PREFIX = "[Voice Note]: ";
  const transcription = isVoiceNote
    ? (item.content?.startsWith(VOICE_PREFIX) ? item.content.slice(VOICE_PREFIX.length).trim() : item.content?.trim() ?? "")
    : null;
  const audioUrl =
    isVoiceNote && typeof item.attachment === "string" && item.attachment.startsWith("data:audio/")
      ? item.attachment
      : null;

  return (
    <div className={cn("flex", outbound ? "justify-end" : "justify-start")} data-testid={`row-chat-${item.id}`}>
      <div
        className={cn(
          "max-w-[80%] max-md:max-w-[92%] rounded-2xl px-3 py-2 text-sm border",
          outbound ? "bg-primary text-primary-foreground border-primary/20" : "bg-muted/40 text-foreground border-border",
        )}
        data-testid={`bubble-chat-${item.id}`}
      >
        {isVoiceNote ? (
          <div className="flex flex-col gap-2">
            {audioUrl ? (
              <VoiceMemoPlayer url={audioUrl} />
            ) : (
              <div className="flex items-center gap-1.5 opacity-70">
                <Mic className="h-3.5 w-3.5 shrink-0" />
                <span className="text-[11px] font-medium uppercase tracking-wide">Voice note</span>
              </div>
            )}
            {transcription ? (
              <div className="whitespace-pre-wrap leading-relaxed break-words text-[13px] italic opacity-80">
                {transcription}
              </div>
            ) : (
              <div className="text-[12px] opacity-50 italic">Transcription unavailable</div>
            )}
          </div>
        ) : (
          <div className="whitespace-pre-wrap leading-relaxed" data-testid={`text-chat-${item.id}`}>
            {item.content}
          </div>
        )}
        <div
          className={cn(
            "mt-1 text-[11px] opacity-80",
            outbound ? "text-primary-foreground/80" : "text-muted-foreground",
          )}
          data-testid={`meta-chat-${item.id}`}
        >
          {item.created_at ? new Date(item.created_at).toLocaleString() : "—"}{item.type ? ` • ${item.type}` : ""}
        </div>
      </div>
    </div>
  );
}

function ManualCompose({ disabled }: { disabled: boolean }) {
  const [value, setValue] = useState("");

  return (
    <div className="flex items-end gap-2" data-testid="form-manual-send">
      <div className="flex-1">
        <label className="text-xs text-muted-foreground" data-testid="label-manual-message">
          Manual send (mock)
        </label>
        <textarea
          className="mt-1 w-full min-h-[44px] max-h-40 rounded-xl bg-muted/30 border border-border p-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          placeholder={disabled ? "Select a lead first" : "Type a message…"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={disabled}
          data-testid="input-manual-message"
        />
      </div>
      <button
        type="button"
        className="h-11 px-4 rounded-xl bg-primary text-primary-foreground font-semibold disabled:opacity-50"
        disabled={disabled || value.trim().length === 0}
        onClick={() => setValue("")}
        data-testid="button-manual-send"
      >
        Send
      </button>
    </div>
  );
}
