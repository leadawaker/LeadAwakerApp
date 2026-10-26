// The ElevenLabs prompt draft against the live text, line by line (draft card, Changes view).
// Long unchanged stretches fold into one row so the edits stand out.
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { EDITOR_HEIGHT } from "../SharedPromptCard";
import { lineDiff, type DiffLine } from "./lineDiff";

const FOLD_OVER = 3;

type Row = DiffLine | { kind: "fold"; count: number };

function foldRows(lines: DiffLine[]): Row[] {
  const rows: Row[] = [];
  let run: DiffLine[] = [];
  const endRun = () => {
    if (run.length > FOLD_OVER) rows.push({ kind: "fold", count: run.length });
    else rows.push(...run);
    run = [];
  };
  for (const l of lines) {
    if (l.kind === "same") { run.push(l); continue; }
    endRun();
    rows.push(l);
  }
  endRun();
  return rows;
}

const LINE_STYLE: Record<DiffLine["kind"], React.CSSProperties> = {
  same: { color: "var(--ink-soft)" },
  add: { background: "var(--good-tint)", color: "var(--good)" },
  del: { background: "color-mix(in srgb, var(--stage-lost) 10%, transparent)", color: "var(--stage-lost)" },
};
const MARK: Record<DiffLine["kind"], string> = { same: " ", add: "+", del: "-" };

export function DraftDiff({ before, after }: { before: string; after: string }) {
  const { t } = useTranslation("voiceCoach");
  const rows = useMemo(() => foldRows(lineDiff(before, after)), [before, after]);
  const changed = rows.some((r) => r.kind === "add" || r.kind === "del");

  return (
    <div
      className="neu-inset-crisp"
      data-testid="voice-draft-diff"
      style={{
        height: EDITOR_HEIGHT, overflowY: "auto", padding: 12, borderRadius: "var(--r-card)",
        fontFamily: "var(--mono)", fontSize: 12.5, lineHeight: 1.6,
      }}
    >
      {!changed && <p style={{ margin: 8, fontFamily: "var(--sans)", fontSize: 12.5, color: "var(--mute)" }}>{t("draft.noChanges")}</p>}
      {changed && rows.map((r, i) => r.kind === "fold" ? (
        <div key={i} style={{ padding: "2px 8px", margin: "2px 0", color: "var(--mute)", fontStyle: "italic", fontFamily: "var(--sans)", fontSize: 11.5 }}>
          {t("draft.unchangedLines", { count: r.count })}
        </div>
      ) : (
        <div
          key={i}
          style={{ ...LINE_STYLE[r.kind], display: "flex", gap: 8, padding: "0 8px", borderRadius: 3, minHeight: "1.6em" }}
        >
          <span aria-hidden style={{ flexShrink: 0, userSelect: "none", opacity: 0.7 }}>{MARK[r.kind]}</span>
          <span style={{ flex: 1, minWidth: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere", textDecoration: r.kind === "del" ? "line-through" : undefined }}>{r.text}</span>
        </div>
      ))}
    </div>
  );
}
