import { useState, useRef, useEffect, useId, useCallback } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Pick-or-type combobox. Clicking the chevron or the field opens a suggestion
 * list; the user can also type a custom value.
 *
 * Styled to match EditSelect / la-input. The chevron is part of the input
 * shell — clicking anywhere opens the list.
 */
export function LocalizedCombo({
  displayValue,
  onChange,
  options,
  placeholder,
  autoFocus = false,
}: {
  displayValue: string;
  onChange: (store: string) => void;
  options: Array<{ label: string; store: string }>;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState(displayValue);
  const [activeIdx, setActiveIdx] = useState(-1);
  // Tracks whether the user has typed since the dropdown opened (vs just navigating)
  const [userTyped, setUserTyped] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  // Sync input with external value changes (e.g. draft reset)
  useEffect(() => { setInput(displayValue); }, [displayValue]);

  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus();
      const len = displayValue.length;
      inputRef.current?.setSelectionRange(len, len);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        commitCustom();
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, input]); // eslint-disable-line react-hooks/exhaustive-deps

  // Only filter by input text when the user has actually typed — opening the
  // dropdown should show ALL options regardless of what's currently in the field
  const filtered = userTyped
    ? options.filter(o => !input || o.label.toLowerCase().includes(input.toLowerCase()))
    : options;

  const selectOption = useCallback((opt: { label: string; store: string }) => {
    setInput(opt.label);
    onChange(opt.store);
    setOpen(false);
    setActiveIdx(-1);
    setUserTyped(false);
  }, [onChange]);

  const commitCustom = useCallback(() => {
    const trimmed = input.trim();
    if (trimmed !== displayValue) {
      // Custom typed value — store as-is (plain string, engine handles gracefully)
      onChange(trimmed);
    }
  }, [input, displayValue, onChange]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter") { setOpen(true); e.preventDefault(); }
      return;
    }
    if (e.key === "Escape") { commitCustom(); setOpen(false); e.preventDefault(); return; }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIdx >= 0 && filtered[activeIdx]) {
        selectOption(filtered[activeIdx]);
      } else if (filtered.length === 1) {
        selectOption(filtered[0]);
      } else {
        commitCustom();
        setOpen(false);
      }
    }
  };

  return (
    <div ref={wrapRef} style={{ position: "relative", display: "flex" }}>
      <input
        ref={inputRef}
        type="text"
        className="la-input"
        style={{ flex: 1, paddingRight: "2rem" }}
        value={input}
        placeholder={placeholder}
        aria-autocomplete="list"
        aria-controls={open ? listId : undefined}
        aria-expanded={open}
        onChange={e => { setInput(e.target.value); setUserTyped(true); setOpen(true); setActiveIdx(-1); }}
        onFocus={() => { setUserTyped(false); setOpen(true); setActiveIdx(-1); }}
        onKeyDown={handleKeyDown}
        onBlur={e => {
          // Only commit if focus left the whole wrapper
          if (!wrapRef.current?.contains(e.relatedTarget as Node)) {
            commitCustom();
            setOpen(false);
          }
        }}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label="Open options"
        onClick={() => { inputRef.current?.focus(); setUserTyped(false); setOpen(o => !o); }}
        style={{
          position: "absolute", right: "0.5rem", top: "50%",
          transform: "translateY(-50%)", background: "none", border: "none",
          cursor: "pointer", padding: "2px", color: "var(--mute, #888)",
          display: "flex", alignItems: "center",
        }}
      >
        <ChevronDown size={14} style={{ transition: "transform 0.15s", transform: open ? "rotate(180deg)" : "none" }} />
      </button>

      {open && filtered.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          style={{
            position: "absolute",
            top: "calc(100% + 2px)",
            left: 0,
            right: 0,
            zIndex: 200,
            margin: 0,
            padding: "4px 0",
            listStyle: "none",
            background: "var(--surface-card, var(--surface, #fff))",
            border: "1px solid var(--border, #ddd)",
            borderRadius: "var(--radius-md, 6px)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
            maxHeight: "220px",
            overflowY: "auto",
          }}
        >
          {filtered.map((opt, i) => (
            <li
              key={opt.store}
              role="option"
              aria-selected={i === activeIdx}
              onMouseDown={e => { e.preventDefault(); selectOption(opt); }}
              onMouseEnter={() => setActiveIdx(i)}
              style={{
                padding: "6px 12px",
                cursor: "pointer",
                fontSize: "0.875rem",
                background: i === activeIdx ? "var(--accent-muted, var(--hover, rgba(0,0,0,0.06)))" : "transparent",
                color: "var(--text, inherit)",
              }}
            >
              {opt.label || <span style={{ color: "var(--mute)" }}>&mdash;</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
