// The one search control for topbars: a rounded-square icon (36px, 38px inside a topbar via --tb-ctl; the
// --r-button radius of the other square icon buttons) that opens into a pill
// field on click and folds back once it is empty and loses focus. Escape or the
// cross clears it. `alwaysOpen` keeps the field visible for pages that need it.
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

// The topbar sets --tb-ctl (38px); elsewhere the search is the 36px square.
const SIZE = "var(--tb-ctl, 36px)";

export interface ExpandingSearchProps {
  value: string;
  onChange: (value: string) => void;
  /** Field placeholder; also the icon's label and tooltip unless `label` is set. */
  placeholder: string;
  label?: string;
  /** Shows "N matches" in the field while there is a query. */
  matchCount?: number;
  /** Start opened. It still folds once it is emptied and loses focus. */
  defaultOpen?: boolean;
  /** Keep the field open at all times (never folds to the icon). */
  alwaysOpen?: boolean;
  /** Width of the open field in px (default 220). */
  width?: number;
  /** Below 768px, let the open field take the free space in its row. */
  fillOnMobile?: boolean;
  className?: string;
  testId?: string;
}

export function ExpandingSearch({
  value, onChange, placeholder, label, matchCount, defaultOpen = false, alwaysOpen = false,
  width = 220, fillOnMobile = false, className, testId,
}: ExpandingSearchProps) {
  const { t } = useTranslation("common");
  const [open, setOpen] = useState(defaultOpen);
  const [focusNext, setFocusNext] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const expanded = alwaysOpen || open || value.length > 0;
  const name = label ?? placeholder;

  // Focus only after the user opens it, so a page load never steals focus.
  useEffect(() => {
    if (focusNext && expanded) { inputRef.current?.focus(); setFocusNext(false); }
  }, [focusNext, expanded]);

  const clear = () => { onChange(""); if (!alwaysOpen) setOpen(false); };

  return (
    <div
      role="search"
      data-testid={testId}
      className={cn(fillOnMobile && expanded && "max-md:flex-1", className)}
      style={{
        height: SIZE, width: expanded ? width : SIZE, minWidth: expanded ? 120 : SIZE, flexShrink: expanded ? 1 : 0,
        display: "flex", alignItems: "center", overflow: "hidden", borderRadius: expanded ? "var(--r-pill)" : "var(--r-button)",
        background: expanded ? "var(--bg)" : "var(--surface)",
        boxShadow: expanded ? "var(--sh-inset-crisp)" : "var(--sh-raised-crisp)",
        transition: "width 180ms ease, min-width 180ms ease, box-shadow 180ms, background 180ms, border-radius 180ms",
      }}
    >
      <button
        type="button"
        onClick={() => { setOpen(true); setFocusNext(true); }}
        tabIndex={expanded ? -1 : 0}
        aria-label={name}
        title={expanded ? undefined : name}
        className="text-[var(--mute)] hover:text-[var(--wine)]"
        style={{ width: SIZE, height: SIZE, flexShrink: 0, padding: 0, border: "none", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: expanded ? "text" : "pointer" }}
      >
        <Search size={16} />
      </button>
      {expanded && (
        <>
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") { clear(); inputRef.current?.blur(); } }}
            onBlur={() => { if (!value) setOpen(false); }}
            placeholder={placeholder}
            aria-label={name}
            data-testid={testId ? `${testId}-input` : undefined}
            className="text-[13.5px] max-md:text-[14px] placeholder:text-[var(--mute-2)]"
            style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", color: "var(--ink)", fontFamily: "var(--sans)" }}
          />
          {matchCount != null && value.trim() && (
            <span style={{ fontSize: 11.5, color: "var(--mute)", flexShrink: 0, whiteSpace: "nowrap" }}>{t("search.matches", { count: matchCount })}</span>
          )}
          {(value || !alwaysOpen) && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={clear}
              aria-label={t("search.clear")}
              title={t("search.clear")}
              className="text-[var(--mute)] hover:text-[var(--wine)]"
              style={{ width: 32, height: SIZE, flexShrink: 0, padding: 0, border: "none", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
            >
              <X size={14} />
            </button>
          )}
        </>
      )}
    </div>
  );
}
