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
      className="la-input"
    />
  );
}
