// Mini chat message components extracted from LeadsCardView.tsx

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Check,
  CheckCheck,
  Clock,
  Play,
  Pause,
  Mic,
  X,
  Tag as TagIcon,
  CircleDot,
  Send,
  MessageSquare,
  Users,
  Star,
  Calendar,
  AlertTriangle,
  Ban,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EntityAvatar } from "@/components/ui/entity-avatar";
import type { Interaction } from "@/types/models";
import { useSession, type SessionUser } from "@/hooks/useSession";
import { PIPELINE_HEX } from "@/lib/avatarUtils";
import {
  AI_TRIGGERED_BY,
  MINI_THREAD_GAP_MS,
  MINI_TAG_HEX,
  MINI_CONVERSION_STATUS_TAGS,
  MINI_STAGE_ICON,
} from "./constants";
import type { MiniSenderKey, MiniMsgMeta, MiniThreadGroup } from "./types";
import { formatBubbleTime } from "./formatUtils";

// ── Helper functions ──────────────────────────────────────────────────────────

export function isAiMsg(item: Interaction): boolean {
  if ((item.ai_generated ?? item.aiGenerated) === true) return true;
  if ((item.is_bump ?? item.isBump) === true) return true;
  const triggeredBy = (item.triggered_by ?? item.triggeredBy ?? "").toLowerCase();
  if (AI_TRIGGERED_BY.has(triggeredBy)) return true;
  const who = (item.Who ?? item.who ?? "").toLowerCase();
  if (who === "ai" || who === "bot" || who === "automation") return true;
  if (/^bump\s*\d/.test(who)) return true;
  if (who === "start") return true;
  return false;
}

export function isHumanAgentMsg(item: Interaction): boolean {
  if (String(item.direction || "").toLowerCase() !== "outbound") return false;
  return !isAiMsg(item);
}

export function computeMiniMsgMeta(msgs: Interaction[]): MiniMsgMeta[] {
  const result: MiniMsgMeta[] = [];
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i];
    const sk: MiniSenderKey = String(m.direction || "").toLowerCase() !== "outbound"
      ? "inbound"
      : isAiMsg(m) ? "ai" : "human";
    const prevSk: MiniSenderKey | "" = i > 0
      ? (String(msgs[i - 1].direction || "").toLowerCase() !== "outbound" ? "inbound" : isAiMsg(msgs[i - 1]) ? "ai" : "human")
      : "";
    const nextSk: MiniSenderKey | "" = i < msgs.length - 1
      ? (String(msgs[i + 1].direction || "").toLowerCase() !== "outbound" ? "inbound" : isAiMsg(msgs[i + 1]) ? "ai" : "human")
      : "";
    result.push({
      senderKey: sk,
      isFirstInRun: sk !== prevSk,
      isLastInRun: sk !== nextSk,
    });
  }
  return result;
}

export function groupMiniMessagesByThread(msgs: Interaction[]): MiniThreadGroup[] {
  if (msgs.length === 0) return [];
  const groups: MiniThreadGroup[] = [];
  let currentGroup: MiniThreadGroup | null = null;
  let groupIndex = 0;

  function getThreadKey(m: Interaction): string | null {
    const tid = m.conversation_thread_id ?? m.conversationThreadId;
    if (tid) return `thread-${tid}`;
    if (m.bump_number != null) return `bump-${m.bump_number}`;
    if (m.is_bump && m.Who) return `bump-who-${m.Who.toLowerCase().replace(/\s+/g, "-")}`;
    return null;
  }

  let lastTimestamp: number | null = null;
  for (const m of msgs) {
    const key = getThreadKey(m);
    const ts = m.created_at || m.createdAt;
    const currentTimestamp = ts ? new Date(ts).getTime() : null;
    let startNew = false;
    if (!currentGroup) {
      startNew = true;
    } else if (key !== null) {
      if (key !== currentGroup.threadId) startNew = true;
    } else {
      if (currentTimestamp !== null && lastTimestamp !== null && currentTimestamp - lastTimestamp > MINI_THREAD_GAP_MS) startNew = true;
    }
    if (startNew) {
      const tid: string = key ?? `session-${groupIndex}`;
      currentGroup = { threadId: tid, threadIndex: groupIndex++, msgs: [] };
      groups.push(currentGroup);
    }
    currentGroup!.msgs.push(m);
    if (currentTimestamp !== null) lastTimestamp = currentTimestamp;
  }
  return groups;
}

