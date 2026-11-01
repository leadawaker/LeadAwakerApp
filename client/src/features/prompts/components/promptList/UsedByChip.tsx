// "Used by": which campaigns run a prompt, as a small "N campaigns" chip that
// opens a list grouped by account. Active campaigns by default, with a switch for
// the rest. In the prompt's header the list also holds its linked-campaign picker.
import { useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { CampaignForPreview } from "../../utils/resolveVariables";

const isActive = (c: CampaignForPreview) => String(c.status ?? "").toLowerCase().trim() === "active";
const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

function uniqueById(list: CampaignForPreview[]): CampaignForPreview[] {
  const seen = new Set<number>();
  return list.filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)));
}

/** The chip's text: active campaigns only, the same count the list opens on. */
export function usedByLabel(usedBy: CampaignForPreview[], t: TFunction): string {
  const all = uniqueById(usedBy);
  const active = all.filter(isActive).length;
  if (active > 0) return t("usedBy.count", { count: active });
  return t(all.length > 0 ? "usedBy.noActive" : "usedBy.none");
}

export function UsedByChip({ usedBy, accountNames, footer }: {
  usedBy: CampaignForPreview[];
  accountNames: Map<number, string>;
  /** Extra content under the list (the header's linked-campaign picker). */
  footer?: ReactNode;
}) {
  const { t } = useTranslation("prompts");
  const [showAll, setShowAll] = useState(false);
  const label = usedByLabel(usedBy, t);
  const all = useMemo(() => uniqueById(usedBy), [usedBy]);
  const inactiveCount = all.filter((c) => !isActive(c)).length;

  const groups = useMemo(() => {
    const byAccount = new Map<string, CampaignForPreview[]>();
    for (const c of all) {
      if (!showAll && !isActive(c)) continue;
      const name = (c.accountsId && accountNames.get(c.accountsId)) || t("usedBy.noAccount");
      byAccount.set(name, [...(byAccount.get(name) ?? []), c]);
    }
    return [...byAccount.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [all, showAll, accountNames, t]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="neu-inset-super-crisp shrink-0"
          style={{
            fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink-soft)", border: "none",
            borderRadius: "var(--r-pill)", padding: "1px 7px", cursor: "pointer", whiteSpace: "nowrap",
          }}
          onClick={stop}
          onKeyDown={stop}
          aria-label={`${t("usedBy.title")}: ${label}`}
          title={t("usedBy.title")}
        >
          {label}
        </button>
      </PopoverTrigger>
      {/* React events bubble through the portal, so the list card must not see these. */}
      <PopoverContent align="start" className="w-72 p-0" onClick={stop} onKeyDown={stop}>
        <div className="flex items-center justify-between gap-2" style={{ padding: "10px 12px 6px" }}>
          <p style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)" }}>{t("usedBy.title")}</p>
          {inactiveCount > 0 && (
            <label className="flex items-center gap-1.5 cursor-pointer" style={{ fontSize: 11, color: "var(--mute)" }}>
              <input
                type="checkbox"
                checked={showAll}
                onChange={(e) => setShowAll(e.target.checked)}
                style={{ accentColor: "var(--wine)" }}
              />
              {t("usedBy.showInactive")}
            </label>
          )}
        </div>
        <div className="overflow-y-auto [scrollbar-width:thin]" style={{ maxHeight: 280, padding: "0 12px 10px" }}>
          {groups.length === 0 && (
            <p style={{ fontSize: 12, color: "var(--mute)", padding: "4px 0" }}>
              {t(all.length > 0 ? "usedBy.emptyActive" : "usedBy.empty")}
            </p>
          )}
          {groups.map(([account, list]) => (
            <div key={account} style={{ marginTop: 8 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: "var(--mute)", marginBottom: 3 }}>{account}</p>
              {list.map((c) => (
                <div key={c.id} className="flex items-center gap-2" style={{ padding: "3px 0" }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                    background: isActive(c) ? "var(--good)" : "var(--mute-2)",
                  }} />
                  <span className="truncate" style={{ fontSize: 12.5, color: "var(--ink)", flex: 1, minWidth: 0 }}>{c.name}</span>
                  {!isActive(c) && c.status && (
                    <span style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--mute-2)", flexShrink: 0 }}>
                      {t(`usedBy.status.${String(c.status).toLowerCase().trim()}`, { defaultValue: c.status })}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
        {footer && <div style={{ borderTop: "1px solid var(--line)", padding: "10px 12px" }}>{footer}</div>}
      </PopoverContent>
    </Popover>
  );
}
