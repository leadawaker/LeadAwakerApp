// The prompt preview body: the text split into foldable sections at its
// markdown headings (#, ##, ###), with headings sized like the editor shows
// them. Shared by the normal preview (variables resolved) and the voice
// preview (the engine's rendered text), so both read the same.
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type PreviewSection = {
  headingLineIndex: number | null;
  headingHtmlLine: string | null;
  headingLevel: number;
  bodyLines: { htmlLine: string; lineIndex: number }[];
};

/**
 * Group RAW lines into sections first, then turn each part into HTML. Resolving
 * the whole text up front breaks line alignment, because multi-line {{#if}}
 * conditionals collapse into fewer lines and shift every heading below them.
 */
export function buildPreviewSections(
  text: string,
  toHtml: (raw: string) => string,
  splitLines: (html: string) => string[],
): PreviewSection[] {
  type RawSection = { headingLineIndex: number | null; headingRawLine: string | null; headingLevel: number; bodyRawLines: string[] };
  const rawSections: RawSection[] = [];
  let current: RawSection = { headingLineIndex: null, headingRawLine: null, headingLevel: 0, bodyRawLines: [] };
  text.split("\n").forEach((rawLine, i) => {
    const m = rawLine.match(/^(#{1,3})\s+/);
    if (m) {
      rawSections.push(current);
      current = { headingLineIndex: i, headingRawLine: rawLine, headingLevel: m[1].length, bodyRawLines: [] };
    } else {
      current.bodyRawLines.push(rawLine);
    }
  });
  rawSections.push(current);

  return rawSections.map((s) => ({
    headingLineIndex: s.headingLineIndex,
    headingHtmlLine: s.headingRawLine !== null ? toHtml(s.headingRawLine) : null,
    headingLevel: s.headingLevel,
    bodyLines: s.bodyRawLines.length > 0
      ? splitLines(toHtml(s.bodyRawLines.join("\n"))).map((htmlLine, j) => ({ htmlLine, lineIndex: j }))
      : [],
  }));
}

const HTML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Plain text as safe HTML (for text that is not resolved by resolveVariablesHtml). */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]!);
}

export function PromptPreviewSections({
  sections,
  folded,
  onToggleFold,
  fontSize,
  font,
}: {
  sections: PreviewSection[];
  /** Heading line indexes whose sections are folded. */
  folded: Set<number>;
  onToggleFold: (lineIndex: number) => void;
  fontSize: number;
  font: string;
}) {
  const headingIndices = sections.map((s, si) => (s.headingLineIndex !== null ? si : -1)).filter((n) => n >= 0);

  // Sections hidden because a parent heading is folded.
  const hiddenByParent = new Set<number>();
  const activeAncestors: Record<number, number> = {}; // level -> lineIndex of the last heading at that level
  sections.forEach((section, si) => {
    if (section.headingLineIndex === null) return;
    const level = section.headingLevel;
    for (let parentLevel = 1; parentLevel < level; parentLevel++) {
      if (activeAncestors[parentLevel] !== undefined && folded.has(activeAncestors[parentLevel])) {
        hiddenByParent.add(si);
        break;
      }
    }
    activeAncestors[level] = section.headingLineIndex;
    for (let l = level + 1; l <= 3; l++) delete activeAncestors[l];
  });

  return (
    <div className="text-foreground break-words" style={{ fontSize: `${fontSize}px`, fontFamily: font, lineHeight: 1.7 }}>
      {sections.map((section, si) => {
        if (section.headingLineIndex === null && section.bodyLines.length === 0) return null;
        if (hiddenByParent.has(si)) return null;
        const isFolded = section.headingLineIndex !== null && folded.has(section.headingLineIndex);
        const h1 = section.headingLevel === 1;
        const h2 = section.headingLevel === 2;
        const h3 = section.headingLevel === 3;
        const hasHeading = h1 || h2 || h3;
        const sizeClass = h1 ? "text-[1.3em] font-bold" : h2 ? "text-[1.15em] font-bold" : h3 ? "text-[1.05em] font-semibold" : "";
        const showTopBorder = hasHeading && (h1 || h2) && headingIndices.some((idx) => idx < si);

        return (
          <div key={si}>
            {hasHeading && section.headingHtmlLine !== null && (
              <div
                className="flex items-start gap-1"
                style={showTopBorder ? { borderTop: "1px solid var(--line)", marginTop: 14, paddingTop: 14 } : {}}
              >
                <button
                  type="button"
                  onClick={() => onToggleFold(section.headingLineIndex!)}
                  style={{
                    background: "transparent", border: "none", cursor: "pointer",
                    padding: "2px 1px 0", flexShrink: 0, color: "var(--mute-2)",
                    display: "flex", alignItems: "center",
                  }}
                >
                  {isFolded ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                </button>
                <div
                  className={cn("leading-relaxed whitespace-pre-wrap flex-1 min-w-0", sizeClass)}
                  dangerouslySetInnerHTML={{ __html: section.headingHtmlLine.replace(/^#{1,3}\s*/, "") || "&nbsp;" }}
                />
              </div>
            )}
            {!isFolded && section.bodyLines.map(({ htmlLine, lineIndex }) => (
              <div
                key={lineIndex}
                className="leading-relaxed whitespace-pre-wrap"
                dangerouslySetInnerHTML={{ __html: htmlLine || "&nbsp;" }}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}
