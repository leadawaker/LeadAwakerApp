// Loading skeleton of the Prompt Library: mirrors the topbar, the list
// (its width follows the persisted list panel state) and the editor.
import { useListPanelState } from "@/hooks/useListPanelState";

export function PromptsPageSkeleton() {
  const { state: leftPanelState } = useListPanelState();
  return (
    <div className="flex flex-col h-full" data-testid="page-prompt-library">
      {/* Topbar skeleton: mirrors the 60px topbar with title, tabs and action buttons */}
      <div
        className="shrink-0 flex items-center gap-3 px-[18px]"
        style={{ height: 60, background: "var(--bg)" }}
      >
        {/* Title */}
        <div className="h-[22px] w-32 bg-primary/10 rounded animate-pulse hidden md:block" />
        {/* Segment tabs */}
        <div className="flex items-center gap-1 shrink-0">
          <div className="h-8 w-24 bg-primary/10 rounded-full animate-pulse" />
          <div className="h-8 w-20 bg-primary/5 rounded-full animate-pulse" />
        </div>
        {/* Panel toggle icon */}
        <div className="h-8 w-8 bg-primary/5 rounded animate-pulse hidden lg:block" />
        {/* Spacer */}
        <div className="flex-1" />
        {/* Right action buttons */}
        <div className="hidden lg:flex items-center gap-1.5">
          <div className="h-8 w-8 bg-primary/5 rounded animate-pulse" />
          <div className="h-8 w-8 bg-primary/5 rounded animate-pulse" />
          <div className="h-8 w-[180px] bg-primary/5 rounded animate-pulse" />
          <div className="h-8 w-8 bg-primary/5 rounded animate-pulse" />
          <div className="h-8 w-8 bg-primary/5 rounded animate-pulse" />
          <div className="h-8 w-8 bg-primary/5 rounded animate-pulse" />
          <div className="h-8 w-20 bg-primary/10 rounded-full animate-pulse" />
        </div>
      </div>

      {/* Split pane */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left panel: width follows the persisted toolbar state (full list or the small rail) */}
        {leftPanelState === "compact" ? (
          <div className="la-list-panel shrink-0 hidden lg:flex flex-col min-h-0 overflow-hidden items-center" style={{ width: 52 }}>
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col items-center gap-1.5 py-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="shrink-0 bg-primary/10 animate-pulse"
                  style={{ width: 34, height: 34, borderRadius: "var(--r-surface)", opacity: 1 - i * 0.085 }}
                />
              ))}
            </div>
          </div>
        ) : (
          <div
            className="la-list-panel shrink-0 hidden lg:flex flex-col min-h-0 overflow-hidden"
            style={{ width: "var(--toolbar-w)" }}
          >
            <div className="flex-1 min-h-0 overflow-hidden" style={{ padding: "8px 10px 16px" }}>
              <div className="flex flex-col gap-[3px]">
                {Array.from({ length: 8 }).map((_, i) => (
                  /* Each card mirrors PromptListCard: padding 9px 7px, gap 9, 34px icon + content */
                  <div
                    key={i}
                    className="bg-card animate-pulse"
                    style={{
                      borderRadius: "var(--r-surface)",
                      boxShadow: "var(--sh-raised-crisp)",
                      padding: "9px 7px",
                      display: "flex",
                      gap: 9,
                      alignItems: "flex-start",
                      opacity: 1 - i * 0.085,
                    }}
                  >
                    {/* Bot icon box */}
                    <div
                      className="shrink-0 bg-primary/10"
                      style={{ width: 34, height: 34, borderRadius: "var(--r-surface)" }}
                    />
                    {/* Content area */}
                    <div className="flex-1 min-w-0 flex flex-col gap-[7px] pt-[2px]">
                      {/* Row 1: name line + date stub */}
                      <div className="flex items-center gap-2 justify-between">
                        <div
                          className="bg-primary/10 rounded"
                          style={{ height: 11, width: `${52 + (i % 3) * 16}%` }}
                        />
                        <div className="bg-primary/5 rounded shrink-0" style={{ height: 9, width: 28 }} />
                      </div>
                      {/* Row 2: campaign + account metas */}
                      <div className="flex items-center gap-2">
                        <div
                          className="bg-primary/5 rounded"
                          style={{ height: 9, width: `${38 + (i % 2) * 20}%` }}
                        />
                        <div className="bg-primary/5 rounded" style={{ height: 9, width: 44 }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Right panel: mirrors background: var(--surface), padding: 8px, gap: 8 */}
        <div
          className="flex-1 min-h-0 flex flex-col overflow-hidden"
          style={{ background: "var(--surface)", padding: 8, gap: 8 }}
        >
          {/* Detail header: mirrors: bg: var(--paper), sh-raised-crisp, r-surface, minHeight 56, padding 10px 18px */}
          <div
            className="shrink-0 flex items-center gap-4 animate-pulse"
            style={{
              minHeight: 56,
              padding: "10px 18px",
              borderRadius: "var(--r-surface)",
              boxShadow: "var(--sh-raised-crisp)",
              background: "var(--paper)",
            }}
          >
            {/* Icon */}
            <div
              className="shrink-0 bg-primary/10"
              style={{ width: 38, height: 38, borderRadius: "var(--r-surface)" }}
            />
            {/* Name + badge + meta */}
            <div className="flex-1 min-w-0 flex flex-col gap-[6px]">
              <div className="flex items-center gap-2">
                <div className="bg-primary/10 rounded" style={{ height: 14, width: 160 }} />
                <div className="bg-primary/10 rounded-full" style={{ height: 16, width: 44 }} />
              </div>
              <div className="bg-primary/5 rounded" style={{ height: 9, width: 110 }} />
            </div>
            {/* Right controls */}
            <div className="hidden lg:flex items-center gap-2 shrink-0">
              <div className="bg-primary/5 rounded" style={{ height: 10, width: 80 }} />
              <div style={{ width: 1, height: 22, background: "var(--line)" }} />
              <div className="bg-primary/5 rounded" style={{ height: 32, width: 90 }} />
              <div className="bg-primary/5 rounded" style={{ height: 32, width: 66 }} />
              <div className="bg-primary/5 rounded" style={{ height: 32, width: 80 }} />
              <div className="bg-primary/5 rounded" style={{ height: 32, width: 72 }} />
            </div>
          </div>

          {/* Editor body: raised card with code-line shimmers */}
          <div
            className="flex-1 min-h-0 animate-pulse"
            style={{
              borderRadius: "var(--r-surface)",
              boxShadow: "var(--sh-raised-crisp)",
              background: "var(--paper)",
              padding: "20px 24px",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {/* Section label */}
            <div className="bg-primary/5 rounded" style={{ height: 9, width: 80, marginBottom: 6 }} />
            {/* Code lines: varying widths to look like prompt text */}
            {[92, 78, 85, 65, 90, 72, 88, 60, 82, 75, 55, 86, 70, 64, 91].map((w, i) => (
              <div
                key={i}
                className="bg-primary/10 rounded"
                style={{ height: 11, width: `${w}%`, opacity: 1 - i * 0.03 }}
              />
            ))}
            {/* Gap between sections */}
            <div style={{ height: 16 }} />
            {/* Second section label */}
            <div className="bg-primary/5 rounded" style={{ height: 9, width: 60 }} />
            {[80, 55, 72, 46, 68].map((w, i) => (
              <div
                key={`b-${i}`}
                className="bg-primary/10 rounded"
                style={{ height: 11, width: `${w}%`, opacity: 0.6 - i * 0.05 }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
