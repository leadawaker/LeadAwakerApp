import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Star, X } from "lucide-react";
import type { ReviewCopy } from "../copy";

interface Props {
  copy: ReviewCopy;
  company: string;
  open: boolean;
  onClose: () => void;
  onPost: (stars: number, text: string) => void;
}

/** Mockup of Google's review dialog. Nothing leaves the page. */
export function ReviewPopup({ copy, company, open, onClose, onPost }: Props) {
  const [stars, setStars] = useState(5);
  const [text, setText] = useState("");

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.94, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.94, y: 12 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[380px] rounded-3xl bg-white p-6 text-center text-[#202124] shadow-2xl"
          >
            <button type="button" onClick={onClose} aria-label="Close" className="absolute right-4 top-4 rounded-full bg-[#f1f3f4] p-1.5 text-[#5f6368]">
              <X className="h-4 w-4" />
            </button>
            <div className="text-[26px] font-medium tracking-tight">
              <span className="text-[#4285f4]">G</span><span className="text-[#ea4335]">o</span><span className="text-[#fbbc05]">o</span>
              <span className="text-[#4285f4]">g</span><span className="text-[#34a853]">l</span><span className="text-[#ea4335]">e</span>
            </div>
            <div className="mt-1 text-[18px] font-semibold">{company}</div>
            <div className="mt-1 text-[14px] text-[#5f6368]">{copy.popupQuestion}</div>
            <div className="my-4 flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button type="button" key={n} onClick={() => setStars(n)} aria-label={`${n}`}>
                  <Star className={`h-8 w-8 ${n <= stars ? "fill-[#fbbc05] text-[#fbbc05]" : "text-[#dadce0]"}`} />
                </button>
              ))}
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={copy.popupPlaceholder}
              rows={3}
              className="w-full resize-none rounded-xl border border-[#1a73e8] p-3 text-[14px] outline-none"
            />
            <button
              type="button"
              onClick={() => {
                onPost(stars, text);
                onClose();
              }}
              className="mt-4 w-full rounded-full bg-[#1a73e8] py-3 text-[15px] font-semibold text-white"
            >
              {copy.popupPost}
            </button>
            <div className="mt-2 text-[11.5px] text-[#80868b]">{copy.popupDisclaimer}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
