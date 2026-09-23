import { useEffect, useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import { CustomerPhone } from "@/features/reviewDemo/components/CustomerPhone";
import { ManagerPhone } from "@/features/reviewDemo/components/ManagerPhone";
import { ReviewPopup } from "@/features/reviewDemo/components/ReviewPopup";
import { copyFor } from "@/features/reviewDemo/copy";
import { useReviewDemo } from "@/features/reviewDemo/useReviewDemo";
import type { Skin } from "@/features/reviewDemo/types";

function useClock(locale: string) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);
  return {
    time: now.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" }).replace(/\s?[AP]M$/i, ""),
    date: now.toLocaleDateString(locale, { weekday: "long", month: "long", day: "numeric" }),
  };
}

const LOCALES: Record<string, string> = { en: "en-GB", nl: "nl-NL", pt: "pt-BR" };

export default function ReviewDemoPage() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const token = params.get("token") || "";
  const [skin, setSkin] = useState<Skin>(params.get("ch") === "wa" ? "wa" : "sms");
  const [popupOpen, setPopupOpen] = useState(false);
  const demo = useReviewDemo(token);
  const lang = demo.state?.language || "en";
  const copy = copyFor(lang);
  const clock = useClock(LOCALES[lang.slice(0, 2)] || "en-GB");
  const company = demo.state?.company || "";

  return (
    <div className="min-h-[100dvh] bg-[#07080b] px-4 py-10 text-white">
      <div className="mx-auto flex max-w-[860px] flex-col items-center gap-12 md:flex-row md:items-start md:justify-center">
        <section className="flex flex-col items-center">
          <CustomerPhone
            copy={copy}
            skin={skin}
            onToggleSkin={() => setSkin((s) => (s === "sms" ? "wa" : "sms"))}
            agent={demo.state?.agent || company}
            messages={demo.state?.messages ?? []}
            typing={demo.typing}
            onSend={demo.send}
            onOpenReview={() => setPopupOpen(true)}
            time={clock.time}
          />
          <div className="mt-5 text-center">
            <div className="text-[13px] font-semibold uppercase tracking-[0.12em]">{copy.customerTitle}</div>
            <div className="text-[12.5px] text-white/55">{copy.customerHint}</div>
          </div>
        </section>

        <section className="flex flex-col items-center">
          <ManagerPhone
            copy={copy}
            company={company}
            firstName={demo.state?.firstName || ""}
            events={demo.events}
            time={clock.time}
            dateLabel={clock.date}
          />
          <div className="mt-5 text-center">
            <div className="text-[13px] font-semibold uppercase tracking-[0.12em]">{copy.managerTitle}</div>
            <div className="text-[12.5px] text-white/55">{copy.managerHint(company)}</div>
          </div>
        </section>
      </div>

      {(demo.reviewPosted || demo.state?.done || demo.state?.reputation?.outcome) && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => void demo.replay()}
            disabled={demo.busy}
            className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-[14px] disabled:opacity-50"
          >
            <RotateCcw className="h-4 w-4" />
            {copy.replay}
          </button>
        </div>
      )}

      {demo.error && <div className="mt-6 text-center text-[13px] text-white/60">{token ? copy.offline : copy.expired}</div>}

      <ReviewPopup copy={copy} company={company} open={popupOpen} onClose={() => setPopupOpen(false)} onPost={demo.postReview} />
    </div>
  );
}
