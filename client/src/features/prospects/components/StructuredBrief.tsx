/**
 * Render a labeled-category brief like:
 *   ROLE: foo
 *   BACKGROUND: bar
 *   BACKGROUND: baz
 *   CONTENT: qux
 *
 * Lines with the same label are grouped; lines without a recognized label
 * fall into an "OTHER" bucket (shown plain).
 *
 * Falls back to a plain paragraph if no labels are detected.
 */
export function StructuredBrief({ text, title }: { text?: string | null; title?: string }) {
  if (!text || !text.trim()) return null;

  const grouped = parseLabeledLines(text);
  const hasLabels = Object.keys(grouped).some((k) => k !== "OTHER");

  return (
    <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-border/60 shadow-sm">
      {title && (
        <div className="text-[10px] font-medium text-foreground/60 mb-2">{title}</div>
      )}

      {hasLabels ? (
        <div className="space-y-2.5">
          {Object.entries(grouped).map(([label, lines]) =>
            label === "OTHER" ? null : (
              <div key={label}>
                <div className="text-[9px] font-bold uppercase tracking-widest text-brand-indigo dark:text-blue-400 mb-0.5">
                  {label}
                </div>
                <div className="space-y-1">
                  {lines.map((line, i) => (
                    <div
                      key={i}
                      className="text-[12px] text-foreground/80 leading-relaxed"
                    >
                      {line}
                    </div>
                  ))}
                </div>
              </div>
            ),
          )}
          {grouped.OTHER && grouped.OTHER.length > 0 && (
            <div className="text-[12px] text-foreground/70 leading-relaxed whitespace-pre-wrap pt-1 border-t border-border/50">
              {grouped.OTHER.join("\n")}
            </div>
          )}
        </div>
      ) : (
        <div className="text-[12px] text-foreground/80 leading-relaxed whitespace-pre-wrap">
          {text}
        </div>
      )}
    </div>
  );
}

function parseLabeledLines(text: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    // Match "LABEL: rest" where LABEL is uppercase letters/spaces/slashes/ampersands up to ~40 chars
    const m = line.match(/^([A-Z][A-Z0-9 /&-]{1,40}):\s*(.+)$/);
    if (m) {
      const label = m[1].trim();
      const content = m[2].trim();
      if (!out[label]) out[label] = [];
      out[label].push(content);
    } else {
      if (!out.OTHER) out.OTHER = [];
      out.OTHER.push(line);
    }
  }

  return out;
}
