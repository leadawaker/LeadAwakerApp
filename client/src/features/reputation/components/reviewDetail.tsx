import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { Review, TimelineStep } from "../types";
import { repRatingColor, repDelayLabel } from "../utils";
import {
  RIconRefresh, RIconStarF, RIconEdit, RIconSend,
  IconSpark, IconCheck,
  RepAvatar, RepStars, RepStatusPill, RepPlatformGlyph, RepLangBadge,
  RepCard, RepLabel,
} from "./atoms";

// ── AI Analysis sidebar (flat surface, sits right of the reply) ──
function RepAIAnalysis({ review }: { review: Review }) {
  const a: Partial<{ issues: string[]; reco: string }> = review.analysis ?? {};
  const r = review.rating;
  const positive = r >= 4;
  const sentiment = r <= 1 ? "Very negative" : r === 2 ? "Negative" : r === 3 ? "Mixed" : r === 4 ? "Positive" : "Very positive";
  const sColor = repRatingColor(r);
  const sTint = r <= 2 ? "var(--wine-tint)" : r === 3 ? "var(--warn-tint)" : "var(--good-tint)";
  const risk = r <= 1 ? "High" : r === 2 ? "Medium" : r === 3 ? "Low" : "None";
  const riskColor = r <= 1 ? "var(--wine)" : r === 2 ? "var(--warn)" : r === 3 ? "var(--mute)" : "var(--good)";
  const conf = review.confidence ?? 85;
  const issues = a.issues ?? [];
  const reco = a.reco ?? (review.tone ? review.tone[0].toUpperCase() + review.tone.slice(1) : "Professional");
  const Lbl = ({ children }: { children: React.ReactNode }) => (
    <span style={{ fontFamily: "var(--mono)", fontSize: 8, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--mute-2)" }}>{children}</span>
  );
  return (
    <div style={{ width: 230, flexShrink: 0, alignSelf: "flex-start", background: "var(--surface)", borderRadius: "var(--r-surface)", padding: "14px 15px", display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 20, height: 20, borderRadius: "var(--r-button)", background: "var(--wine-grad)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--paper)" }}><IconSpark size={11} /></span>
        <span style={{ fontFamily: "var(--mono)", fontSize: 9, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--ink-soft)" }}>AI analysis</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <Lbl>Sentiment</Lbl>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "4px 10px", borderRadius: "var(--r-pill)", background: sTint, alignSelf: "flex-start" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: sColor, flexShrink: 0 }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: sColor }}>{sentiment}</span>
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <Lbl>Confidence</Lbl>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{ flex: 1, height: 5, borderRadius: "var(--r-pill)", background: "var(--line)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${conf}%`, borderRadius: "var(--r-pill)", background: conf >= 75 ? "var(--good)" : conf >= 50 ? "var(--warn)" : "var(--wine)", transition: "width 500ms ease" }} />
          </div>
          <span style={{ fontFamily: "var(--mono)", fontSize: 10, fontWeight: 700, flexShrink: 0, color: conf >= 75 ? "var(--good)" : conf >= 50 ? "var(--warn)" : "var(--wine)" }}>{conf}%</span>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <Lbl>Risk level</Lbl>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: riskColor }}>{risk}</span>
      </div>

      {issues.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Lbl>{positive ? "Themes" : "Issues"}</Lbl>
          <ul style={{ margin: 0, padding: "0 0 0 15px", display: "flex", flexDirection: "column", gap: 5 }}>
            {issues.map((it, i) => (
              <li key={i} style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.45 }}>{it}</li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <Lbl>Recommended</Lbl>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: "var(--r-pill)", background: "var(--wine-tint)", color: "var(--wine)", fontSize: 12, fontWeight: 700, alignSelf: "flex-start" }}>
          <IconSpark size={10} />{reco}
        </span>
      </div>
    </div>
  );
}

// ── AI Composer (flat panel — draft in an inset card, actions inline) ─
function RepComposer({ review, busy, onPost, onSkip }: { review: Review; busy: boolean; onPost: (reviewId: string, text: string) => void; onSkip: (reviewId: string) => void }) {
  const { t } = useTranslation("accounts");
  const [text, setText] = useState(review.draft ?? "");
  const [focused, setFocused] = useState(false);

  // Reset on a new review, and pick the draft up when the engine finishes it.
  useEffect(() => {
    setText(review.draft ?? "");
  }, [review.id, review.draft]);

  const len = text.length;
  const lenHint = len < 180 ? "Good length" : len < 320 ? "A touch long" : "Consider trimming";

  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 13 }}>
      {/* flat label row — no wine-tint header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
          <span style={{ width: 22, height: 22, borderRadius: "var(--r-button)", background: "var(--wine-grad)", boxShadow: "var(--sh-raised-crisp)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--paper)" }}><IconSpark size={12} /></span>
          <span style={{ fontFamily: "var(--mono)", fontSize: 9.5, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--ink-soft)" }}>AI-drafted reply — review before posting</span>
        </span>
        <RepLangBadge lang={review.lang} />
      </div>

      {/* the draft itself — inset card */}
      <div style={{ position: "relative", borderRadius: "var(--r-surface)", overflow: "hidden", background: "var(--bg)", boxShadow: focused ? "var(--sh-inset-crisp), inset 0 0 0 1.5px var(--wine)" : "var(--sh-inset-crisp)", transition: "box-shadow 130ms" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "8px 13px 0" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontFamily: "var(--mono)", fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mute)" }}><RIconEdit size={11} />Editable draft</span>
          <span style={{ fontFamily: "var(--mono)", fontSize: 9.5, fontWeight: 700, letterSpacing: "0.04em", color: len < 320 ? "var(--mute-2)" : "var(--warn)" }}>{len} / 320</span>
        </div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} rows={5}
          placeholder={review.draft ? undefined : t("reviewResponse.drafting")}
          style={{ width: "100%", display: "block", border: "none", background: "transparent", outline: "none", resize: "none", fontFamily: "var(--sans)", fontSize: 13.5, lineHeight: 1.6, color: "var(--ink-soft)", padding: "10px 15px 13px" }} />
      </div>

      {/* skip on the left of the primary post action */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div style={{ flex: 1 }} />
        <button onClick={() => onSkip(review.id)} disabled={busy} className="la-btn" style={{ color: "var(--mute)", background: "transparent", boxShadow: "none", fontSize: 11 }}>{t("reviewResponse.skip")}</button>
        <button onClick={() => onPost(review.id, text)} disabled={busy || !text.trim()} className="la-btn la-btn--wine" style={{ opacity: busy || !text.trim() ? 0.5 : 1 }}><RIconSend size={13} />{t("reviewResponse.postReply")}</button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.06em", color: "var(--mute-2)", flexWrap: "wrap" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><RepPlatformGlyph size={12} /> Posts publicly to Google as the business · {lenHint}</span>
      </div>
    </div>
  );
}

