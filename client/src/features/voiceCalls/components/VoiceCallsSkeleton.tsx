/**
 * Loading shapes for the Voice calls page, in the same layout as the real
 * thing: a list of call rows, and a call detail with the lead's titled cards
 * on the left and the conversation on the right, all inside the centered
 * DETAIL_MAX_WIDTH column.
 */
import { ListSection } from "@/components/crm/primitives";

export const DETAIL_MAX_WIDTH = 1100;
export const SIDEBAR_WIDTH = 380;

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

/** A section title on the ground, in place of Calls, Summary or Details. */
function SectionTitle({ w }: { w: number }) {
  return <Bar w={w} h={14} r="var(--r-pill)" style={{ marginBlock: 3 }} />;
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
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: narrow ? "column" : "row", gap: 14 }}>
          {sidebar ? (
            <div className="neu-raised" style={{ ...panel, width: narrow ? "auto" : SIDEBAR_WIDTH, flexShrink: 0, minHeight: 0, overflowY: "auto" }}>{sidebar}</div>
          ) : (
            <div className="animate-pulse" style={{ width: narrow ? "auto" : SIDEBAR_WIDTH, flexShrink: 0 }}>
              <ListSection label={<SectionTitle w={64} />}>
                <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <Bar w={56} h={56} r="28%" />
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7 }}><Bar w="60%" h={14} /><Bar w="40%" h={9} /></div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}><Bar w={36} h={36} r="50%" /><Bar w={36} h={36} r="50%" /><Bar w={36} h={36} r="50%" /></div>
                </div>
              </ListSection>
              <ListSection label={<SectionTitle w={84} />}>
                <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}><Bar w="100%" h={10} /><Bar w="92%" h={10} /><Bar w="70%" h={10} /></div>
              </ListSection>
              <ListSection label={<SectionTitle w={72} />}>
                <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                  {[0, 1, 2].map((i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between" }}><Bar w={80} h={9} /><Bar w={110} h={9} /></div>
                  ))}
                </div>
              </ListSection>
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
