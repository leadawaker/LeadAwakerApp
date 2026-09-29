import { CheckCheck } from "lucide-react";
import type { DemoMessage } from "../types";
import { MessageText } from "./MessageText";

function hhmm(at: string | null): string {
  const d = at ? new Date(at) : new Date();
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** WhatsApp light look: grey incoming, green outgoing, time and ticks inside the bubble. */
export function WhatsAppBubble({ msg, tail, onOpenReview }: { msg: DemoMessage; tail: boolean; onOpenReview: () => void }) {
  const mine = msg.role === "visitor";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"} ${tail ? "mb-2" : "mb-[2px]"}`}>
      <div
        className={`max-w-[80%] rounded-[10px] px-2.5 pb-1 pt-1.5 text-[14.5px] leading-snug text-[#111b21] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] ${
          mine ? "bg-[#d9fdd3]" : "bg-white"
        } ${tail ? (mine ? "rounded-tr-none" : "rounded-tl-none") : ""}`}
      >
        <MessageText text={msg.text} onOpenReview={onOpenReview} />
        <span className="float-right ml-2 mt-1.5 text-[10.5px] text-[#667781]">
          {hhmm(msg.at)}
          {mine && <CheckCheck className="ml-1 inline h-3.5 w-3.5 align-[-3px] text-[#667781]" />}
        </span>
      </div>
    </div>
  );
}
