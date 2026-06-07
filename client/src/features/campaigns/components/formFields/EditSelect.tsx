import { useRef, useEffect } from "react";

export function EditSelect({
  value,
  onChange,
  options,
  labels,
  autoFocus = false,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  labels?: string[] | Record<string, string>;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const getLabel = (o: string, i: number) => {
    if (!labels) return o;
    if (Array.isArray(labels)) return labels[i] ?? o;
    return labels[o] ?? o;
  };

  return (
    <select
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="la-input"
    >
      {options.map((o, i) => (
        <option key={o} value={o}>
          {getLabel(o, i)}
        </option>
      ))}
    </select>
  );
}
