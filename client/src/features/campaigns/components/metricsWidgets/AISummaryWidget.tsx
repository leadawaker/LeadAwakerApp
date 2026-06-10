import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, RefreshCw } from "lucide-react";

// ── AISummaryWidget — flat "AI Read" strip (display only) ─────────────────────
// Sits at the top of the Summary tab, under the header. No card chrome, no
// generate button — the line is produced by the nightly summary / endpoint.

function stripMarkdown(text: string): string {
  let cleaned = text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/^#+ /gm, "")
    .replace(/^[-_]{3,}$/gm, "")
    .replace(/"/g, "")
    .replace(/\s*\n+\s*/g, " ")
    .trim();

  // Remove the campaign name / performance header (e.g., "Campaign Performance Summary: Premium Kitchen Demo The Premium Kitchen Demo campaign")
  cleaned = cleaned.replace(/^.*?campaign\s+/i, "").trim();

  // Remove financial data (amounts like $1850.0 or similar)
  cleaned = cleaned.replace(/\$[\d,]+\.?\d*/g, "").trim();

  // Extract the first 2 sentences only
  const sentences = cleaned.split(/(?<=[.!?])\s+/);
  return sentences.slice(0, 2).join(" ").trim();
}

export function AISummaryWidget({ summary, generatedAt, onRefresh, isRefreshing }: {
  summary: string | null;
  generatedAt: string | null;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}) {
  const { t } = useTranslation("campaigns");

  const formattedAt = useMemo(() => {
    if (!generatedAt) return null;
    try {
      return new Date(generatedAt).toLocaleString(undefined, { day: "2-digit", month: "short" });
    } catch { return null; }
  }, [generatedAt]);

  const cleaned = useMemo(() => summary ? stripMarkdown(summary) : "", [summary]);

  return (
    <div className="row" style={{ gap: 16, alignItems: "flex-start", padding: "0 4px" }}>
      <div
        style={{
          width: 32, height: 32, borderRadius: "var(--r-surface)", background: "var(--wine-grad)",
          color: "var(--paper)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2,
        }}
      >
        <Sparkles className="h-4 w-4" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="eyebrow eyebrow-sm wine" style={{ marginBottom: 4, display: "flex", alignItems: "center", gap: 6, justifyContent: "space-between" }}>
          <span>{t("summary.eyebrows.aiRead")}{formattedAt ? ` · ${formattedAt}` : ""}</span>
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              title="Refresh AI summary"
              style={{
                background: "none", border: "none", cursor: isRefreshing ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", color: "var(--mute)", opacity: isRefreshing ? 0.5 : 0.7,
                transition: "opacity 200ms", padding: 0, marginRight: -4,
              }}
              onMouseEnter={(e) => { if (!isRefreshing) e.currentTarget.style.opacity = "1"; }}
              onMouseLeave={(e) => { if (!isRefreshing) e.currentTarget.style.opacity = "0.7"; }}
            >
              <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
        <div
          style={{
            fontSize: 13, color: cleaned ? "var(--ink-soft)" : "var(--mute)", lineHeight: 1.55,
            fontFamily: "var(--sans)", fontWeight: 400,
          }}
        >
          {cleaned || t("summary.noAiAnalysis")}
        </div>
      </div>
    </div>
  );
}