export function formatMiniThreadLabel(group: MiniThreadGroup, total: number): string {
  const { threadId, threadIndex } = group;
  if (threadId.startsWith("bump-who-")) {
    const who = threadId.replace("bump-who-", "").replace(/-/g, " ");
    return who.charAt(0).toUpperCase() + who.slice(1);
  }
  if (threadId.startsWith("bump-")) return `Bump ${threadId.replace("bump-", "")}`;
  if (threadId.startsWith("thread-")) {
    const id = threadId.replace("thread-", "");
    return id.length > 12 ? `Thread ${threadIndex + 1}` : `Thread ${id}`;
  }
  if (total === 1) return "Conversation";
  return `Conversation ${threadIndex + 1}`;
}

// ── Mini date separator (matches ChatPanel DateSeparator) ─────────────────────

export function MiniDateSeparator({ label }: { label: string }) {
  return (
    <div className="flex justify-center py-3">
      <span className="text-[11px] font-medium text-foreground/50 bg-black/[0.06] rounded-full px-3 py-0.5 select-none">
        {label}
      </span>
    </div>
  );
}

// ── Mini thread divider (matches ChatPanel ThreadDivider) ─────────────────────

export function MiniThreadDivider({ group, total }: { group: MiniThreadGroup; total: number }) {
  const label = formatMiniThreadLabel(group, total);
  const firstMsg = group.msgs[0];
  const ts = firstMsg?.created_at || firstMsg?.createdAt;
  const time = ts ? formatBubbleTime(ts) : null;
  const isBump = group.threadId.startsWith("bump-");
  return (
    <div className="flex justify-center my-3">
      <span className={cn(
        "text-[11px] font-semibold rounded-full px-3 py-1 select-none",
        isBump ? "bg-amber-100 text-amber-700" : "bg-indigo-50 text-brand-indigo",
      )}>
        {label}{time ? ` · ${time}` : ""}
      </span>
    </div>
  );
}

// ── Mini avatars (matching ChatPanel, scaled to 32px) ─────────────────────────

export function MiniAgentAvatar({ currentUser }: { currentUser: SessionUser | null }) {
  const displayName = currentUser?.fullName || "You";
  const photoUrl = currentUser?.avatarUrl ?? null;
  return (
    <EntityAvatar
      name={displayName}
      photoUrl={photoUrl}
      bgColor="#4F46E5"
      textColor="#ffffff"
      size={32}
      className="shrink-0"
    />
  );
}

export function MiniBotAvatar() {
  return (
    <div className="h-8 w-8 shrink-0">
      <img src="/6. Favicon.svg" alt="AI" className="h-full w-full object-contain" />
    </div>
  );
}

// ── Run wrappers with sticky bottom avatars (matching ChatPanel) ──────────────

export function MiniLeadRunWrapper({ msgs, metas, leadName, leadAvatarColors, isAgency }: {
  msgs: Interaction[];
  metas: MiniMsgMeta[];
  leadName: string;
  leadAvatarColors: { bgColor: string; textColor: string };
  isAgency?: boolean;
}) {
  return (
    <div className="flex justify-start gap-1">
      <div className="w-8 shrink-0 self-end sticky bottom-0">
        <EntityAvatar
          name={leadName || "?"}
          bgColor={leadAvatarColors.bgColor}
          textColor={leadAvatarColors.textColor}
          size={32}
        />
      </div>
      <div className="flex flex-col min-w-0 flex-1">
        {msgs.map((m, i) => (
          <MiniChatBubble key={m.id ?? i} item={m} meta={metas[i]} leadName={leadName} leadAvatarColors={leadAvatarColors} isAgency={isAgency} suppressAvatar />
        ))}
      </div>
    </div>
  );
}

