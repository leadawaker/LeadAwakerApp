/**
 * The demo persona library (specs/demo-persona-library/plan.md, phase 1),
 * shown as the "Demo personas" tab of the Demos page and as the Clients tab
 * of the Campaigns page.
 *
 * A list of personas grouped by category; opening one puts its editor beside
 * the list (the list narrows to a rail), or over it when there is no room
 * for both. That switch is a container query in clients.css, not a viewport
 * check, because the Campaigns page gives this tab far less width than the
 * Demos page does on the same screen.
 *
 * "Which Client is open" is controlled by the parent (selectedNiche /
 * onSelectNiche), not local state here: on the Campaigns page the topbar's
 * "..." menu (ClientActionsMenu.tsx) needs to know which Client is open too,
 * and that topbar is a sibling of this tab's body. The Demos page has no such
 * topbar slot, so it passes `showActions` and the menu sits in the panel header.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { SearchX, UsersRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDemoClients, type DemoClientSummary } from "../../api/demoClientsApi";
import { ClientActionsMenu } from "./ClientActionsMenu";
import { ClientCategorySection } from "./ClientCategorySection";
import { ClientEditor } from "./ClientEditor";
import { ClientsFilters } from "./ClientsFilters";
import { ClientsHero } from "./ClientsHero";
import {
  DEFAULT_PERSONA_FILTERS,
  hasActiveFilters,
  languageCounts,
  personaCategories,
  personaMatches,
  type PersonaFilters,
} from "./personaFilters";
import "@/features/automation/automation.css";
import "./clients.css";

export function ClientsTab({
  selectedNiche,
  onSelectNiche,
  showActions = false,
}: {
  selectedNiche: string | null;
  onSelectNiche: (niche: string | null) => void;
  /** Put the duplicate/delete menu in the panel header (for a parent with no topbar slot for it). */
  showActions?: boolean;
}) {
  const { t, i18n } = useTranslation("campaigns");
  const { t: td } = useTranslation("demos");
  const { data: clients, isLoading } = useDemoClients();
  const [filters, setFilters] = useState<PersonaFilters>(DEFAULT_PERSONA_FILTERS);
  const listRef = useRef<HTMLDivElement>(null);

  const all = clients ?? [];
  const langCounts = useMemo(() => languageCounts(all), [clients]);
  const categories = useMemo(() => personaCategories(all), [clients]);
  const filtered = useMemo(() => all.filter((c) => personaMatches(c, filters)), [clients, filters]);

  // Grouped by category, alphabetical, "Uncategorized" last. `key` is a
  // stable, collision-proof group identity separate from the display `label`:
  // a user can freely name a real category "Uncategorized" via
  // CategorySelect's free-text create without colliding with the synthetic
  // uncategorized bucket's React key.
  const groups = useMemo(() => {
    const byCategory = new Map<string, DemoClientSummary[]>();
    for (const c of filtered) {
      const key = (c.category ?? "").trim();
      if (!byCategory.has(key)) byCategory.set(key, []);
      byCategory.get(key)!.push(c);
    }
    const named = Array.from(byCategory.keys())
      .filter((k) => k !== "")
      .sort((a, b) => a.localeCompare(b))
      .map((label) => ({ key: label, label, uncategorized: false, items: byCategory.get(label)! }));
    const uncategorized = byCategory.get("");
    if (uncategorized?.length) {
      named.push({
        key: "__uncategorized__",
        label: t("clients.noCategory", "Uncategorized"),
        uncategorized: true,
        items: uncategorized,
      });
    }
    return named;
  }, [filtered, t]);

  const categoryCount = useMemo(() => new Set(all.map((c) => (c.category ?? "").trim()).filter(Boolean)).size, [clients]);

  const formatDate = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(i18n.language, { day: "numeric", month: "short" });
    return (iso: string) => fmt.format(new Date(iso));
  }, [i18n.language]);

  // Opening a persona narrows the list to a rail, which moves every row:
  // bring the open one back into view.
  useEffect(() => {
    if (!selectedNiche) return;
    const row = Array.from(listRef.current?.querySelectorAll<HTMLElement>("[data-niche]") ?? []).find(
      (el) => el.dataset.niche === selectedNiche,
    );
    row?.scrollIntoView({ block: "nearest" });
  }, [selectedNiche]);

  return (
    <div className={cn("dp-shell", selectedNiche && "is-open")} data-testid="personas-tab">
      <div className="dp-frame">
        <div className="dp-list" ref={listRef}>
          <div className="dp-list-inner">
            {isLoading ? (
              <>
                <div className="h-[168px] bg-primary/10 rounded-xl animate-pulse" />
                {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-[220px] bg-primary/10 rounded-xl animate-pulse" />)}
              </>
            ) : all.length === 0 ? (
              <EmptyState icon={UsersRound} title={t("clients.emptyTitle")} body={t("clients.emptyBody")} />
            ) : (
              <>
                <ClientsHero clients={all} categories={categoryCount} />

                <ClientsFilters filters={filters} onChange={setFilters} categories={categories} counts={langCounts} />

                {groups.length > 0 && (
                  <div className="dp-captions" aria-hidden>
                    <span>{t("clients.captions.persona")}</span><span>{t("clients.captions.languages")}</span>
                    <span style={{ textAlign: "right" }}>{t("clients.captions.updated")}</span><span style={{ textAlign: "right" }}>{t("clients.captions.id")}</span><span />
                  </div>
                )}
                {groups.length === 0 && (
                  <EmptyState
                    icon={SearchX}
                    title={t("clients.noMatchesTitle")}
                    body={
                      filters.category || filters.source !== "all"
                        ? td("personas.noMatchesFilters")
                        : filters.search.trim() ? t("clients.noMatches") : t("clients.noMatchesLanguage")
                    }
                    action={hasActiveFilters(filters) ? (
                      <button type="button" className="la-btn la-btn--soft dp-touch" onClick={() => setFilters(DEFAULT_PERSONA_FILTERS)}>
                        {td("personas.clearFilters")}
                      </button>
                    ) : undefined}
                  />
                )}
                {groups.map((g) => (
                  <ClientCategorySection
                    key={g.key}
                    label={g.label}
                    uncategorized={g.uncategorized}
                    items={g.items}
                    selectedNiche={selectedNiche}
                    formatDate={formatDate}
                    onSelect={onSelectNiche}
                  />
                ))}
              </>
            )}
          </div>
        </div>

        {selectedNiche && (
          <div className="dp-panel" data-testid="persona-panel">
            <ClientEditor
              niche={selectedNiche}
              onBack={() => onSelectNiche(null)}
              actions={showActions ? (
                <ClientActionsMenu
                  variant="panel"
                  niche={selectedNiche}
                  onDeleted={() => onSelectNiche(null)}
                  onDuplicated={(newNiche) => onSelectNiche(newNiche)}
                />
              ) : undefined}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, body, action }: { icon: typeof UsersRound; title: string; body: string; action?: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 10, padding: "64px 12px" }}>
      <span className="am-icon-tile" style={{ width: 48, height: 48, color: "var(--mute)" }}><Icon className="h-5 w-5" /></span>
      <div className="serif" style={{ fontSize: 20, color: "var(--ink)" }}>{title}</div>
      <p style={{ fontSize: 13.5, color: "var(--mute)", maxWidth: 380, lineHeight: 1.55, margin: 0 }}>{body}</p>
      {action}
    </div>
  );
}
