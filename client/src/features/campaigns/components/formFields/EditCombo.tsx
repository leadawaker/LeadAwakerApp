import { useRef, useEffect, useId } from "react";

/**
 * EditCombo — free-text input with a dropdown of suggested options.
 *
 * Humans can pick one of the suggestions OR type their own value.
 * (The AI campaign generator is constrained to the fixed options elsewhere;
 * this component is for human editing only.)
 */
export function EditCombo({
  value,
  onChange,
  options,
  placeholder,
  autoFocus = false,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!autoFocus || !ref.current) return;
    const el = ref.current;
    el.focus();
    const len = el.value.length;
    el.setSelectionRange(len, len);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        list={listId}
        className="la-input"
      />
      <datalist id={listId}>
        {options.filter(Boolean).map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </>
  );
}