export function MiniAgentRunWrapper({ msgs, metas, leadName, leadAvatarColors, currentUser, isAgency }: {
  msgs: Interaction[];
  metas: MiniMsgMeta[];
  leadName: string;
  leadAvatarColors: { bgColor: string; textColor: string };
  currentUser: SessionUser | null;
  isAgency?: boolean;
}) {
  return (
    <div className="flex justify-end gap-1">
      <div className="flex flex-col min-w-0 flex-1">
        {msgs.map((m, i) => (
          <MiniChatBubble key={m.id ?? i} item={m} meta={metas[i]} leadName={leadName} leadAvatarColors={leadAvatarColors} isAgency={isAgency} suppressAvatar />
        ))}
      </div>
      <div className="w-8 shrink-0 self-end sticky bottom-0">
        <MiniAgentAvatar currentUser={currentUser} />
      </div>
    </div>
  );
}

export function MiniBotRunWrapper({ msgs, metas, leadName, leadAvatarColors, isAgency }: {
  msgs: Interaction[];
  metas: MiniMsgMeta[];
  leadName: string;
  leadAvatarColors: { bgColor: string; textColor: string };
  isAgency?: boolean;
}) {
  return (
    <div className="flex justify-end gap-1">
      <div className="flex flex-col min-w-0 flex-1">
        {msgs.map((m, i) => (
          <MiniChatBubble key={m.id ?? i} item={m} meta={metas[i]} leadName={leadName} leadAvatarColors={leadAvatarColors} isAgency={isAgency} suppressAvatar />
        ))}
      </div>
      <div className="w-8 shrink-0 self-end sticky bottom-0">
        <MiniBotAvatar />
      </div>
    </div>
  );
}

// ── Mini delivery status icon (matches ChatPanel MessageStatusIcon) ────────────

export function MiniStatusIcon({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s === "sending") return <span className="inline-flex items-center"><Clock className="w-2.5 h-2.5 animate-pulse opacity-70" /></span>;
  if (s === "read") return <span className="inline-flex items-center text-sky-300"><CheckCheck className="w-2.5 h-2.5" /></span>;
  if (s === "delivered") return <span className="inline-flex items-center opacity-80"><CheckCheck className="w-2.5 h-2.5" /></span>;
  if (s === "sent") return <span className="inline-flex items-center opacity-60"><Check className="w-2.5 h-2.5" /></span>;
  return null;
}

// ── Mini voice memo player ────────────────────────────────────────────────────

const MINI_VM_BARS = 40;

export function MiniVoiceMemoPlayer({ url, color = "#0ABFA3" }: { url: string; color?: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
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
        const samplesPerBar = Math.floor(decoded.length / MINI_VM_BARS);
        const heights = Array.from({ length: MINI_VM_BARS }, (_, i) => {
          const start = i * samplesPerBar;
          const end = Math.min(start + samplesPerBar, decoded.length);
          let sum = 0, count = 0;
          for (let s = start; s < end; s++) {
            let val = 0;
            for (const ch of channelData) val += ch[s];
            val /= channelData.length;
            sum += val * val; count++;
          }
          return count > 0 ? Math.sqrt(sum / count) : 0;
        });
        const maxRms = Math.max(...heights, 0.001);
        if (!cancelled) setBars(heights.map(v => Math.round(2 + (v / maxRms) * 16)));
      } catch {
        if (!cancelled) {
          const seed = url.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
          setBars(Array.from({ length: MINI_VM_BARS }, (_, i) => Math.round(2 + Math.abs(Math.sin((seed + i * 137.5) * 0.1)) * 16)));
        }
      }
    })();
    return () => { cancelled = true; };
  }, [url]);

  const fmt = (s: number) => (!isFinite(s) || isNaN(s) || s <= 0) ? "0:00" : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); stopRaf(); }
    else { a.play().then(() => { setPlaying(true); startRaf(); }).catch(() => {}); }
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current;
    if (!a) return;
    const dur = isFinite(a.duration) && a.duration > 0 ? a.duration : duration;
    if (!dur) return;
    const rect = e.currentTarget.getBoundingClientRect();
    a.currentTime = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * dur;
    setCurrentTime(a.currentTime);
  };

  const liveTime = audioRef.current?.currentTime ?? currentTime;
  const liveDur = (audioRef.current && isFinite(audioRef.current.duration) && audioRef.current.duration > 0) ? audioRef.current.duration : duration;
  const playedCount = Math.round((liveDur > 0 ? liveTime / liveDur : 0) * MINI_VM_BARS);

  return (
    <div className="flex items-center gap-2" style={{ minWidth: 180, maxWidth: 240 }}>
      <audio ref={audioRef} src={url} preload="auto"
        onLoadedMetadata={() => { const a = audioRef.current; if (a && isFinite(a.duration)) setDuration(a.duration); }}
        onEnded={() => { setPlaying(false); stopRaf(); setCurrentTime(0); }}
      />
      <button type="button" onClick={toggle}
        className="h-8 w-8 rounded-full text-white flex items-center justify-center shrink-0 shadow-sm"
        style={{ backgroundColor: color }} aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? <Pause className="h-3.5 w-3.5 fill-white stroke-none" /> : <Play className="h-3.5 w-3.5 fill-white stroke-none ml-0.5" />}
      </button>
      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
        <div className="flex items-center gap-[1px] cursor-pointer" style={{ height: 20 }} onClick={seek}>
          {bars === null
            ? Array.from({ length: MINI_VM_BARS }, (_, i) => <div key={i} className="shrink-0 animate-pulse" style={{ width: 2, height: 3, borderRadius: 1, backgroundColor: "rgba(160,160,160,0.25)" }} />)
            : bars.map((h, i) => <div key={i} className="shrink-0" style={{ width: 2, height: h, borderRadius: 1, backgroundColor: i < playedCount ? color : "rgba(160,160,160,0.35)", transition: "background-color 60ms linear" }} />)
          }
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] opacity-60 tabular-nums">{fmt(liveTime)}</span>
          <span className="text-[10px] opacity-60 tabular-nums">{fmt(liveDur)}</span>
        </div>
      </div>
    </div>
  );
}

