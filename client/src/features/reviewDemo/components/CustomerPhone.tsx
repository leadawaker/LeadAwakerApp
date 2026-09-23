import { useEffect, useRef, useState } from "react";
import { ArrowUp, ChevronLeft, Plus, SendHorizontal } from "lucide-react";
import type { ReviewCopy } from "../copy";
import type { DemoMessage, Skin } from "../types";
import { PhoneFrame } from "./PhoneFrame";
import { SmsBubble } from "./SmsBubble";
import { WhatsAppBubble } from "./WhatsAppBubble";

interface Props {
  copy: ReviewCopy;
  skin: Skin;
  onToggleSkin: () => void;
  agent: string;
  messages: DemoMessage[];
  typing: boolean;
  onSend: (text: string) => void;
  onOpenReview: () => void;
  time: string;
}

export function CustomerPhone({ copy, skin, onToggleSkin, agent, messages, typing, onSend, onOpenReview, time }: Props) {
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const wa = skin === "wa";

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, typing]);

  const submit = () => {
    if (!draft.trim()) return;
    onSend(draft);
    setDraft("");
  };

  const Bubble = wa ? WhatsAppBubble : SmsBubble;
  const initial = (agent || "?").trim().charAt(0).toUpperCase();

  return (
    <PhoneFrame time={time}>
      <div className={`flex shrink-0 items-center gap-2 border-b px-3 pb-2 ${wa ? "border-transparent bg-[#202c33]" : "flex-col border-white/10 bg-[#1c1c1e]/90"}`}>
        {wa ? (
          <>
            <ChevronLeft className="h-5 w-5 text-[#e9edef]" />
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#6b7c85] text-sm font-semibold text-white">{initial}</div>
            <div className="min-w-0">
              <div className="truncate text-[15px] font-medium text-[#e9edef]">{agent}</div>
              {/* The nearly invisible channel switch: tap the subtitle. */}
              <button type="button" onClick={onToggleSkin} className="text-[11px] text-[#8696a0]">{copy.channelWa}</button>
            </div>
          </>
        ) : (
          <>
            <ChevronLeft className="absolute left-3 top-14 h-5 w-5 text-[#0a84ff]" />
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-b from-[#a1a1aa] to-[#6b6b73] text-lg font-semibold text-white">{initial}</div>
            <div className="text-[12px] font-medium text-white">{agent}</div>
            <button type="button" onClick={onToggleSkin} className="text-[10px] text-white/45">{copy.channelSms}</button>
          </>
        )}
      </div>

      <div ref={listRef} className={`min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-3 ${wa ? "bg-[#0b141a]" : "bg-black"}`}>
        {!wa && (
          <div className="mb-3 text-center text-[11px] text-white/45">
            {copy.smsDivider}
            <br />
            {copy.today}
          </div>
        )}
        {messages.map((m, i) => (
          <Bubble key={m.id} msg={m} tail={messages[i + 1]?.role !== m.role} onOpenReview={onOpenReview} />
        ))}
        {typing && (
          <div className="flex justify-start">
            <div className={`flex gap-1 px-3.5 py-3 ${wa ? "rounded-lg bg-[#202c33]" : "rounded-[20px] bg-[#26252a]"}`}>
              {[0, 1, 2].map((d) => (
                <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-white/50" style={{ animationDelay: `${d * 150}ms` }} />
              ))}
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className={`flex shrink-0 items-center gap-2 px-3 pb-7 pt-2 ${wa ? "bg-[#0b141a]" : "bg-black"}`}
      >
        <span className={`flex h-8 w-8 items-center justify-center rounded-full ${wa ? "text-[#8696a0]" : "bg-[#26252a] text-white/70"}`}>
          <Plus className="h-4 w-4" />
        </span>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={wa ? "" : copy.placeholder}
          className={`min-w-0 flex-1 rounded-full px-3.5 py-1.5 text-[14px] text-white outline-none placeholder:text-white/35 ${
            wa ? "bg-[#202c33]" : "border border-white/15 bg-transparent"
          }`}
        />
        <button
          type="submit"
          aria-label="Send"
          className={`flex h-8 w-8 items-center justify-center rounded-full text-white ${wa ? "bg-[#00a884]" : draft.trim() ? "bg-[#34c759]" : "bg-[#3a3a3c]"}`}
        >
          {wa ? <SendHorizontal className="h-4 w-4" /> : <ArrowUp className="h-4 w-4" />}
        </button>
      </form>
    </PhoneFrame>
  );
}
