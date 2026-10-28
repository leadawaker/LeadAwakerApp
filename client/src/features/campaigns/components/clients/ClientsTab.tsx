/**
 * The demo persona library (specs/demo-persona-library/plan.md, phase 1),
 * shown as the "Demo personas" tab of the Demos page and as the Clients tab
 * of the Campaigns page.
 *
 * The personas in category (or date) sections, newest first inside each, as small
 * cards side by side while none is open. Opening one puts its editor beside the
 * list, which turns into a vertical rail of rows, or over it when there is no room
 * for both. That switch is a container query in clients.css, not a viewport check,
 * because the Campaigns page gives this tab far less width than the Demos page does
 * on the same screen.
 *
 * "Which Client is open" is controlled by the parent (selectedNiche /
 * onSelectNiche), not local state here: on the Campaigns page the topbar's
 * "..." menu (ClientActionsMenu.tsx) needs to know which Client is open too,
 * and that topbar is a sibling of this tab's body. The Demos page has no such
 * topbar slot, so it passes `showActions` and the menu sits in the panel header.
 *
 * The filters and the grouping follow the same split: the Demos page owns them
 * (`view`) and shows them in its topbar (ClientsTopbarActions); with no `view`,
 * as on the Campaigns page, the tab keeps its own and shows the inline filter bar.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { SearchX, UsersRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDemoClients } from "../../api/demoClientsApi";
import { ClientActionsMenu } from "./ClientActionsMenu";
import { ClientEditor } from "./ClientEditor";
import { ClientGroupSection } from "./ClientGroupSection";
import { ClientsFilters } from "./ClientsFilters";
import { ClientsHero } from "./ClientsHero";
import { GroupBySwitch } from "./GroupBySwitch";
import { PersonaDeleteDialog } from "./PersonaDeleteDialog";
import {
  DEFAULT_PERSONA_FILTERS,
  hasActiveFilters,
  languageCounts,
  personaCategories,
  personaMatches,
} from "./personaFilters";
import { formatPersonaDate, groupPersonas, listLayout } from "./personaView";
import { usePersonaView, type PersonaView } from "./usePersonaView";
import "@/features/automation/automation.css";
import "./clients.css";

export function ClientsTab({
  selectedNiche,
  onSelectNiche,
  showActions = false,
  view,
}: {
  selectedNiche: string | null;
  onSelectNiche: (niche: string | null) => void;
  /** Put the duplicate/delete menu in the panel header (for a parent with no topbar slot for it). */
  showActions?: boolean;
  /** The filters and grouping, owned by a parent that shows them in its topbar. Omit for the inline filter bar. */
  view?: PersonaView;
}) {
  const { t, i18n } = useTranslation("campaigns");
  const { t: td } = useTranslation("demos");
  const { data: clients, isLoading } = useDemoClients();
  const own = usePersonaView();
  const { filters, setFilters, groupBy, setGroupBy } = view ?? own;
  const listRef = useRef<HTMLDivElement>(null);
  // The persona whose Delete confirmation is open (from a row's trash button).
  const [deleting, setDeleting] = useState<string | null>(null);

  const all = clients ?? [];
  const langCounts = useMemo(() => languageCounts(all), [clients]);
  const categories = useMemo(() => personaCategories(all), [clients]);
  const filtered = useMemo(() => all.filter((c) => personaMatches(c, filters)), [clients, filters]);
  const groups = useMemo(() => groupPersonas(filtered, groupBy, { locale: i18n.language }), [filtered, groupBy, i18n.language]);

  const categoryCount = categories.length;
  const layout = listLayout(selectedNiche);

  const formatDate = useMemo(() => {
    const now = new Date();
    return (iso: string) => formatPersonaDate(iso, now, i18n.language);
  }, [i18n.language]);

  // Opening a persona turns the cards into a rail of rows, and closing it turns them
  // back: either moves every item, so bring that persona back into view. On close the
  // editor (where focus was) is gone, so hand focus to the persona's own card.
  const wasOpen = useRef<string | null>(null);
  useEffect(() => {
    const niche = selectedNiche ?? wasOpen.current;
    wasOpen.current = selectedNiche;
    if (!niche) return;
    const item = Array.from(listRef.current?.querySelectorAll<HTMLElement>("[data-niche]") ?? []).find(
      (el) => el.dataset.niche === niche,
    );
    item?.scrollIntoView({ block: "nearest" });
    if (!selectedNiche && (!document.activeElement || document.activeElement === document.body)) {
      item?.querySelector<HTMLElement>(".dp-open")?.focus({ preventScroll: true });
    }
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

                {!view && (
                  <ClientsFilters
                    filters={filters}
                    onChange={setFilters}
                    categories={categories}
                    counts={langCounts}
                    trailing={<GroupBySwitch value={groupBy} onChange={setGroupBy} />}
                  />
                )}

                {groups.length > 0 && layout === "rows" && (
                  <div className="dp-captions" aria-hidden>
                    <span /><span>{t("clients.captions.persona")}</span><span>{t("clients.captions.languages")}</span>
                    <span style={{ textAlign: "right" }}>{td("personaList.captions.added")}</span><span /><span />
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
                  <ClientGroupSection
                    key={`${g.kind}:${g.key}`}
                    group={g}
                    layout={layout}
                    selectedNiche={selectedNiche}
                    formatDate={formatDate}
                    onSelect={onSelectNiche}
                    onDelete={setDeleting}
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

      {deleting && (
        <PersonaDeleteDialog
          niche={deleting}
          onClose={() => setDeleting(null)}
          // Deleting the persona that is open closes its editor too.
          onDeleted={() => { if (deleting === selectedNiche) onSelectNiche(null); }}
        />
      )}
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