// ── Tag / status event chips (inline chat timeline) ───────────────────────────

export function MiniTagEventChip({ tagName, tagColor, time, eventType }: { tagName: string; tagColor: string; time: string; eventType?: "added" | "removed" }) {
  const isRemoved = eventType === "removed";
  const iconColor = MINI_TAG_HEX[tagColor] ?? "#6B7280";
  return (
    <div className="flex justify-center py-3">
      <span className={cn("inline-flex items-center gap-1.5 text-[12px] font-medium rounded-full px-3 py-1 select-none bg-white dark:bg-card text-foreground", isRemoved && "opacity-50")}>
        {isRemoved
          ? <X className="w-3 h-3" style={{ color: iconColor }} />
          : <TagIcon className="w-3 h-3" style={{ color: iconColor }} />
        }
        <span className={cn(isRemoved && "line-through")}>{tagName}</span>
        <span className="opacity-60">&middot;</span>
        <span className="opacity-60">{time}</span>
      </span>
    </div>
  );
}

export function MiniStatusEventChip({ statusName, time }: { statusName: string; time: string }) {
  const StatusIcon = MINI_STAGE_ICON[statusName] ?? CircleDot;
  const hex = PIPELINE_HEX[statusName] ?? "#6B7280";
  return (
    <div className="flex justify-center py-3">
      <span className="inline-flex items-center gap-1.5 text-[12px] font-medium rounded-full px-3 py-1 select-none bg-white dark:bg-card text-foreground">
        <StatusIcon className="w-3.5 h-3.5" style={{ color: hex }} />
        {statusName}
        <span className="opacity-50">&middot;</span>
        <span className="opacity-50">{time}</span>
      </span>
    </div>
  );
}

// ── Chat bubble (matches ChatPanel — 45% width, time-only, suppressAvatar) ────

