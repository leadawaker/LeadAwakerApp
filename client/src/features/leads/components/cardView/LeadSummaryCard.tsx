// AI Summary card — design-system styled, glassmorphic.
// Extracted from LeadDetailView.tsx to keep that file focused.
//
// NOTE FOR THE AI PROMPT: the conversation-summary prompt should emit `ai_summary`
// as a JSON object string with keys: { outcome, sentiment, headline, keyPoints:
// [{ text, tone }], nextStep } (tone ∈ good|warn|neutral). When present, the UI
// segments it (pills + serif headline + key-points list + wine "Outcome" box).
// Plain (non-JSON) strings still render as raw text.
import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";
import { CardLabel, HEAD_H } from "./designPrimitives";
import { AiSummaryView } from "@/components/crm/AiSummaryView";
import { resolveLang } from "@shared/langField";

export function LeadSummaryCard({ lead, tier, status, hideHeader, sidePad = 16 }: { lead: Record<string, any>; tier?: string | null; status?: string; hideHeader?: boolean; sidePad?: number }) {
  const { t, i18n } = useTranslation("leads");
  const uiLang: "en" | "nl" = (i18n.language || "en").toLowerCase().startsWith("nl") ? "nl" : "en";
  const aiSummary = lead?.ai_summary || lead?.aiSummary || "";
  const memoryStr = lead?.ai_memory || lead?.aiMemory || "";
  let parsedText = "";
  if (!aiSummary && memoryStr) {
    try {
      const obj = typeof memoryStr === "string" ? JSON.parse(memoryStr) : memoryStr;
      parsedText = obj?.summary || obj?.notes || obj?.description || "";
    } catch { parsedText = ""; }
  }

  // Try to parse the AI summary as structured JSON for segmented rendering.
  type StructPoint = { text: string; tone?: string };
  type StructSummary = { outcome?: string; sentiment?: string; headline?: string; keyPoints?: StructPoint[]; nextStep?: string };
  let structured: StructSummary | null = null;
  if (aiSummary && typeof aiSummary === "string") {
    try {
      const obj = JSON.parse(aiSummary);
      if (obj && typeof obj === "object" && (obj.headline || obj.keyPoints || obj.outcome)) structured = obj as StructSummary;
    } catch { structured = null; }
  } else if (aiSummary && typeof aiSummary === "object") {
    structured = aiSummary as StructSummary;
  }

  // Non-structured summaries may be a multilingual { en, nl } field (discovery
  // demo, one body per platform language) or plain text — resolve to the UI
  // language for display. `hasSummary` drives the locked state independently so
  // structured (old-schema) summaries don't get treated as empty.
  const hasSummary = Boolean(aiSummary || parsedText);
  const summaryText = resolveLang(aiSummary, uiLang) || parsedText;

  const toneColor: Record<string, string> = { good: "var(--good)", warn: "var(--warn)", neutral: "var(--mute)" };
  const header = (
    <div style={{ height: HEAD_H, flexShrink: 0, padding: "0 16px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ color: "var(--wine)", display: "flex" }}><Sparkles className="h-3.5 w-3.5" /></span>
      <CardLabel color="var(--wine)">{t("detail.aiSummary", "AI Summary")}</CardLabel>
    </div>
  );

  // Locked until a summary exists (generated when the conversation ends — whether
  // the lead booked or was lost). Quiet/light empty state, no surface.
  const locked = !hasSummary;

  // Locked: NO glass-strong background — transparent, with the chat empty-state block near the top.
  if (locked) {
    return (
      <div style={{ flex: 1, minWidth: 0, width: "100%", height: "100%", borderRadius: "var(--r-card)", overflow: "hidden", display: "flex", flexDirection: "column", minHeight: 0 }}>
        {!hideHeader && header}
        <div style={{ flex: 1, overflowY: "auto", padding: `16px ${sidePad}px`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="flex flex-col items-center gap-2 text-center">
            <Sparkles className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">
              {t("detail.summaryLocked", "Summary will be generated once the conversation ends")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={hideHeader ? "" : "glass-strong"} style={{ flex: 1, minWidth: 0, width: "100%", height: "100%", borderRadius: "var(--r-card)", overflow: "hidden", display: "flex", flexDirection: "column", minHeight: 0 }}>
      {!hideHeader && header}
      <div style={{ flex: 1, overflowY: "auto", padding: `16px ${sidePad}px 20px`, display: "flex", flexDirection: "column", gap: 16 }}>
        {structured ? (
          <>
            {/* (a) outcome / sentiment pills */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {structured.outcome && <span style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", padding: "4px 10px", borderRadius: "var(--r-pill)", color: "var(--paper)", background: "var(--wine-grad)" }}>{structured.outcome}</span>}
              {structured.sentiment && <span style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", padding: "4px 10px", borderRadius: "var(--r-pill)", color: "var(--mute)", background: "var(--bg)", boxShadow: "var(--sh-inset-super-crisp)" }}>{structured.sentiment}</span>}
            </div>
            {/* (b) serif headline */}
            {structured.headline && <p className="serif" style={{ margin: 0, fontSize: 19, lineHeight: 1.4, color: "var(--ink)", letterSpacing: "-0.01em", textWrap: "pretty" }}>{structured.headline}</p>}
            {/* (c) key points */}
            {Array.isArray(structured.keyPoints) && structured.keyPoints.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div className="eyebrow eyebrow-sm">{t("detail.keyPoints", "Key points")}</div>
                {structured.keyPoints.map((p, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <span style={{ width: 7, height: 7, borderRadius: 2, marginTop: 6, flexShrink: 0, background: toneColor[p.tone || "neutral"] || "var(--mute)" }} />
                    <span style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--ink-soft)", textWrap: "pretty" }}>{p.text}</span>
                  </div>
                ))}
              </div>
            )}
            {/* (d) Outcome box (wine-tinted, reused from design's "recommended next step") */}
            {structured.nextStep && (
              <div style={{ background: "var(--wine-tint)", borderRadius: "var(--r-surface)", padding: "13px 15px", display: "flex", gap: 11, alignItems: "flex-start" }}>
                <span style={{ color: "var(--wine)", display: "flex", marginTop: 1, flexShrink: 0 }}><Sparkles className="h-[15px] w-[15px]" /></span>
                <div>
                  <div className="eyebrow eyebrow-sm wine" style={{ marginBottom: 4 }}>{t("detail.outcome", "Outcome")}</div>
                  <div style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--ink-soft)" }}>{structured.nextStep}</div>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Plain-text fallback (current behavior) */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {status && <span style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", padding: "4px 10px", borderRadius: "var(--r-pill)", color: "var(--paper)", background: "var(--wine-grad)" }}>{status}</span>}
              {tier && <span style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", padding: "4px 10px", borderRadius: "var(--r-pill)", color: "var(--mute)", background: "var(--bg)", boxShadow: "var(--sh-inset-super-crisp)" }}>{tier}</span>}
            </div>
            <AiSummaryView text={summaryText} />
          </>
        )}
      </div>
    </div>
  );
}
