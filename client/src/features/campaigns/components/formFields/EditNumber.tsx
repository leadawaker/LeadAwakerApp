import { useRef, useEffect } from "react";

export function EditNumber({
  value,
  onChange,
  placeholder,
  autoFocus = false,
}: {
  value: string | number;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <input
      ref={ref}
      type="number"
      value={String(value)}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full text-[14px] bg-white dark:bg-white rounded-lg px-2.5 py-1.5 outline-none placeholder:text-foreground/30"
    />
  );
}
