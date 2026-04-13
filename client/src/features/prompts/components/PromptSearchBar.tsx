import { useState, useEffect, useRef, useCallback } from "react";
import { X } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  textRef: React.RefObject<HTMLTextAreaElement | null>;
  textValRef: React.MutableRefObject<string>;
  onTextChange: () => void;
}

export function PromptSearchBar({ open, onClose, textRef, textValRef, onTextChange }: Props) {
  const [query, setQuery] = useState("");
  const [replace, setReplace] = useState("");
  const [matchCount, setMatchCount] = useState(0);
  const [currentMatch, setCurrentMatch] = useState(0);
  const [showReplace, setShowReplace] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      inputRef.current?.select();
    } else {
      setQuery("");
      setReplace("");
    }
  }, [open]);

  const findMatches = useCallback(() => {
    if (!query) { setMatchCount(0); setCurrentMatch(0); return []; }
    const text = textValRef.current;
    const matches: number[] = [];
    const q = query.toLowerCase();
    let idx = text.toLowerCase().indexOf(q);
    while (idx !== -1) {
      matches.push(idx);
      idx = text.toLowerCase().indexOf(q, idx + 1);
    }
    setMatchCount(matches.length);
    return matches;
  }, [query, textValRef]);

  useEffect(() => {
    const matches = findMatches();
    if (matches.length > 0 && currentMatch >= matches.length) {
      setCurrentMatch(0);
    }
  }, [query, findMatches, currentMatch]);

  const scrollToMatch = useCallback((matchIdx: number) => {
    const ta = textRef.current;
    if (!ta) return;
    const matches = findMatches();
    if (matches.length === 0) return;
    const pos = matches[matchIdx % matches.length];
    ta.focus();
    ta.setSelectionRange(pos, pos + query.length);
    // Scroll the selection into view
    const linesBefore = textValRef.current.substring(0, pos).split("\n").length - 1;
    const lineHeight = parseFloat(getComputedStyle(ta).lineHeight) || 20;
    ta.scrollTop = Math.max(0, linesBefore * lineHeight - ta.clientHeight / 3);
  }, [findMatches, query, textRef, textValRef]);

  const goNext = () => {
    const next = (currentMatch + 1) % Math.max(1, matchCount);
    setCurrentMatch(next);
    scrollToMatch(next);
  };

  const goPrev = () => {
    const prev = (currentMatch - 1 + matchCount) % Math.max(1, matchCount);
    setCurrentMatch(prev);
    scrollToMatch(prev);
  };

  const replaceOne = () => {
    const ta = textRef.current;
    if (!ta || !query) return;
    const matches = findMatches();
    if (matches.length === 0) return;
    const pos = matches[currentMatch % matches.length];
    const text = textValRef.current;
    textValRef.current = text.substring(0, pos) + replace + text.substring(pos + query.length);
    ta.value = textValRef.current;
    onTextChange();
    findMatches();
  };

  const replaceAll = () => {
    const ta = textRef.current;
    if (!ta || !query) return;
    textValRef.current = textValRef.current.split(query).join(replace);
    ta.value = textValRef.current;
    onTextChange();
    findMatches();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { onClose(); return; }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); goNext(); }
    if (e.key === "Enter" && e.shiftKey) { e.preventDefault(); goPrev(); }
  };

  if (!open) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-popover border-b border-border/30 rounded-t-xl text-[12px]">
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        <input
          ref={inputRef}
          className="h-7 flex-1 min-w-[120px] rounded-md bg-muted/50 px-2 text-[12px] outline-none focus:ring-1 focus:ring-brand-indigo/30"
          placeholder="Search..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <span className="text-muted-foreground/60 text-[11px] tabular-nums shrink-0 w-12 text-center">
          {matchCount > 0 ? `${currentMatch + 1}/${matchCount}` : "0/0"}
        </span>
        <button onClick={goPrev} className="px-1.5 py-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground text-[11px]">↑</button>
        <button onClick={goNext} className="px-1.5 py-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground text-[11px]">↓</button>
      </div>
      {showReplace && (
        <div className="flex items-center gap-1.5">
          <input
            className="h-7 w-[120px] rounded-md bg-muted/50 px-2 text-[12px] outline-none focus:ring-1 focus:ring-brand-indigo/30"
            placeholder="Replace..."
            value={replace}
            onChange={(e) => setReplace(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button onClick={replaceOne} className="px-2 py-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground text-[11px]">1</button>
          <button onClick={replaceAll} className="px-2 py-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground text-[11px]">All</button>
        </div>
      )}
      <button
        onClick={() => setShowReplace(!showReplace)}
        className="px-1.5 py-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground text-[11px]"
      >
        {showReplace ? "−R" : "+R"}
      </button>
      <button onClick={onClose} className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/** Returns search match indices for backdrop highlighting */
export function getSearchMatches(text: string, query: string): number[] {
  if (!query) return [];
  const matches: number[] = [];
  const q = query.toLowerCase();
  let idx = text.toLowerCase().indexOf(q);
  while (idx !== -1) {
    matches.push(idx);
    idx = text.toLowerCase().indexOf(q, idx + 1);
  }
  return matches;
}
