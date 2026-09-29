import type { ReactNode } from "react";

/** iOS cellular bars: four rising bars, all filled. */
function SignalIcon() {
  return (
    <svg width="15" height="10" viewBox="0 0 17 11" fill="currentColor" aria-hidden="true">
      <rect x="0" y="7.5" width="3" height="3.5" rx="0.8" />
      <rect x="4.5" y="5" width="3" height="6" rx="0.8" />
      <rect x="9" y="2.5" width="3" height="8.5" rx="0.8" />
      <rect x="13.5" y="0" width="3" height="11" rx="0.8" />
    </svg>
  );
}

/** iOS Wi-Fi fan: three arcs over a dot. */
function WifiIcon() {
  return (
    <svg width="14" height="10" viewBox="0 0 16 11.5" fill="currentColor" aria-hidden="true">
      <path d="M8 2.3c2.2 0 4.2.85 5.7 2.25a.35.35 0 0 0 .5 0l1.05-1.07a.36.36 0 0 0 0-.5A10.3 10.3 0 0 0 8 0 10.3 10.3 0 0 0 .75 2.98a.36.36 0 0 0 0 .5L1.8 4.55a.35.35 0 0 0 .5 0A8.2 8.2 0 0 1 8 2.3Z" />
      <path d="M8 5.75c1.2 0 2.3.45 3.15 1.2a.35.35 0 0 0 .5 0l1.05-1.07a.36.36 0 0 0 0-.51A6.8 6.8 0 0 0 8 3.5a6.8 6.8 0 0 0-4.7 1.87.36.36 0 0 0 0 .51l1.05 1.07a.35.35 0 0 0 .5 0A4.6 4.6 0 0 1 8 5.75Z" />
      <path d="M10.1 8.35a.36.36 0 0 0 0-.52A3.2 3.2 0 0 0 8 7a3.2 3.2 0 0 0-2.1.83.36.36 0 0 0 0 .52l1.84 1.86a.36.36 0 0 0 .52 0l1.84-1.86Z" />
    </svg>
  );
}

/** iOS battery: outlined body, rounded fill, cap on the right. */
function BatteryIcon() {
  return (
    <svg width="22" height="10.5" viewBox="0 0 25 12" aria-hidden="true">
      <rect x="0.5" y="0.5" width="21" height="11" rx="3.2" fill="none" stroke="currentColor" strokeOpacity="0.4" />
      <rect x="2" y="2" width="15" height="8" rx="1.8" fill="currentColor" />
      <path d="M23 4v4c.8-.3 1.4-1.1 1.4-2S23.8 4.3 23 4Z" fill="currentColor" fillOpacity="0.45" />
    </svg>
  );
}

/**
 * A dark iPhone-style shell. The status bar floats over the screen, so each
 * app's own header (or wallpaper) runs up to the top edge behind the island,
 * the way a real iPhone draws it. Content that must clear it pads by 44px.
 * `light` is day mode: white screen, dark status glyphs and home bar.
 */
export function PhoneFrame({ time, children, className = "", light = false }: { time: string; children: ReactNode; className?: string; light?: boolean }) {
  return (
    <div className={`relative mx-auto flex h-[640px] w-[310px] flex-col overflow-hidden rounded-[46px] border-[6px] border-[#2a2b31] ${light ? "bg-white" : "bg-black"} shadow-[0_30px_70px_-25px_rgba(0,0,0,0.45)] ${className}`}>
      <div className={`pointer-events-none absolute inset-x-0 top-0 z-20 flex h-11 items-center justify-between pl-8 pr-6 text-[13px] font-semibold ${light ? "text-black" : "text-white"}`}>
        <span>{time}</span>
        <span className="absolute left-1/2 top-2 h-7 w-24 -translate-x-1/2 rounded-full bg-black" />
        <span className="flex items-center gap-[5px]">
          <SignalIcon />
          <WifiIcon />
          <BatteryIcon />
        </span>
      </div>
      <div className="relative flex min-h-0 flex-1 flex-col">{children}</div>
      <div className={`pointer-events-none absolute bottom-2 left-1/2 z-20 h-1 w-28 -translate-x-1/2 rounded-full ${light ? "bg-black/85" : "bg-white/80"}`} />
    </div>
  );
}
