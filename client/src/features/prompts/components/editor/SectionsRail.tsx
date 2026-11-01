// The editor's left rail: the prompt's markdown headings, with the one in view lit.
import { useTranslation } from "react-i18next";

export interface PromptHeading { level: number; text: string; lineIndex: number }

export function SectionsRail({ headings, activeH1, activeH2, onJump }: {
  headings: PromptHeading[];
  activeH1: number;
  activeH2: number;
  onJump: (lineIndex: number) => void;
}) {
  const { t } = useTranslation("prompts");
  return (
    <div className="[scrollbar-width:thin]" style={{ width: 148, flexShrink: 0, overflowY: "auto", padding: "12px 0" }}>
      {headings.length === 0 ? (
        <p style={{ fontSize: 11, color: "var(--mute-2)", padding: "0 12px" }}>{t("editor.noSections")}</p>
      ) : (
        <>
          <span style={{
            fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase",
            color: "var(--ink)", padding: "0 12px 5px", display: "block", fontWeight: 700,
          }}>
            {t("editor.sections")}
          </span>
          {headings.map((h) => {
            // Only the topmost-visible `#` and the topmost-visible `##` within it light up.
            const isActive = (h.level === 1 && h.lineIndex === activeH1) || (h.level === 2 && h.lineIndex === activeH2);
            return (
              <button
                key={h.lineIndex}
                type="button"
                onClick={() => onJump(h.lineIndex)}
                style={{
                  fontFamily: "var(--mono)", border: "none", background: "transparent", cursor: "pointer", textAlign: "left",
                  padding: h.level === 1 ? "3px 12px" : h.level === 2 ? "3px 12px 3px 20px" : "3px 12px 3px 28px",
                  fontSize: 9, fontWeight: isActive ? 700 : 500,
                  color: isActive ? "var(--ink)" : "var(--mute-2)", opacity: isActive ? 1 : 0.55,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block", width: "100%",
                }}
                title={h.text}
              >
                {h.text}
              </button>
            );
          })}
        </>
      )}
    </div>
  );
}
