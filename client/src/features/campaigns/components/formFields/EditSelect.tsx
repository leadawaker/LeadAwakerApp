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
  labels?: string[];
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <select
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full text-[14px] bg-white dark:bg-white rounded-lg px-2.5 py-1.5 outline-none"
    >
      {options.map((o, i) => (
        <option key={o} value={o}>
          {labels?.[i] ?? o}
        </option>
      ))}
    </select>
  );
}
