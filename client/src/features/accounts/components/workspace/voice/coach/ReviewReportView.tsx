// One stored review of the account's phone calls (Voice tab, Prompt & test): the summary,
// the figures, what changed since last time, the problems and worst calls (each with the
// calls that show it) and the knowledge base notes. Running and failed reviews say so.
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import type { ReviewDto, ReviewStats } from "@shared/voiceReview";
import { helpStyle } from "../voiceAtoms";
import { CallChip } from "./CallChip";
import { Fold } from "./Fold";

const LABEL_STYLE: React.CSSProperties = {
  fontFamily: "var(--mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--mute)",
};
const ROW_STYLE: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" };
const TEXT_STYLE: React.CSSProperties = { margin: 0, fontSize: 13, lineHeight: 1.5, color: "var(--ink-soft)", overflowWrap: "anywhere" };

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="neu-inset-crisp" style={{ padding: "8px 12px", borderRadius: "var(--r-button)", minWidth: 84 }}>
      <div style={{ fontFamily: "var(--mono)", fontSize: 14, color: "var(--ink)" }}>{value}</div>
      <div style={{ ...LABEL_STYLE, fontSize: 9.5, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function Figures({ stats }: { stats: ReviewStats }) {
  const { t, i18n } = useTranslation("voiceCoach");
  const num = (v: number, options?: Intl.NumberFormatOptions) => v.toLocaleString(i18n.language, options);
  const seconds = (ms: number | null) => (ms == null ? "-" : t("review.seconds", { value: num(ms / 1000, { maximumFractionDigits: 1, minimumFractionDigits: 1 }) }));
  const booked = stats.byOutcome.booked ?? 0;
  return (
    <div style={{ ...ROW_STYLE, gap: 8 }} data-testid="voice-review-figures">
      <Figure label={t("review.figures.calls")} value={num(stats.calls)} />
      <Figure label={t("review.figures.booked")} value={stats.calls > 0 ? num(booked / stats.calls, { style: "percent", maximumFractionDigits: 0 }) : "-"} />
      <Figure label={t("review.figures.reply")} value={seconds(stats.latencyAvgMs)} />
      <Figure label={t("review.figures.p90")} value={seconds(stats.latencyP90Ms)} />
      <Figure label={t("review.figures.cost")} value={num(stats.costUsd, { style: "currency", currency: "USD" })} />
      <Figure label={t("review.figures.minutes")} value={num(stats.minutes, { maximumFractionDigits: 1 })} />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={LABEL_STYLE}>{title}</div>
      {children}
    </div>
  );
}

export function ReviewReportView({ review }: { review: ReviewDto }) {
  const { t } = useTranslation("voiceCoach");

  if (review.status === "running") {
    return (
      <p role="status" style={{ ...helpStyle, margin: 0, display: "flex", alignItems: "center", gap: 8 }} data-testid="voice-review-running">
        <Loader2 size={14} className="animate-spin" style={{ flexShrink: 0 }} />{t("review.running")}
      </p>
    );
  }
  if (review.status === "failed") {
    return (
      <p role="alert" style={{ ...helpStyle, margin: 0, color: "var(--stage-lost)" }} data-testid="voice-review-failed">
        {/* "stalled": the run was cut off (the server restarted, or it ran too long). */}
        {!review.error ? t("review.failedUnknown") : review.error === "stalled" ? t("review.stalled") : t("review.failed", { error: review.error })}
      </p>
    );
  }

  const { report, stats } = review;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }} data-testid="voice-review-report">
      {report?.summary && <p style={{ ...TEXT_STYLE, fontSize: 14, color: "var(--ink)" }}>{report.summary}</p>}
      {stats && <Figures stats={stats} />}
      {report?.comparison && <p style={{ ...TEXT_STYLE, color: "var(--mute)" }} data-testid="voice-review-comparison">{report.comparison}</p>}

      {!!report?.problems.length && (
        <Section title={t("review.problems")}>
          {report.problems.map((p, i) => (
            <Fold key={i} size="item" title={p.title} testId="voice-review-problem">
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <p style={TEXT_STYLE}>{p.detail}</p>
                {p.callIds.length > 0 && <div style={ROW_STYLE}>{p.callIds.map((id) => <CallChip key={id} accountId={review.accountId} callId={id} />)}</div>}
              </div>
            </Fold>
          ))}
        </Section>
      )}

      {!!report?.worstCalls.length && (
        <Section title={t("review.worstCalls")}>
          {report.worstCalls.map((c) => (
            <div key={c.callId} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }} data-testid="voice-review-worst">
              <CallChip accountId={review.accountId} callId={c.callId} />
              <span style={{ ...TEXT_STYLE, flex: "1 1 220px", minWidth: 0 }}>{c.why}</span>
            </div>
          ))}
        </Section>
      )}

      {!!report?.knowledgeBase.length && (
        <Section title={t("review.knowledgeBase")}>
          <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
            {report.knowledgeBase.map((note, i) => <li key={i} style={TEXT_STYLE}>{note}</li>)}
          </ul>
        </Section>
      )}

      {!!report && report.droppedProposals > 0 && (
        <p style={{ ...TEXT_STYLE, color: "var(--mute)" }} data-testid="voice-review-dropped">{t("review.dropped", { count: report.droppedProposals })}</p>
      )}
    </div>
  );
}