export function MiniChatBubble({ item, meta, leadName, leadAvatarColors, suppressAvatar = false, isAgency = false }: {
  item: Interaction;
  meta: MiniMsgMeta;
  leadName: string;
  leadAvatarColors: { bgColor: string; textColor: string };
  suppressAvatar?: boolean;
  isAgency?: boolean;
}) {
  const outbound = String(item.direction || "").toLowerCase() === "outbound";
  const inbound = !outbound;
  const aiMsg = outbound && isAiMsg(item);
  const humanAgentMsg = outbound && isHumanAgentMsg(item);
  const rawTs = item.created_at ?? item.createdAt ?? null;
  const time = formatBubbleTime(rawTs);
  const statusNorm = ((item as any).status ?? "").toLowerCase();
  const { isLastInRun } = meta;

  // AI cost tooltip (agency-only)
  const aiTokens = aiMsg && isAgency
    ? (Number(item.ai_prompt_tokens ?? (item as any).aiPromptTokens ?? 0) + Number(item.ai_completion_tokens ?? (item as any).aiCompletionTokens ?? 0))
    : 0;
  const aiCostVal = aiMsg && isAgency
    ? Number(item.ai_cost ?? (item as any).aiCost ?? 0)
    : 0;
  const aiCostTitle = aiTokens > 0
    ? `${aiTokens.toLocaleString()} tokens, $${aiCostVal.toFixed(4)}`
    : undefined;

  const bubbleRadius = inbound
    ? isLastInRun ? "rounded-sm rounded-bl-none" : "rounded-sm"
    : isLastInRun ? "rounded-sm rounded-br-none" : "rounded-sm";

  return (
    <div
      className={cn("flex items-end gap-1 my-0.5", outbound ? "justify-end" : "justify-start")}
      data-testid={`row-interaction-${item.id}`}
    >
      {/* Lead avatar — left side (only when NOT suppressed by wrapper) */}
      {inbound && !suppressAvatar && isLastInRun && (
        <EntityAvatar name={leadName || "?"} bgColor={leadAvatarColors.bgColor} textColor={leadAvatarColors.textColor} size={32} className="shrink-0" />
      )}
      {inbound && !suppressAvatar && !isLastInRun && <div className="w-8 shrink-0" />}

      {/* Bubble — 45% max-width, time-only, ChatPanel colors + hard-light outline */}
      <div
        {...(aiCostTitle ? { "data-cost-tooltip": aiCostTitle } : {})}
        className={cn(
          "max-w-[80%] px-2.5 pt-1.5 pb-1 text-[13px] relative",
          bubbleRadius,
          inbound && "bg-white dark:bg-card text-gray-900 dark:text-foreground",
          aiMsg && "bg-[#f2f5ff] dark:bg-[#1e2340] text-gray-900 dark:text-foreground",
          humanAgentMsg && "bg-[#f1fff5] dark:bg-[#1a2e1f] text-gray-900 dark:text-foreground",
        )}
      >
        {/* Light drop shadow */}
        <div
          className={cn("absolute inset-0 pointer-events-none", bubbleRadius)}
          style={{
            boxShadow: (inbound || aiMsg || humanAgentMsg)
              ? "0 2px 2px rgba(0,0,0,0.08)"
              : "none",
          }}
        />
        {((item as any).type === "voice_note" || (item as any).Type === "voice_note") ? (() => {
          const content = item.content || (item as any).Content || "";
          const VOICE_PREFIX = "[Voice Note]: ";
          const transcription = content.startsWith(VOICE_PREFIX) ? content.slice(VOICE_PREFIX.length).trim() : content.trim();
          const attachRaw = item.attachment ?? (item as any).Attachment;
          const audioUrl = typeof attachRaw === "string" && attachRaw.startsWith("data:audio/") ? attachRaw : null;
          return (
            <div className="flex flex-col gap-1.5">
              {audioUrl
                ? <MiniVoiceMemoPlayer url={audioUrl} />
                : <div className="flex items-center gap-1.5 opacity-70"><Mic className="h-3.5 w-3.5 shrink-0" /><span className="text-[11px] font-medium uppercase tracking-wide">Voice note</span></div>
              }
              {transcription && <div className="whitespace-pre-wrap leading-relaxed break-words text-[12px] italic opacity-80">{transcription}</div>}
            </div>
          );
        })() : (
          <div className="whitespace-pre-wrap leading-relaxed break-words">{item.content || (item as any).Content || ""}</div>
        )}
        <div className="flex items-center justify-end gap-1 mt-0.5">
          <span className="text-[10px] leading-none select-none" style={{ color: "#888" }}>
            {time || (rawTs ? rawTs.toString().slice(11, 16) : "")}
          </span>
          {outbound && <MiniStatusIcon status={statusNorm} />}
        </div>
      </div>

      {/* Outbound avatars — right side (only when NOT suppressed by wrapper) */}
      {aiMsg && !suppressAvatar && isLastInRun && <MiniBotAvatar />}
      {aiMsg && !suppressAvatar && !isLastInRun && <div className="w-8 shrink-0" />}
      {humanAgentMsg && !suppressAvatar && isLastInRun && <MiniAgentAvatar currentUser={null} />}
      {humanAgentMsg && !suppressAvatar && !isLastInRun && <div className="w-8 shrink-0" />}
    </div>
  );
}
