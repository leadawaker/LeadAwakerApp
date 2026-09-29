import { ArrowLeft, Camera, Mic, MoreVertical, Paperclip, Phone, SendHorizontal } from "lucide-react";
import type { ReviewCopy } from "../copy";
import { BusinessAvatar } from "./BusinessAvatar";

/*
 * WhatsApp (Android, light theme) around the chat: header, the date chip, the
 * doodle wallpaper and the composer. Only send and the hidden channel switch
 * work; the other icons are decoration.
 */

const ICON = "#54656f";

/** WhatsApp's emoji button: a smiley with its top-right corner folded like a sticker. */
function StickerSmiley() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={ICON} strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
      <path d="M21 12a9 9 0 1 1-9-9" />
      <path d="M12 3c0 5 4 9 9 9" />
      <circle cx="8.6" cy="11" r="0.6" fill={ICON} />
      <circle cx="12.4" cy="11" r="0.6" fill={ICON} />
      <path d="M8 15c1.2 1.4 3.6 1.6 5.2.5" />
    </svg>
  );
}

export function WaHeader({ agent, onToggleSkin, title }: { agent: string; onToggleSkin: () => void; title: string }) {
  const initial = (agent || "?").trim().charAt(0).toUpperCase();
  return (
    <div className="flex shrink-0 items-center gap-2 bg-white px-2 pb-2 pt-12 text-[#111b21] shadow-[0_1px_2px_rgba(11,20,26,0.08)]">
      <ArrowLeft className="h-5 w-5 shrink-0" />
      <BusinessAvatar className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#8a9ba5] text-[15px] font-semibold text-white">{initial}</BusinessAvatar>
      {/* The nearly invisible channel switch: tap the name. */}
      <button type="button" onClick={onToggleSkin} title={title} className="min-w-0 flex-1 truncate text-left text-[16px]">
        {agent}
      </button>
      <span className="flex shrink-0 items-center">
        <Phone className="h-[18px] w-[18px]" />
        <svg width="8" height="5" viewBox="0 0 8 5" className="ml-1" aria-hidden="true">
          <path d="M0 0h8L4 5z" fill="currentColor" />
        </svg>
      </span>
      <MoreVertical className="ml-2 h-5 w-5 shrink-0" />
    </div>
  );
}

/** The date chip every WhatsApp chat opens with. */
export function WaIntro({ copy }: { copy: ReviewCopy }) {
  return (
    <div className="mb-2 flex justify-center">
      <span className="rounded-md bg-white px-2 py-0.5 text-[11px] text-[#54656f] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]">{copy.today}</span>
    </div>
  );
}

/** The beige wallpaper with faint doodles (pattern 35 from /patterns). */
export function WaWallpaper() {
  return (
    <div className="pointer-events-none absolute inset-0 bg-[#efeae2]">
      <div
        className="absolute inset-0 bg-[#ddd3c4]"
        style={{
          maskImage: "url(/patterns/pattern-35.svg)",
          WebkitMaskImage: "url(/patterns/pattern-35.svg)",
          maskRepeat: "repeat",
          WebkitMaskRepeat: "repeat",
          maskSize: "300px auto",
          WebkitMaskSize: "300px auto",
        }}
      />
    </div>
  );
}

interface ComposerProps {
  copy: ReviewCopy;
  draft: string;
  setDraft: (v: string) => void;
}

/** White pill (sticker, field, clip, camera) beside the round green mic, which turns into send once there is text. */
export function WaComposer({ copy, draft, setDraft }: ComposerProps) {
  const typing = draft.trim().length > 0;
  return (
    <div className="flex w-full items-end gap-1.5">
      <div className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full bg-white pl-3 pr-3.5 shadow-[0_1px_1px_rgba(11,20,26,0.1)]">
        <StickerSmiley />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={copy.waPlaceholder}
          className="min-w-0 flex-1 bg-transparent text-[15px] text-[#111b21] caret-[#1daa61] outline-none placeholder:text-[#8696a0]"
        />
        <Paperclip className="h-5 w-5 shrink-0 -rotate-45" color={ICON} />
        {!typing && <Camera className="h-5 w-5 shrink-0" color={ICON} />}
      </div>
      <button type="submit" aria-label="Send" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#1daa61] text-white">
        {typing ? <SendHorizontal className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
      </button>
    </div>
  );
}
