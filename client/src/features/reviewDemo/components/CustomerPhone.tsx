import { useEffect, useRef, useState } from "react";
import { ArrowUp, ChevronLeft, Plus } from "lucide-react";
import type { ReviewCopy } from "../copy";
import type { DemoMessage, Skin } from "../types";
import { PhoneFrame } from "./PhoneFrame";
import { SmsBubble } from "./SmsBubble";
import { WhatsAppBubble } from "./WhatsAppBubble";
import { WaComposer, WaHeader, WaIntro, WaWallpaper } from "./WhatsAppChrome";
import { BusinessAvatar } from "./BusinessAvatar";

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
    <PhoneFrame time={time} light className={wa ? "" : "bg-gradient-to-b from-white via-white to-[#f2f2f5]"}>
      {wa ? (
        <WaHeader agent={agent} onToggleSkin={onToggleSkin} title={copy.channelWa} />
      ) : (
        <div className="flex shrink-0 flex-col items-center gap-1 border-b border-black/10 bg-[#f7f7f8]/90 px-3 pb-2 pt-11 backdrop-blur-md">
          <ChevronLeft className="absolute left-3 top-14 h-5 w-5 text-[#007aff]" />
          <BusinessAvatar className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-b from-[#a1a1aa] to-[#6b6b73] text-lg font-semibold text-white">{initial}</BusinessAvatar>
          <div className="text-[12px] font-medium text-black">{agent}</div>
          <button type="button" onClick={onToggleSkin} className="text-[10px] text-black/45">{copy.channelSms}</button>
        </div>
      )}

      <div className="relative flex min-h-0 flex-1 flex-col">
        {wa && <WaWallpaper />}
        <div ref={listRef} className="relative min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-3">
          {wa && <WaIntro copy={copy} />}
          {!wa && (
            <div className="mb-3 text-center text-[11px] text-black/45">
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
              <div className={`flex gap-1 px-3.5 py-3 ${wa ? "rounded-lg bg-white shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]" : "rounded-[20px] bg-[#e9e9eb]"}`}>
                {[0, 1, 2].map((d) => (
                  <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-black/35" style={{ animationDelay: `${d * 150}ms` }} />
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
          className={`relative flex shrink-0 items-center gap-2 pb-7 pt-2 ${wa ? "px-2" : "px-3"}`}
        >
          {wa ? (
            <WaComposer copy={copy} draft={draft} setDraft={setDraft} />
          ) : (
            <>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e9e9eb] text-black/55">
                <Plus className="h-4 w-4" />
              </span>
              {/* One pill holds the field and the send button, as iOS does. */}
              <div className="flex min-w-0 flex-1 items-center rounded-full bg-[#eeeef0] py-1 pl-3.5 pr-1">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={copy.placeholder}
                  className="min-w-0 flex-1 bg-transparent py-0.5 text-[14px] text-black outline-none placeholder:text-black/35"
                />
                <button
                  type="submit"
                  aria-label="Send"
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white ${draft.trim() ? "bg-[#34c759]" : "bg-[#c7c7cc]"}`}
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </PhoneFrame>
  );
}
