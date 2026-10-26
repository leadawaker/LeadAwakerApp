// The call review of the account's phone calls (Voice tab, Prompt & test, Owner only), folded
// to its title: the stored reviews in a picker, the picked one as a report, and a run over a
// picked period (Amsterdam days, both included; up to MAX_RANGE_DAYS). Runs are only started
// by hand. A review takes minutes: the list polls while one runs, and when it finishes the
// change cards it proposed are loaded without a reload.
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, Loader2, Play } from "lucide-react";
import type { ReviewDto } from "@shared/voiceReview";
import { Switch } from "@/components/ui/switch";
import { helpStyle, inputStyle } from "../voiceAtoms";
import { reviewsKey, runReviewNow, suggestionsKey, useReviews } from "./coachApi";
import { Fold } from "./Fold";
import { ReviewReportView } from "./ReviewReportView";

const TZ = "Europe/Amsterdam";
/** Mirrors MAX_RANGE_DAYS in server/voice/review/weekWindow.ts. */
const MAX_RANGE_DAYS = 92;
const DEFAULT_DAYS = 7;
const DAY_MS = 86_400_000;

/** Today in Amsterdam as YYYY-MM-DD ("en-CA" writes dates that way). */
const todayIso = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
const shiftIso = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS) + 1;

function DateField({ label, value, min, max, onChange, testId }: {
  label: string; value: string; min?: string; max?: string; onChange: (v: string) => void; testId: string;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "var(--mute)", minWidth: 0 }}>
      {label}
      <input
        type="date" value={value} min={min} max={max} onChange={(e) => onChange(e.target.value)}
        className="neu-inset-crisp" style={{ ...inputStyle, minHeight: 36, width: 160 }} data-testid={testId}
      />
    </label>
  );
}

export function ReviewCard({ accountId }: { accountId: number }) {
  const { t, i18n } = useTranslation("voiceCoach");
  const qc = useQueryClient();
  const reviews = useReviews(accountId);
  const list = reviews.data ?? [];
  // null follows the newest review (a run just started shows itself).
  const [pickedId, setPickedId] = useState<number | null>(null);
  const [starting, setStarting] = useState(false);
  const [notice, setNotice] = useState<{ text: string; bad: boolean } | null>(null);
  const today = todayIso();
  const [from, setFrom] = useState(() => shiftIso(today, 1 - DEFAULT_DAYS));
  const [to, setTo] = useState(today);
  const [withTests, setWithTests] = useState(false);
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

  /** "19 to 25 Oct" (a weekly review adds its week). The period's end is exclusive: its last moment is the last day. */
  const label = (r: ReviewDto): string => {
    const start = new Date(r.periodStart);
    const last = new Date(Date.parse(r.periodEnd) - 1);
    const sameDay = formats.dayMonth.format(start) === formats.dayMonth.format(last);
    const range = {
      from: formats.month.format(start) === formats.month.format(last) ? formats.day.format(start) : formats.dayMonth.format(start),
      to: formats.dayMonth.format(last),
    };
    const week = r.kind === "weekly" ? r.weekKey?.match(/W(\d+)$/)?.[1] : undefined;
    const text = week ? t("review.weekLabel", { week: Number(week), ...range })
      : sameDay ? range.to : t("review.rangeLabel", range);
    const tagged = r.stats?.withTests ? `${text}, ${t("review.withTestsTag")}` : text;
    return r.status === "done" ? tagged : `${tagged} (${t(`review.status.${r.status}`)})`;
  };

  const span = daysBetween(from, to);
  const rangeError = !from || !to ? "invalid" : span < 1 ? "order" : span > MAX_RANGE_DAYS ? "too_long" : null;

  const run = async () => {
    if (rangeError) return;
    setStarting(true);
    setNotice(null);
    try {
      const result = await runReviewNow(accountId, { from, to, withTests });
      if (result.ok) setPickedId(null);
      else setNotice({ text: t(result.busy ? "review.busy" : result.badRange ? "review.range.invalid" : "review.startFailed"), bad: !result.busy });
      // Wait for the list: the new row says "running" before the button is enabled again.
      await qc.invalidateQueries({ queryKey: reviewsKey(accountId) });
    } finally {
      setStarting(false);
    }
  };

  const busy = starting || running;
  const latest = list[0];
  const note = running ? t("review.status.running")
    : latest ? `${label(latest)}${latest.stats ? `, ${t("review.callCount", { count: latest.stats.calls })}` : ""}` : undefined;

  return (
    <Fold title={t("review.title")} note={note} icon={<CalendarCheck size={15} />} rememberAs={`review-${accountId}`} testId="voice-review">
      <p style={helpStyle}>{t("review.help")}</p>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 10, marginBottom: 12 }}>
        <DateField label={t("review.range.from")} value={from} max={today} onChange={setFrom} testId="voice-review-from" />
        <DateField label={t("review.range.to")} value={to} min={from} max={today} onChange={setTo} testId="voice-review-to" />
        <button type="button" className="la-btn la-btn--soft" style={{ minHeight: 36 }} disabled={busy || rangeError != null} onClick={() => void run()} data-testid="voice-review-run">
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}{t("review.run")}
        </button>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 36, marginBottom: 8, fontSize: 13, color: "var(--ink-soft)", cursor: "pointer" }}>
        <Switch checked={withTests} onCheckedChange={setWithTests} data-testid="voice-review-with-tests" />
        {t("review.range.withTests")}
      </label>
      {rangeError && rangeError !== "invalid" && (
        <p role="alert" style={{ ...helpStyle, color: "var(--stage-lost)" }} data-testid="voice-review-range-error">{t(`review.range.${rangeError}`, { max: MAX_RANGE_DAYS })}</p>
      )}
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
    </Fold>
  );
}
