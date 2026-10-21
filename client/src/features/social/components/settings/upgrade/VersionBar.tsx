// The version switcher above an upgradeable editor: "Original" (the saved text) and one pill per
// upgrade pass. Picking one loads it into the editor; the active version's change list shows below.
import { useTranslation } from "react-i18next";
import type { VersionsState } from "./upgradeState";

export function VersionBar({ state, onSelect, dirty }: { state: VersionsState; onSelect: (i: number) => void; dirty: boolean }) {
  const { t } = useTranslation("social");
  if (state.versions.length < 2) return null;
  const active = state.versions[state.active];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }} data-testid="upgrade-versions">
      <div className="row" style={{ gap: 6, flexWrap: "wrap", alignItems: "center" }} role="group" aria-label={t("upgrade.versions")}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--mute)" }}>{t("upgrade.versions")}</span>
        {state.versions.map((_, i) => (
          <button key={i} type="button" className={`la-btn la-btn--pill ${i === state.active ? "la-btn--wine" : "la-btn--soft"}`} aria-pressed={i === state.active}
            onClick={() => onSelect(i)} data-testid={`upgrade-version-${i}`}>
            {i === 0 ? t("upgrade.original") : t("upgrade.version", { n: i })}
          </button>
        ))}
      </div>
      {state.active > 0 && (
        <div style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.5 }}>
          <strong style={{ fontWeight: 600 }}>{t("upgrade.changes")}</strong>
          {active.changes.length ? (
            <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>{active.changes.map((c, i) => <li key={i}>{c}</li>)}</ul>
          ) : (
            <span style={{ color: "var(--mute)" }}> {t("upgrade.noChanges")}</span>
          )}
        </div>
      )}
      {dirty && <span style={{ fontSize: 12, color: "var(--mute)" }}>{t("upgrade.unsaved")}</span>}
    </div>
  );
}
