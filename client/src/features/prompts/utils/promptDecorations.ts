import { Decoration, type DecorationSet } from "@codemirror/view";
import { RangeSetBuilder, type EditorState } from "@codemirror/state";

/* Shared regexes — the saved value stays plain markdown, we only style the view. */
export const VAR_RE = /\{(\w+)\}/g;
export const HEADING_RE = /^(#{1,3})\s+/;
// Conditional tags: {{#if var == "x"}} / {{else}} / {{/if}}. Only the tags are
// highlighted (in the editor) — never the content between them.
export const COND_RE = /\{\{#if[^}]*\}\}|\{\{else\}\}|\{\{\/if\}\}/g;

const varMark = Decoration.mark({ class: "cm-var" });
const condMark = Decoration.mark({ class: "cm-cond" });
const h1Line = Decoration.line({ class: "cm-h1" });
const h2Line = Decoration.line({ class: "cm-h2" });
const h3Line = Decoration.line({ class: "cm-h3" });

/**
 * Build decorations over the entire document (not just the visible viewport).
 *
 * Height-affecting decorations (.cm-h1/.cm-h2/.cm-h3 change font-size) MUST
 * come from a StateField, not a ViewPlugin. Viewport-scoped height decorations
 * desync CM6's height map, causing click-position drift, scroll jank, and
 * crashes on multi-line edits (select+Backspace, paste). Prompts are small
 * (hundreds of lines), so full-doc scanning is the correct CM6 pattern here.
 */
export function buildDecorations(state: EditorState): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const { doc } = state;

  for (let lineNo = 1; lineNo <= doc.lines; lineNo++) {
    const line = doc.line(lineNo);
    const text = line.text;

    const hm = text.match(HEADING_RE);
    if (hm) {
      const lineDeco = hm[1].length === 1 ? h1Line : hm[1].length === 2 ? h2Line : h3Line;
      builder.add(line.from, line.from, lineDeco);
    }

    let m: RegExpExecArray | null;

    // Conditional tags first, so we can skip {variable} false-positives that
    // fall inside a tag (e.g. the `{else}` substring of `{{else}}`).
    const condRanges: Array<[number, number]> = [];
    COND_RE.lastIndex = 0;
    while ((m = COND_RE.exec(text)) !== null) {
      const start = line.from + m.index;
      condRanges.push([start, start + m[0].length]);
    }

    const marks: Array<[number, number, Decoration]> = condRanges.map(
      ([s, e]) => [s, e, condMark],
    );

    VAR_RE.lastIndex = 0;
    while ((m = VAR_RE.exec(text)) !== null) {
      const start = line.from + m.index;
      const end = start + m[0].length;
      if (condRanges.some(([cs, ce]) => start >= cs && end <= ce)) continue;
      marks.push([start, end, varMark]);
    }

    marks.sort((a, b) => a[0] - b[0]);
    for (const [from2, to2, deco] of marks) builder.add(from2, to2, deco);
  }

  return builder.finish();
}
