import { useRef, useEffect } from "react";

export function EditText({
  value,
  onChange,
  placeholder,
  multiline = false,
  autoFocus = false,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  autoFocus?: boolean;
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!taRef.current) return;
    taRef.current.style.height = "auto";
    taRef.current.style.height = Math.min(taRef.current.scrollHeight, 320) + "px";
  }, [value]);

  useEffect(() => {
    if (!autoFocus) return;
    const el = taRef.current ?? inputRef.current;
    if (el) {
      el.focus();
      // place cursor at end
      const len = el.value.length;
      el.setSelectionRange(len, len);
    }
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  if (multiline) {
    return (
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full text-[12px] bg-white/60 dark:bg-white/[0.10] border border-brand-indigo/30 rounded-lg px-2.5 py-1.5 resize-none outline-none focus:ring-1 focus:ring-brand-indigo/40 placeholder:text-foreground/30 overflow-y-auto"
        style={{ minHeight: "72px", maxHeight: "320px" }}
      />
    );
  }

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full text-[12px] bg-white/60 dark:bg-white/[0.10] border border-brand-indigo/30 rounded-lg px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-brand-indigo/40 placeholder:text-foreground/30"
    />
  );
}
