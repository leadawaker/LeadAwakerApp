// Shared renderer for AI conversation summaries (lead-close + demo recap).
//
// The stored `ai_summary` text is dual-purpose: it is also sent verbatim to the
// prospect's WhatsApp by the demo recap, so it must stay plain text. This component
// keeps the text intact and only *renders* it richly — parsing it into sections and
// giving each one an icon, an accent label, and the answer below ("icon + accent rows").
//
// Handles three text shapes that land in `ai_summary`:
//   • labeled sections  → "Interest: …", "Pain points: …", "Sentiment: …", "Outcome: …"
//   • plain bullets      → "- you asked …", "- the AI answered …" (demo recap, no labels)
//   • plain prose        → a paragraph with no bullets/labels
//
// Presentational only: renders inner content, callers provide the card chrome/header.
// JSON-structured summaries are handled by the callers' own branches, not here.
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, AlertTriangle, BadgeCheck, Smile, Meh, Frown, Info, ArrowRight } from "lucide-react";

type Tone = "good" | "warn" | "neutral";
type Section = { label: string; body: string };
type ParseResult =
  | { mode: "sections"; sections: Section[] }
  | { mode: "bullets"; items: string[] }
  | { mode: "prose"; text: string };

// Split on newlines and bullet glyphs, then strip leading dash/asterisk bullets.
// Covers both "real newlines" and the "single block, bullets inline" cases.
function splitItems(text: string): string[] {
  return text
    .split(/\r?\n|•/)
    .map((s) => s.replace(/^\s*[-*–—]\s+/, "").trim())
    .filter(Boolean);
}

// Matches a short leading label like "Interest:" / "Pain points:" (≤30 chars, no
// sentence punctuation) followed by the answer. Unicode-aware for accented labels.
const LABEL_RE = /^([\p{L}][\p{L} /&'’-]{0,29}?)\s*[:：]\s+(\S.*)$/u;

export function parseSummary(raw: string | null | undefined): ParseResult {
  const text = (raw || "").trim();
  if (!text) return { mode: "prose", text: "" };

  const items = splitItems(text);
  const sections: Section[] = [];
  let labeled = 0;
  for (const item of items) {
    const m = item.match(LABEL_RE);
    if (m) {
      sections.push({ label: m[1].trim(), body: m[2].trim() });
      labeled++;
    } else if (sections.length > 0) {
      // continuation line → append to the current section's body
      sections[sections.length - 1].body += " " + item;
    } else {
      sections.push({ label: "", body: item });
    }
  }

  if (labeled >= 2) return { mode: "sections", sections };
  if (items.length >= 2) return { mode: "bullets", items };
  return { mode: "prose", text };
}

const TONE_COLOR: Record<Tone, string> = { good: "var(--good)", warn: "var(--warn)", neutral: "var(--mute)" };

function toneOf(body: string): Tone {
  const v = body.toLowerCase();
  if (/positief|positive|positivo|enthousiast|enthusiastic|coöperatief|cooperative|warm/.test(v)) return "good";
  if (/negatief|negative|negativo|frustr|boos|angry|sceptisch|skeptical|cold|koud/.test(v)) return "warn";
  return "neutral";
}

type Meta = { title: string; icon: ReactNode; accent: string; isOutcome: boolean };

// Resolve a parsed label to an icon + accent + localized title. Unknown / edited
// labels fall back to a neutral Info row with the verbatim label, so a customized
// prompt never breaks the layout or shows a raw key.
function metaFor(label: string, body: string, t: (k: string, o?: any) => string): Meta {
  const n = label.toLowerCase().trim();
  const ICON = "h-3.5 w-3.5";

  if (/^(interest|interesse)/.test(n))
    return { title: t("detail.summarySections.interest", { defaultValue: "Interest" }), icon: <Sparkles className={ICON} />, accent: "var(--wine)", isOutcome: false };
  if (/^(pain|pijn|dor)/.test(n))
    return { title: t("detail.summarySections.painPoints", { defaultValue: "Pain points" }), icon: <AlertTriangle className={ICON} />, accent: "var(--warn)", isOutcome: false };
  if (/^(qualif|kwalif)/.test(n))
    return { title: t("detail.summarySections.qualification", { defaultValue: "Qualification" }), icon: <BadgeCheck className={ICON} />, accent: "var(--ink)", isOutcome: false };
  if (/^sentiment/.test(n)) {
    const tone = toneOf(body);
    const ic = tone === "good" ? <Smile className={ICON} /> : tone === "warn" ? <Frown className={ICON} /> : <Meh className={ICON} />;
    return { title: t("detail.summarySections.sentiment", { defaultValue: "Sentiment" }), icon: ic, accent: TONE_COLOR[tone], isOutcome: false };
  }
  if (/^(outcome|uitkomst|resultaat|resultado)/.test(n))
    return { title: t("detail.summarySections.outcome", { defaultValue: "Outcome" }), icon: <ArrowRight className={ICON} />, accent: "var(--wine)", isOutcome: true };

  // Unknown / label-less
  return { title: label.trim(), icon: <Info className={ICON} />, accent: "var(--mute)", isOutcome: false };
}

function SectionRow({ meta, body }: { meta: Meta; body: string }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <span
        style={{
          width: 22, height: 22, borderRadius: 6, flexShrink: 0, marginTop: 1,
          background: "var(--wine-tint)", color: meta.accent,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        {meta.icon}
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        {meta.title && (
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: meta.accent, marginBottom: 3 }}>
            {meta.title}
          </div>
        )}
        <div style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--ink-soft)", textWrap: "pretty" }}>{body}</div>
      </div>
    </div>
  );
}

export function AiSummaryView({ text }: { text: string | null | undefined }) {
  const { t } = useTranslation("leads");
  const parsed = parseSummary(text);

  if (parsed.mode === "prose") {
    return <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "var(--ink-soft)", whiteSpace: "pre-wrap", textWrap: "pretty" }}>{parsed.text}</p>;
  }

  if (parsed.mode === "bullets") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {parsed.items.map((it, i) => (
          <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ width: 6, height: 6, borderRadius: 2, marginTop: 7, flexShrink: 0, background: "var(--wine)" }} />
            <span style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--ink-soft)", textWrap: "pretty" }}>{it}</span>
          </div>
        ))}
      </div>
    );
  }

  // sections — non-outcome rows first, the wine "Outcome" callout(s) last so the
  // conclusion pops at the bottom (mirrors LeadSummaryCard's nextStep box).
  const rows = parsed.sections.map((s) => ({ s, meta: metaFor(s.label, s.body, t) }));
  const ordered = [...rows.filter((r) => !r.meta.isOutcome), ...rows.filter((r) => r.meta.isOutcome)];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {ordered.map(({ s, meta }, i) =>
        meta.isOutcome ? (
          <div key={i} style={{ background: "var(--wine-tint)", borderRadius: "var(--r-surface)", padding: "13px 15px", display: "flex", gap: 11, alignItems: "flex-start" }}>
            <span style={{ color: "var(--wine)", display: "flex", marginTop: 1, flexShrink: 0 }}><ArrowRight className="h-[15px] w-[15px]" /></span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--wine)", marginBottom: 4 }}>{meta.title}</div>
              <div style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--ink-soft)" }}>{s.body}</div>
            </div>
          </div>
        ) : (
          <SectionRow key={i} meta={meta} body={s.body} />
        ),
      )}
    </div>
  );
}
