import type { DemoMessage } from "../types";
import { MessageText } from "./MessageText";

function hhmm(at: string | null): string {
  const d = at ? new Date(at) : new Date();
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** WhatsApp dark look: grey incoming, green outgoing, time and ticks inside the bubble. */
export function WhatsAppBubble({ msg, tail, onOpenReview }: { msg: DemoMessage; tail: boolean; onOpenReview: () => void }) {
  const mine = msg.role === "visitor";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"} ${tail ? "mb-2" : "mb-[2px]"}`}>
      <div
        className={`max-w-[80%] rounded-lg px-2.5 pb-1 pt-1.5 text-[14.5px] leading-snug text-[#e9edef] ${
          mine ? "bg-[#005c4b]" : "bg-[#202c33]"
        } ${tail ? (mine ? "rounded-tr-none" : "rounded-tl-none") : ""}`}
      >
        <MessageText text={msg.text} onOpenReview={onOpenReview} />
        <span className="float-right ml-2 mt-1.5 text-[10.5px] text-[#8696a0]">
          {hhmm(msg.at)}
          {mine && <span className="ml-1 text-[#53bdeb]">✓✓</span>}
        </span>
      </div>
    </div>
  );
}
