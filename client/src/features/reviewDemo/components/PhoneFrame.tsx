import type { ReactNode } from "react";

/** A dark iPhone-style shell with status bar. Page-local mockup styling. */
export function PhoneFrame({ time, children, className = "" }: { time: string; children: ReactNode; className?: string }) {
  return (
    <div className={`relative mx-auto flex h-[640px] w-[310px] flex-col overflow-hidden rounded-[46px] border-[6px] border-[#2a2b31] bg-black shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)] ${className}`}>
      <div className="relative z-20 flex h-11 shrink-0 items-center justify-between px-7 text-[13px] font-semibold text-white">
        <span>{time}</span>
        <span className="absolute left-1/2 top-2 h-7 w-24 -translate-x-1/2 rounded-full bg-black" />
        <span className="flex items-center gap-1 text-[11px]">
          <span className="tracking-tighter">▂▄▆</span>
          <span className="inline-block h-[10px] w-[20px] rounded-[3px] border border-white/70 p-[1px]">
            <span className="block h-full w-3/4 rounded-[1px] bg-white" />
          </span>
        </span>
      </div>
      <div className="relative flex min-h-0 flex-1 flex-col">{children}</div>
      <div className="absolute bottom-2 left-1/2 z-20 h-1 w-28 -translate-x-1/2 rounded-full bg-white/80" />
    </div>
  );
}
