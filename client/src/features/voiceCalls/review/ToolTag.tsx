// A tool the receptionist ran, as a tag: icon, name and (when known) engine time, tinted
// from the tool's tone token like the outcome pills. A running tool shows a spinner and
// fills in when it is done. `ToolLine` is the tag plus a short result, used inline in both
// transcripts (live and review). With a `detail` (toolDetail.ts: the review's readable
// reading of what the tool did) the line reads it, and hovering the tag shows the few
// values and found things in a card. Labels: i18n `test.tools.<key>`.
import type { CSSProperties, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ToolDetail } from "./toolDetail";
import { toolTag } from "./toolTags";
import { useToolLabel } from "./useToolLabel";

const FAILED_TONE = "hsl(var(--destructive))";

function chipStyle(tone: string): CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 5, minWidth: 0, maxWidth: "100%", flexShrink: 0,
    padding: "2px 8px", borderRadius: "var(--r-pill)", fontFamily: "var(--mono)", fontSize: 11, fontWeight: 600, lineHeight: 1.4,
    whiteSpace: "nowrap", cursor: "default",
    background: `color-mix(in srgb, ${tone} 13%, transparent)`,
    color: `color-mix(in srgb, ${tone} 78%, var(--ink))`,
    boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${tone} 35%, transparent)`,
  };
}

export interface ToolTagProps {
  name: string;
  /** Engine time in ms; shown after the name once known. */
  ms?: number | null;
  pending?: boolean;
  failed?: boolean;
  /** Hover text (arguments and result). */
  title?: string;
  /** Icon and name only. */
  compact?: boolean;
}

export function ToolTag({ name, ms = null, pending = false, failed = false, title, compact = false }: ToolTagProps) {
  const { t } = useTranslation("voiceTab");
  const tag = toolTag(name);
  const label = useToolLabel()(tag);
  const Icon = tag.icon;
  return (
    <span style={chipStyle(failed ? FAILED_TONE : tag.tone)} title={title ?? label} data-testid="voice-test-tool-tag"
      data-tool={tag.key} data-pending={pending || undefined} aria-busy={pending || undefined}>
      {pending ? <Loader2 size={11} className="animate-spin" aria-label={t("test.tools.running")} /> : <Icon size={11} aria-hidden />}
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
      {!compact && !pending && ms !== null && Number.isFinite(ms) && (
        <span style={{ fontWeight: 400, opacity: 0.8 }}>{t("test.panel.live.ms", { ms: Math.round(ms) })}</span>
      )}
    </span>
  );
}

/** The hover card: labelled values, then what was found (a short list, "+N more" after it). */
function DetailCard({ detail }: { detail: ToolDetail }) {
  const short = detail.items.length > 0 && detail.items.every((x) => x.length <= 8);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, lineHeight: 1.4, maxWidth: 320 }} data-testid="voice-test-tool-card">
      {detail.rows.map((r) => (
        <div key={r.label} style={{ display: "flex", gap: 8 }}>
          <span style={{ color: "var(--mute)", flexShrink: 0, minWidth: 56 }}>{r.label}</span>
          <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{r.value}</span>
        </div>
      ))}
      {detail.items.length > 0 && (
        <div style={{ display: "flex", flexDirection: short ? "row" : "column", flexWrap: "wrap", gap: short ? "2px 10px" : 3 }}>
          {detail.items.map((x, i) => <span key={i} style={{ overflowWrap: "anywhere", fontVariantNumeric: "tabular-nums" }}>{x}</span>)}
        </div>
      )}
      {detail.more && <span style={{ color: "var(--mute)" }}>{detail.more}</span>}
    </div>
  );
}

/**
 * The tag with a short result after it (one line, the full text on hover). With a `detail`
 * the result is its readable line (two lines at most) and the tag opens its card on hover.
 */
export function ToolLine({ tool, lead, detail, onClick }: {
  tool: { name: string; result: string; ms: number | null; pending?: boolean; failed?: boolean; title?: string };
  lead?: ReactNode;
  detail?: ToolDetail | null;
  onClick?: () => void;
}) {
  const { t } = useTranslation("voiceTab");
  const failed = tool.failed || detail?.failed;
  const card = !!detail && (detail.rows.length > 0 || detail.items.length > 0);
  const tag = <ToolTag name={tool.name} ms={tool.ms} pending={tool.pending} failed={failed} title={card ? "" : detail ? undefined : tool.title} />;
  const text: CSSProperties = { flex: 1, minWidth: 0, fontSize: 11.5, color: "var(--mute)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
  const body = (
    <>
      {lead}
      {card ? (
        <Tooltip>
          <TooltipTrigger asChild><span style={{ display: "inline-flex", minWidth: 0 }}>{tag}</span></TooltipTrigger>
          <TooltipContent side="top" align="start"><DetailCard detail={detail} /></TooltipContent>
        </Tooltip>
      ) : tag}
      {detail ? (
        <span style={{ ...text, color: failed ? FAILED_TONE : "var(--ink-soft)", whiteSpace: "normal", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflowWrap: "anywhere" }}>
          {detail.line}
        </span>
      ) : (
        <span style={text} title={tool.result}>
          {tool.failed && <>{t("test.panel.live.toolFailed")}{tool.result ? ": " : ""}</>}{tool.result}
        </span>
      )}
    </>
  );
  const base: CSSProperties = { display: "flex", alignItems: "center", gap: 8, minWidth: 0, width: "100%", padding: "3px 8px" };
  if (!onClick) return <div style={base} data-testid="voice-test-tool-line">{body}</div>;
  return (
    <button type="button" onClick={onClick} data-testid="voice-test-tool-line" className="hover:bg-[var(--wine-tint)]"
      style={{ ...base, border: "none", background: "transparent", textAlign: "left", cursor: "pointer", borderRadius: "var(--r-button)", color: "var(--ink)", transition: "background-color 150ms" }}>
      {body}
    </button>
  );
}
