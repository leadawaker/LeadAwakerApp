import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";
import { renderRichText } from "@/lib/richTextUtils";

// ── AISummaryWidget — flat one-line "AI Read" strip (display only) ─────────────
// Sits at the top of the Summary tab, under the header. No card chrome, no
// generate button — the line is produced by the nightly summary / endpoint.

export function AISummaryWidget({ summary, generatedAt }: {
  summary: string | null;
  generatedAt: string | null;
}) {
  const { t } = useTranslation("campaigns");

  const formattedAt = useMemo(() => {
    if (!generatedAt) return null;
    try {
      return new Date(generatedAt).toLocaleString(undefined, { day: "2-digit", month: "short" });
    } catch { return null; }
  }, [generatedAt]);

  // Collapse to a single line regardless of stored length.
  const oneLine = useMemo(() => (summary || "").replace(/\s*\n+\s*/g, " ").trim(), [summary]);

  return (
    <div className="row" style={{ gap: 16, alignItems: "center", padding: "0 4px" }}>
      <div
        style={{
          width: 32, height: 32, borderRadius: "var(--r-surface)", background: "var(--wine-grad)",
          color: "var(--paper)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}
      >
        <Sparkles className="h-4 w-4" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="eyebrow eyebrow-sm wine" style={{ marginBottom: 4 }}>
          {t("summary.eyebrows.aiRead")}{formattedAt ? ` · ${formattedAt}` : ""}
        </div>
        <div
          className="serif italic"
          style={{
            fontSize: 17, color: oneLine ? "var(--ink-soft)" : "var(--mute)", lineHeight: 1.4,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}
        >
          {oneLine ? <>“{renderRichText(oneLine)}”</> : t("summary.noAiAnalysis")}
        </div>
      </div>
    </div>
  );
}
