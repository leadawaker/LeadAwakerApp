import { useRef, useEffect } from "react";

export function EditText({
  value,
  onChange,
  placeholder,
  multiline = false,
  autoFocus = false,
  minRows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  autoFocus?: boolean;
  minRows?: number;
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (!taRef.current) return;
    const el = taRef.current;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 320) + "px";

    // On first render the grid column may still be transitioning (200ms),
    // causing scrollHeight to be calculated on a narrow container.
    // Re-measure after the transition completes.
    if (isFirstRender.current) {
      isFirstRender.current = false;
      const timer = setTimeout(() => {
        if (!el.isConnected) return;
        el.style.height = "auto";
        el.style.height = Math.min(el.scrollHeight, 320) + "px";
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [value]);

  useEffect(() => {
    if (!autoFocus) return;
    const el = taRef.current ?? inputRef.current;
    if (el) {
      el.focus();
      const len = el.value.length;
      el.setSelectionRange(len, len);
    }
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  if (multiline) {
    const minH = Math.max(minRows * 24, 36);
    return (
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={minRows}
        className="w-full text-[14px] bg-white dark:bg-white rounded-lg px-2.5 py-1.5 resize-none outline-none placeholder:text-foreground/30 overflow-y-auto"
        style={{ minHeight: `${minH}px`, maxHeight: "320px" }}
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
      className="w-full text-[14px] bg-white dark:bg-white rounded-lg px-2.5 py-1.5 outline-none placeholder:text-foreground/30"
    />
  );
}
