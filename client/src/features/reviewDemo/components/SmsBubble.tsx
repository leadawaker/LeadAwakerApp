import type { DemoMessage } from "../types";
import { MessageText } from "./MessageText";

/** iMessage look for an SMS thread: grey incoming, green outgoing. */
export function SmsBubble({ msg, tail, onOpenReview }: { msg: DemoMessage; tail: boolean; onOpenReview: () => void }) {
  const mine = msg.role === "visitor";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"} ${tail ? "mb-2" : "mb-[3px]"}`}>
      <div
        className={`max-w-[78%] px-3.5 py-2 text-[15px] leading-snug ${
          mine ? "bg-[#34c759] text-white" : "bg-[#26252a] text-white"
        } ${tail ? (mine ? "rounded-[20px] rounded-br-[6px]" : "rounded-[20px] rounded-bl-[6px]") : "rounded-[20px]"}`}
      >
        <MessageText text={msg.text} onOpenReview={onOpenReview} />
      </div>
    </div>
  );
}
