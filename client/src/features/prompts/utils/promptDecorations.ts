import { Decoration, type DecorationSet, type EditorView } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";

/* Shared regexes — the saved value stays plain markdown, we only style the view. */
export const VAR_RE = /\{(\w+)\}/g;
export const HEADING_RE = /^(#{1,3})\s+/;

const varMark = Decoration.mark({ class: "cm-var" });
const h1Line = Decoration.line({ class: "cm-h1" });
const h2Line = Decoration.line({ class: "cm-h2" });
const h3Line = Decoration.line({ class: "cm-h3" });

/**
 * Build decorations for the visible viewport:
 *  - `{word}` tokens get a `.cm-var` mark (no padding — CM positions on the real
 *    glyph run, so multiple vars per line stay aligned).
 *  - `#`/`##`/`###` heading lines get a `.cm-h1|2|3` line decoration.
 */
export function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const { doc } = view.state;

  for (const { from, to } of view.visibleRanges) {
    let pos = from;
    while (pos <= to) {
      const line = doc.lineAt(pos);
      const text = line.text;

      const hm = text.match(HEADING_RE);
      if (hm) {
        const lineDeco = hm[1].length === 1 ? h1Line : hm[1].length === 2 ? h2Line : h3Line;
        builder.add(line.from, line.from, lineDeco);
      }

      VAR_RE.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = VAR_RE.exec(text)) !== null) {
        const start = line.from + m.index;
        builder.add(start, start + m[0].length, varMark);
      }

      pos = line.to + 1;
    }
  }

  return builder.finish();
}
