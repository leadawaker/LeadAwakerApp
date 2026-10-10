// A text input for a comma-separated list. The typed text is kept as typed
// (so "solar," keeps its comma while the next entry is typed) and only the
// parsed list goes up. When the list changes from outside (save, cancel), the
// text follows it.
import { useEffect, useState, type CSSProperties } from "react";

const parse = (text: string) => text.split(",").map((s) => s.trim()).filter(Boolean);
const same = (a: string[], b: string[]) => a.length === b.length && a.every((v, i) => v === b[i]);

export function CommaListInput({ value, onChange, placeholder, style }: {
  value: string[];
  onChange: (list: string[]) => void;
  placeholder?: string;
  style?: CSSProperties;
}) {
  const [text, setText] = useState(value.join(", "));
  useEffect(() => {
    setText((t) => (same(parse(t), value) ? t : value.join(", ")));
  }, [value]);

  return (
    <input
      style={style}
      value={text}
      placeholder={placeholder}
      onChange={(e) => {
        setText(e.target.value);
        onChange(parse(e.target.value));
      }}
    />
  );
}
