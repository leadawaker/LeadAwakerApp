// The Calls page's transcript search, in the player's control row: a flat round button
// (wine while a search is active) that opens a small floating field above it. The query
// lives in the page, so closing the field keeps the search; the cross clears it.
import { Search, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { IconBtn } from "@/components/ui/icon-btn";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function TranscriptSearchButton({ query, onQuery, matches }: { query: string; onQuery: (q: string) => void; matches: number }) {
  const { t } = useTranslation("voiceCalls");
  const { t: tc } = useTranslation("common");
  const label = t("searchTranscript");
  return (
    <Popover>
      <PopoverTrigger asChild>
        <IconBtn active={query.trim().length > 0} aria-label={label} title={label} data-testid="voice-call-search"><Search className="h-4 w-4" /></IconBtn>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="p-1.5" style={{ width: "min(280px, calc(100vw - 32px))" }} data-testid="voice-call-search-field">
        <div style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: 8 }}>
          <Search size={14} className="text-[var(--mute)]" style={{ flexShrink: 0 }} aria-hidden />
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder={label}
            aria-label={label}
            className="text-[14px] placeholder:text-[var(--mute-2)]"
            style={{ flex: 1, minWidth: 0, height: 32, border: "none", outline: "none", background: "transparent", color: "var(--ink)", fontFamily: "var(--sans)" }}
          />
          {query.trim() && (
            <span style={{ fontSize: 11.5, color: "var(--mute)", flexShrink: 0, whiteSpace: "nowrap" }}>{tc("search.matches", { count: matches })}</span>
          )}
          {query && (
            <button type="button" onClick={() => onQuery("")} aria-label={tc("search.clear")} title={tc("search.clear")}
              className="text-[var(--mute)] hover:text-[var(--wine)]"
              style={{ width: 32, height: 32, flexShrink: 0, padding: 0, border: "none", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <X size={13} />
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
