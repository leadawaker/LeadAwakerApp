// The Variables panel's place beside a preview, shared by the chat and the voice
// preview: side by side on a wide column, taking turns with the text on a narrow one.
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Variable } from "lucide-react";

/** Below this column width the text and the panel can't share a row. */
const SIDE_BY_SIDE_MIN = 470;

export function useVariablesLayout(variablesOpen: boolean, onToggleVariables: () => void) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [narrow, setNarrow] = useState(false);
  // On a narrow column the panel replaces the text, and only when asked for.
  const [panelInstead, setPanelInstead] = useState(false);
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setNarrow(entry!.contentRect.width < SIDE_BY_SIDE_MIN));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const panelShown = narrow ? panelInstead : variablesOpen;
  return {
    rootRef,
    narrow,
    panelShown,
    textShown: !(narrow && panelShown),
    toggle: () => (narrow ? setPanelInstead((v) => !v) : onToggleVariables()),
  };
}

export function VariablesToggle({ shown, narrow, count, onClick }: {
  shown: boolean;
  narrow: boolean;
  count: number;
  onClick: () => void;
}) {
  const { t } = useTranslation("prompts");
  return (
    <button
      type="button"
      onClick={onClick}
      className={shown ? "la-btn la-btn--soft on shrink-0" : "la-btn la-btn--soft shrink-0"}
      style={{ height: 26, padding: "0 9px", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5 }}
      title={t("vars.toggle")}
      aria-label={t("vars.toggle")}
      aria-pressed={shown}
    >
      <Variable size={13} /> {!narrow && t("vars.title")}
      <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--mute)" }}>{count}</span>
    </button>
  );
}