// ── Timeline ─────────────────────────────────────────────────────
function RepTimeline({ timeline }: { timeline: TimelineStep[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {timeline.map((step, i) => {
        const last = i === timeline.length - 1;
        const color = step.done ? "var(--good)" : "var(--mute-2)";
        return (
          <div key={step.key} style={{ display: "flex", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <span style={{ width: 11, height: 11, borderRadius: "50%", flexShrink: 0, marginTop: 2, background: step.done ? color : "transparent", border: step.done ? "none" : "2px solid var(--line-strong)", boxShadow: step.done ? "0 0 0 3px var(--good-tint)" : "none" }} />
              {!last && <span style={{ width: 2, flex: 1, minHeight: 18, background: step.done ? "var(--good)" : "var(--line)", margin: "2px 0" }} />}
            </div>
            <div style={{ paddingBottom: last ? 0 : 12 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: step.done ? "var(--ink)" : "var(--mute-2)" }}>{step.label}</div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--mute-2)", letterSpacing: "0.06em", marginTop: 2 }}>
                {step.done
                  ? `${step.who && step.who !== "auto" ? step.who + " · " : step.who === "auto" ? "automatic · " : ""}${step.ago ? `${step.ago} ago` : "done"}`
                  : "pending"}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Status timeline card ─────────────────────────────────────────
function RepNoteAndStatus({ timeline }: { timeline: TimelineStep[] }) {
  return (
    <RepCard variant="raised" style={{ borderRadius: "var(--r-surface)" }}
      headLeft={<RepLabel>Status</RepLabel>}>
      <div style={{ padding: 14 }}>
        <RepTimeline timeline={timeline} />
      </div>
    </RepCard>
  );
}

export function RepReviewDetail({ review, autoPosted = false, autoDelay = "1h", busy = false, onPost, onSkip }: { review: Review | null; autoPosted?: boolean; autoDelay?: string; busy?: boolean; onPost: (reviewId: string, text: string) => void; onSkip: (reviewId: string) => void }) {
  if (!review) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, color: "var(--mute-2)" }}>
        <RIconStarF size={28} />
        <span style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase" }}>Select a review</span>
      </div>
    );
  }
  const replied = review.status === "replied";
  const displayTimeline = autoPosted
    ? review.timeline.map((s) => s.key === "posted" ? { ...s, done: true, who: "auto", ago: repDelayLabel(autoDelay) } : s)
    : review.timeline;

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* header */}
      <div style={{ flexShrink: 0, padding: "18px 22px 16px", borderBottom: "1px solid var(--line)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
          <RepAvatar ini={review.ini} rating={review.rating} size={46} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 7 }}>
              <span className="neu-raised" style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "var(--card)", borderRadius: "var(--r-surface)", padding: "7px 14px" }}>
                <span style={{ fontFamily: "var(--serif)", fontSize: 24, color: "var(--ink)", lineHeight: 1, whiteSpace: "nowrap" }}>{review.name}</span>
                <RepStars rating={review.rating} size={14} />
              </span>
              <RepStatusPill status={review.status} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--mute)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              <RepPlatformGlyph size={13} withLabel />
              <span style={{ color: "var(--line-strong)" }}>·</span>
              <span>{review.date}</span>
              <span style={{ color: "var(--line-strong)" }}>·</span>
              <span>{review.job}</span>
            </div>
          </div>
        </div>
      </div>

      {/* scroll body */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 22, display: "flex", flexDirection: "column", gap: 18 }}>
        <div className="neu-raised" style={{ borderRadius: "var(--r-surface)", background: "var(--card)", padding: "18px 20px", position: "relative" }}>
          <span style={{ position: "absolute", top: 8, left: 14, fontFamily: "var(--serif)", fontSize: 48, lineHeight: 1, color: "var(--line-strong)" }}>"</span>
          <p style={{ margin: 0, paddingLeft: 22, fontFamily: "var(--serif)", fontSize: 19, lineHeight: 1.5, color: "var(--ink-soft)", letterSpacing: "-0.01em" }}>{review.text}</p>
        </div>

        {replied && review.reply ? (
          <>
            <RepCard variant="raised" style={{ borderRadius: "var(--r-surface)" }}
              headLeft={<><span style={{ display: "flex", color: "var(--good)" }}><IconCheck size={14} /></span><RepLabel color="var(--good)">Posted reply</RepLabel></>}>
              <div style={{ padding: "16px 18px" }}>
                <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: "var(--ink-soft)" }}>{review.reply.text}</p>
                <div style={{ marginTop: 12, fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.08em", color: "var(--mute-2)", textTransform: "uppercase" }}>{review.reply.by ? `Posted by ${review.reply.by}` : "Posted"}{review.reply.ago ? ` · ${review.reply.ago} ago` : ""}</div>
              </div>
            </RepCard>
          </>
        ) : autoPosted ? (
          <>
            <div style={{ display: "inline-flex", alignSelf: "flex-start", alignItems: "center", gap: 9, background: "var(--wine-tint)", borderRadius: "var(--r-pill)", padding: "6px 13px" }}>
              <span style={{ display: "flex", color: "var(--wine)" }}><IconSpark size={13} /></span>
              <span style={{ fontFamily: "var(--mono)", fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--wine)" }}>Auto-posted by AI · {repDelayLabel(autoDelay)} after the review</span>
            </div>
            <RepCard variant="raised" style={{ borderRadius: "var(--r-surface)" }}
              headLeft={<><span style={{ display: "flex", color: "var(--wine)" }}><IconSpark size={14} /></span><RepLabel color="var(--wine)">Auto-posted reply</RepLabel></>}
              headRight={<span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--mono)", fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--good)" }}><span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--good)" }} />{review.confidence}% confident</span>}>
              <div style={{ padding: "16px 18px" }}>
                <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: "var(--ink-soft)" }}>{review.draft}</p>
                <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.06em", color: "var(--mute-2)" }}>
                  <RepPlatformGlyph size={12} /> Live on Google · posted automatically
                </div>
              </div>
            </RepCard>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="la-btn la-btn--wine"><RIconEdit size={13} />Edit &amp; repost</button>
              <button className="la-btn la-btn--soft"><RIconRefresh size={13} />Undo post</button>
            </div>
          </>
        ) : (
          <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
            <RepComposer review={review} busy={busy} onPost={onPost} onSkip={onSkip} />
            {review.analysis && <RepAIAnalysis review={review} />}
          </div>
        )}

        <RepNoteAndStatus timeline={displayTimeline} />
      </div>
    </div>
  );
}
