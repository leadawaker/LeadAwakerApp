import { useRef, useEffect } from "react";

export function EditSelect({
  value,
  onChange,
  options,
  autoFocus = false,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
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
      className="w-full text-[12px] bg-white/60 dark:bg-white/[0.10] border border-brand-indigo/30 rounded-lg px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-brand-indigo/40"
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}
