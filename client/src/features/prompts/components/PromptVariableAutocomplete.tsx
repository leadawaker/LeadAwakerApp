import { useState, useEffect, useRef } from "react";

const KNOWN_VARIABLES = [
  "first_name", "last_name", "phone", "email",
  "agent_name", "service_name", "calendar_link", "campaign_name",
  "usp", "kb", "what_lead_did", "inquiries_source", "inquiry_timeframe",
  "niche_question", "booking_mode", "company_name", "niche",
  "business_description", "ai_style", "language", "ai_role",
  "typo_frequency", "today_date", "qualification_criteria",
];

interface Props {
  textRef: React.RefObject<HTMLTextAreaElement | null>;
  textValRef: React.MutableRefObject<string>;
  onInsert: () => void;
}

export function PromptVariableAutocomplete({ textRef, textValRef, onInsert }: Props) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [selectedIdx, setSelectedIdx] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  const filtered = KNOWN_VARIABLES.filter((v) => v.includes(filter.toLowerCase()));

  useEffect(() => {
    const ta = textRef.current;
    if (!ta) return;

    const handleInput = () => {
      const pos = ta.selectionStart;
      const text = ta.value;
      // Find the last `{` before cursor that doesn't have a closing `}`
      const before = text.substring(0, pos);
      const lastOpen = before.lastIndexOf("{");
      const lastClose = before.lastIndexOf("}");

      if (lastOpen > lastClose && lastOpen >= 0) {
        const partial = before.substring(lastOpen + 1);
        // Only show if partial is word chars (no spaces/special)
        if (/^\w*$/.test(partial)) {
          setFilter(partial);
          setSelectedIdx(0);
          // Calculate position relative to textarea
          const cs = getComputedStyle(ta);
          const lineHeight = parseFloat(cs.lineHeight) || 20;
          const lines = before.split("\n");
          const currentLine = lines.length - 1;
          setPosition({
            top: (currentLine + 1) * lineHeight + 8,
            left: 60,
          });
          setOpen(true);
          return;
        }
      }
      setOpen(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" || e.key === "Tab") {
        if (filtered.length > 0) {
          e.preventDefault();
          insertVariable(filtered[selectedIdx]);
        }
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };

    ta.addEventListener("input", handleInput);
    ta.addEventListener("keydown", handleKeyDown);
    return () => {
      ta.removeEventListener("input", handleInput);
      ta.removeEventListener("keydown", handleKeyDown);
    };
  });

  const insertVariable = (varName: string) => {
    const ta = textRef.current;
    if (!ta) return;
    const pos = ta.selectionStart;
    const text = ta.value;
    const before = text.substring(0, pos);
    const lastOpen = before.lastIndexOf("{");
    // Replace from `{` to cursor with `{varName}`
    const newText = text.substring(0, lastOpen) + `{${varName}}` + text.substring(pos);
    textValRef.current = newText;
    ta.value = newText;
    const newPos = lastOpen + varName.length + 2;
    ta.setSelectionRange(newPos, newPos);
    ta.focus();
    setOpen(false);
    onInsert();
  };

  if (!open || filtered.length === 0) return null;

  return (
    <div
      ref={menuRef}
      className="absolute z-20 bg-popover border border-border/40 rounded-lg shadow-lg py-1 max-h-[200px] overflow-y-auto min-w-[200px]"
      style={{ top: position.top, left: position.left }}
    >
      {filtered.map((v, i) => (
        <button
          key={v}
          type="button"
          className={`w-full text-left px-3 py-1 text-[12px] font-mono hover:bg-muted/60 ${i === selectedIdx ? "bg-muted/60 text-foreground" : "text-foreground/70"}`}
          onMouseDown={(e) => { e.preventDefault(); insertVariable(v); }}
        >
          {"{" + v + "}"}
        </button>
      ))}
    </div>
  );
}

/** Set of known variable names for validation */
export const KNOWN_VARIABLE_SET = new Set(KNOWN_VARIABLES);
