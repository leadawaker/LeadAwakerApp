// The weekly review of the account's phone calls (Voice tab, Prompt & test, Owner only):
// the stored reviews in a picker, the picked one as a report, and Run now for the last
// 7 days. A review takes minutes: the list polls while one runs, and when it finishes the
// change cards it proposed are loaded without a reload.
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, Loader2, Play } from "lucide-react";
import type { ReviewDto } from "@shared/voiceReview";
import { VoiceCardShell, helpStyle, inputStyle } from "../voiceAtoms";
import { reviewsKey, runReviewNow, suggestionsKey, useReviews } from "./coachApi";
import { ReviewReportView } from "./ReviewReportView";

// Review weeks run Monday to Sunday in Amsterdam (server/voice/review/weekWindow.ts).
const TZ = "Europe/Amsterdam";

export function ReviewCard({ accountId }: { accountId: number }) {
  const { t, i18n } = useTranslation("voiceCoach");
  const qc = useQueryClient();
  const reviews = useReviews(accountId);
  const list = reviews.data ?? [];
  // null follows the newest review (a run just started shows itself).
  const [pickedId, setPickedId] = useState<number | null>(null);
  const [starting, setStarting] = useState(false);
  const [notice, setNotice] = useState<{ text: string; bad: boolean } | null>(null);
  const running = list.some((r) => r.status === "running");
  const shown = list.find((r) => r.id === pickedId) ?? list[0] ?? null;

  const wasRunning = useRef(false);
  useEffect(() => {
    if (wasRunning.current && !running) void qc.invalidateQueries({ queryKey: suggestionsKey(accountId) });
    wasRunning.current = running;
  }, [running, accountId, qc]);

  const formats = useMemo(() => {
    // The day first in every language ("25 Oct"): plain "en" would put the month first.
    const locale = i18n.language.toLowerCase().startsWith("en") ? "en-GB" : i18n.language;
    return {
      day: new Intl.DateTimeFormat(locale, { day: "numeric", timeZone: TZ }),
      dayMonth: new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: TZ }),
      month: new Intl.DateTimeFormat("en", { month: "numeric", timeZone: TZ }),
    };
  }, [i18n.language]);

  /** "Week 43, 19 to 25 Oct" for a weekly review, "Last 7 days, run 26 Oct" for a manual one. */
  const label = (r: ReviewDto): string => {
    const text = (() => {
      if (r.kind === "manual") return t("review.manualLabel", { date: formats.dayMonth.format(new Date(r.startedAt)) });
      const start = new Date(r.periodStart);
      // periodEnd is the next Monday 00:00: twelve hours earlier is the week's Sunday.
      const last = new Date(Date.parse(r.periodEnd) - 12 * 3_600_000);
      const range = {
        from: formats.month.format(start) === formats.month.format(last) ? formats.day.format(start) : formats.dayMonth.format(start),
        to: formats.dayMonth.format(last),
      };
      const week = r.weekKey?.match(/W(\d+)$/)?.[1];
      return week ? t("review.weekLabel", { week: Number(week), ...range }) : t("review.rangeLabel", range);
    })();
    return r.status === "done" ? text : `${text} (${t(`review.status.${r.status}`)})`;
  };

  const runNow = async () => {
    setStarting(true);
    setNotice(null);
    try {
      const result = await runReviewNow(accountId);
      if (result.ok) setPickedId(null);
      else setNotice({ text: t(result.busy ? "review.busy" : "review.startFailed"), bad: !result.busy });
      // Wait for the list: the new row says "running" before the button is enabled again.
      await qc.invalidateQueries({ queryKey: reviewsKey(accountId) });
    } finally {
      setStarting(false);
    }
  };

  const busy = starting || running;
  const runButton = (
    <button type="button" className="la-btn la-btn--soft" style={{ minHeight: 36 }} disabled={busy} onClick={() => void runNow()} data-testid="voice-review-run">
      {busy ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}{t("review.runNow")}
    </button>
  );

  return (
    <VoiceCardShell card="promptReview" icon={<CalendarCheck size={17} />} title={t("review.title")} action={runButton}>
      <p style={helpStyle}>{t("review.help")}</p>
      {notice && <p role="status" style={{ ...helpStyle, color: notice.bad ? "var(--stage-lost)" : "var(--mute)" }} data-testid="voice-review-notice">{notice.text}</p>}
      {reviews.isLoading && (
        <div style={{ display: "flex", justifyContent: "center", padding: 24, color: "var(--mute)" }}><Loader2 className="h-5 w-5 animate-spin" /></div>
      )}
      {reviews.isError && !reviews.data && <p role="alert" style={{ ...helpStyle, color: "var(--stage-lost)" }}>{t("review.loadFailed")}</p>}
      {reviews.data && list.length === 0 && <p style={{ ...helpStyle, margin: 0 }} data-testid="voice-review-empty">{t("review.empty")}</p>}
      {shown && (
        <>
          <select
            value={shown.id}
            onChange={(e) => setPickedId(Number(e.target.value))}
            className="neu-inset-crisp"
            style={{ ...inputStyle, maxWidth: 420, minHeight: 36, marginBottom: 16 }}
            aria-label={t("review.picker")}
            data-testid="voice-review-picker"
          >
            {list.map((r) => <option key={r.id} value={r.id}>{label(r)}</option>)}
          </select>
          <ReviewReportView review={shown} />
        </>
      )}
    </VoiceCardShell>
  );
}
