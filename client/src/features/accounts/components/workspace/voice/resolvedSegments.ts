// Split a filled-in prompt into what came from the template, what a
// placeholder became, and what the engine added around it, by walking the
// template's fixed text through the rendered output.

export type Segment = { kind: "text" | "value" | "added"; text: string };

const PLACEHOLDER = /(\{\{?\s*[#/]?[\w.-]+\s*\}?\})/;

/** First index of `literal` in `out` from `from`, or -1. A long literal is
 *  also tried by its opening, in case the engine trimmed or reflowed its end. */
function findLiteral(out: string, literal: string, from: number): number {
  const exact = out.indexOf(literal, from);
  if (exact !== -1 || literal.length <= 40) return exact;
  return out.indexOf(literal.slice(0, 40), from);
}

export function resolvedSegments(template: string, output: string): Segment[] {
  const parts = template.split(PLACEHOLDER);
  // parts: literal, placeholder, literal, placeholder, ..., literal
  const segments: Segment[] = [];
  let pos = 0;
  const push = (kind: Segment["kind"], text: string) => { if (text) segments.push({ kind, text }); };

  for (let i = 0; i < parts.length; i += 2) {
    const literal = parts[i];
    if (!literal) continue;
    const at = findLiteral(output, literal, pos);
    if (at === -1) {
      // The output no longer follows the template: show the rest unmarked.
      push("text", output.slice(pos));
      return segments;
    }
    // Before the first literal: the engine's own preamble. Between literals: a placeholder's value.
    push(i === 0 ? "added" : "value", output.slice(pos, at));
    const end = output.indexOf(literal, at) === at ? at + literal.length : at + Math.min(literal.length, 40);
    push("text", output.slice(at, end));
    pos = end;
  }
  // A template ending in a placeholder: that value runs to where the engine's additions start,
  // which cannot be told apart, so it is all marked as filled in.
  const endsInPlaceholder = parts.length > 1 && !parts[parts.length - 1];
  push(endsInPlaceholder ? "value" : "added", output.slice(pos));
  return segments;
}
