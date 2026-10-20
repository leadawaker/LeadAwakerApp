/**
 * Loading shapes for the Voice calls page, in the same layout as the real
 * thing: a list of call rows, and a call detail with the header on top, the
 * booking and summary panel on the left and the conversation on the right,
 * all inside the centered DETAIL_MAX_WIDTH column.
 */
export const DETAIL_MAX_WIDTH = 1100;
export const SIDEBAR_WIDTH = 340;

function Bar({ w, h = 10, r = "var(--r-flush)", style }: { w: number | string; h?: number; r?: string; style?: React.CSSProperties }) {
  return <span aria-hidden="true" style={{ display: "block", width: w, height: h, borderRadius: r, background: "var(--line)", flexShrink: 0, ...style }} />;
}

/** Call rows in the list column while the calls load. */
export function CallListSkeleton({ rows = 7 }: { rows?: number }) {
  return (
    <div className="animate-pulse" aria-busy="true" data-testid="voice-list-skeleton" style={{ display: "flex", flexDirection: "column", gap: 5, paddingTop: 6 }}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} style={{ display: "flex", gap: 10, padding: "9px 12px" }}>
          <Bar w={38} h={38} r="var(--r-surface)" />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7, paddingTop: 2 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}><Bar w="55%" h={12} /><Bar w={34} h={8} /></div>
            <Bar w="40%" h={9} />
            <div style={{ display: "flex", justifyContent: "space-between" }}><Bar w={70} h={12} r="var(--r-pill)" /><Bar w={56} h={14} r="var(--r-pill)" /></div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Bubble({ right, w }: { right?: boolean; w: string }) {
  return <Bar w={w} h={40} r="13px" style={{ alignSelf: right ? "flex-end" : "flex-start", background: right ? "color-mix(in srgb, var(--ink) 14%, transparent)" : "var(--line)" }} />;
}

/**
 * The call detail while it loads. `sidebar`, when given, replaces the left
 * panel's shapes (the Callers view keeps the person's real call list up).
 */
export function CallDetailSkeleton({ narrow, sidebar }: { narrow: boolean; sidebar?: React.ReactNode }) {
  const panel: React.CSSProperties = { borderRadius: "var(--r-card)", background: "var(--card)" };
  return (
    <div aria-busy="true" data-testid="voice-detail-skeleton" style={{ flex: 1, minHeight: 0, padding: 14, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ width: "100%", maxWidth: DETAIL_MAX_WIDTH, margin: "0 auto", flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="neu-raised animate-pulse" style={{ ...panel, flexShrink: 0, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
          <Bar w={42} h={42} r="13px" />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}><Bar w={180} h={16} /><Bar w={90} h={16} r="var(--r-pill)" /></div>
            <Bar w={220} h={9} />
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: narrow ? "column" : "row", gap: 14 }}>
          {sidebar ? (
            <div className="neu-raised" style={{ ...panel, width: narrow ? "auto" : SIDEBAR_WIDTH, flexShrink: 0, minHeight: 0, overflowY: "auto" }}>{sidebar}</div>
          ) : (
            <div className="neu-raised animate-pulse" style={{ ...panel, width: narrow ? "auto" : SIDEBAR_WIDTH, flexShrink: 0, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              <Bar w={80} h={8} />
              <Bar w="100%" h={48} r="var(--r-surface)" />
              {[0, 1, 2].map((i) => (
                <div key={i} style={{ display: "flex", gap: 10 }}>
                  <Bar w={26} h={26} r="var(--r-button)" />
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}><Bar w="70%" h={11} /><Bar w="90%" h={9} /></div>
                </div>
              ))}
              <Bar w={70} h={8} style={{ marginTop: 8 }} />
              <div style={{ display: "flex", gap: 8 }}><Bar w={70} h={26} r="var(--r-pill)" /><Bar w={110} h={26} r="var(--r-pill)" /></div>
            </div>
          )}
          <div className="glass animate-pulse" style={{ ...panel, background: undefined, flex: 1, minWidth: 0, minHeight: narrow ? 520 : 0, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}><Bar w={120} h={18} /><Bar w={90} h={28} r="var(--r-pill)" /></div>
            <Bar w="100%" h={36} r="var(--r-pill)" />
            <Bar w="100%" h={36} r="var(--r-pill)" />
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 6 }}>
              <Bubble w="22%" />
              <Bubble right w="58%" />
              <Bubble w="46%" />
              <Bubble right w="64%" />
              <Bubble w="34%" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
