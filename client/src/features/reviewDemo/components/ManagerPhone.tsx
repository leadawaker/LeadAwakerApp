import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Lock, PhoneCall, Sparkles, Star } from "lucide-react";
import type { ReviewCopy } from "../copy";
import type { ManagerEvent } from "../types";
import { PhoneFrame } from "./PhoneFrame";

interface Props {
  copy: ReviewCopy;
  company: string;
  firstName: string;
  events: ManagerEvent[];
  time: string;
  dateLabel: string;
}

export function ManagerPhone({ copy, company, firstName, events, time, dateLabel }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  // Approving a draft swaps its banner for a green "approved" one in place.
  const [approvedIds, setApprovedIds] = useState<Set<string>>(() => new Set());
  const name = firstName || "Jamie";
  const open = events.find((e) => e.id === openId);
  const openDraft = open?.kind === "draft" ? open.draft : null;

  // Replay empties the events; the open sheet and approvals go with them.
  useEffect(() => {
    if (events.length === 0) {
      setOpenId(null);
      setApprovedIds(new Set());
    }
  }, [events.length]);

  const approve = () => {
    if (!openId) return;
    setApprovedIds((ids) => new Set(ids).add(openId));
    setOpenId(null);
  };

  return (
    <PhoneFrame time={time} className="bg-gradient-to-b from-[#26324a] via-[#1a2233] to-[#121826]">
      <div className="flex flex-1 flex-col items-center px-4 pt-[68px] text-white">
        <Lock className="h-4 w-4 text-white/80" />
        <div className="mt-1 text-[64px] font-semibold leading-none tracking-tight">{time}</div>
        <div className="mt-2 text-[15px] text-white/80">{dateLabel}</div>

        <div className="mt-6 w-full space-y-2">
          <AnimatePresence initial={false}>
            {events.map((ev) => {
              const approved = ev.kind === "draft" && approvedIds.has(ev.id);
              return (
                <motion.button
                  type="button"
                  key={approved ? `${ev.id}-approved` : ev.id}
                  initial={{ opacity: 0, y: -16, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 320, damping: 26 }}
                  onClick={() => ev.kind === "draft" && ev.draft && !approved && setOpenId(ev.id)}
                  className="w-full rounded-2xl bg-white/15 p-3 text-left backdrop-blur-md"
                >
                  <div className="mb-1 flex items-center gap-1.5 text-[10.5px] uppercase tracking-wide text-white/60">
                    <span className={`flex h-4 w-4 items-center justify-center rounded ${approved ? "bg-[#34c759] text-white" : ev.kind === "draft" ? "bg-[#4285f4] text-white" : "bg-[#f5b301] text-black"}`}>
                      {approved ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : ev.kind === "alert" ? <PhoneCall className="h-2.5 w-2.5" /> : ev.kind === "review" ? <Star className="h-2.5 w-2.5" /> : <Sparkles className="h-2.5 w-2.5" />}
                    </span>
                    <span className="flex-1">{ev.kind === "alert" ? company : copy.reviewApp}</span>
                    <span className="normal-case">{copy.now}</span>
                  </div>
                  <div className="text-[13.5px] font-semibold">
                    {ev.kind === "alert" && copy.alertTitle(name, ev.stars)}
                    {ev.kind === "review" && copy.reviewTitle(name, ev.stars)}
                    {ev.kind === "draft" && (approved ? copy.approved : copy.draftTitle)}
                  </div>
                  <div className="line-clamp-2 text-[12.5px] text-white/80">
                    {ev.kind === "alert" && `"${ev.quote}"`}
                    {ev.kind === "review" && (ev.text || "★".repeat(ev.stars))}
                    {ev.kind === "draft" && (approved ? `"${ev.draft}"` : ev.draft === null ? copy.draftLoading : ev.draft === "" ? copy.draftFailed : copy.draftTap)}
                  </div>
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>

        {events.length === 0 && (
          <div className="mt-auto mb-24 flex items-center gap-2 text-[12px] text-white/70">
            <span className="h-1.5 w-1.5 rounded-full bg-[#34c759]" />
            {copy.silent}
          </div>
        )}
        <div className="mb-8 mt-auto text-[11px] text-white/60">{copy.managerLabel(company)}</div>
      </div>

      <AnimatePresence>
        {openDraft && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="absolute inset-x-0 bottom-0 z-30 rounded-t-3xl bg-[#1c1c1e] p-4 pb-8 text-white"
          >
            <div className="mb-2 text-[13px] font-semibold">{copy.draftTitle}</div>
            <p className="mb-4 whitespace-pre-wrap text-[13px] text-white/85">{openDraft}</p>
            <div className="flex gap-2">
              <button type="button" onClick={approve} className="flex-1 rounded-full bg-[#0a84ff] py-2 text-[13px] font-semibold">{copy.approve}</button>
              <button type="button" onClick={() => setOpenId(null)} className="flex-1 rounded-full bg-white/10 py-2 text-[13px]">{copy.edit}</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </PhoneFrame>
  );
}
