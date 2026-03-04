import { type ReactNode } from "react";

/**
 * Parse inline markup into React elements:
 *   *text*   → <strong>
 *   _text_   → <em>
 *   __text__ → <u>
 *
 * Order matters: __underline__ is matched before _italic_ so double-underscore
 * isn't consumed as two single-underscore matches.
 */
export function renderRichText(text: string): ReactNode[] {
  const regex = /__(.+?)__|\*(.+?)\*|_(.+?)_/g;
  const result: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      result.push(text.slice(lastIndex, match.index));
    }
    if (match[1] !== undefined) {
      result.push(<u key={key++}>{match[1]}</u>);
    } else if (match[2] !== undefined) {
      result.push(<strong key={key++}>{match[2]}</strong>);
    } else if (match[3] !== undefined) {
      result.push(<em key={key++}>{match[3]}</em>);
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex));
  }
  return result.length > 0 ? result : [text];
}
