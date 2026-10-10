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
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { SearchX, UsersRound } from "lucide-react";
import { SearchPill } from "@/components/ui/search-pill";
import { cn } from "@/lib/utils";
import { useDemoClients, type DemoClientSummary, type DemoLang } from "../../api/demoClientsApi";
import { ClientActionsMenu } from "./ClientActionsMenu";
import { ClientCategorySection } from "./ClientCategorySection";
import { ClientEditor } from "./ClientEditor";
import { ClientsHero } from "./ClientsHero";
import { LANGS } from "./clientDisplay";
import "@/features/automation/automation.css";
import "./clients.css";

type LangFilter = "all" | DemoLang;

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
  const { data: clients, isLoading } = useDemoClients();
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [lang, setLang] = useState<LangFilter>("all");
  const listRef = useRef<HTMLDivElement>(null);

  const all = clients ?? [];
  const langCounts = useMemo(() => {
    const counts: Record<LangFilter, number> = { all: all.length, en: 0, nl: 0, pt: 0 };
    for (const c of all) for (const l of c.languages) counts[l] += 1;
    return counts;
  }, [clients]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter((c) => {
      if (lang !== "all" && !c.languages.includes(lang)) return false;
      if (!q) return true;
      return (
        c.niche.toLowerCase().includes(q) ||
        c.label.toLowerCase().includes(q) ||
        c.companyName.toLowerCase().includes(q) ||
        (c.category ?? "").toLowerCase().includes(q)
      );
    });
  }, [clients, search, lang]);

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

                <div className="dp-filters">
                  <div className="la-seg la-seg--pill" role="tablist" aria-label={t("clients.filterLabel")}>
                    {(["all", ...LANGS] as LangFilter[]).map((f) => (
                      <button key={f} type="button" role="tab" aria-selected={lang === f} className={cn("la-seg-btn", lang === f && "on")} onClick={() => setLang(f)} data-testid={`personas-filter-${f}`}>
                        {f === "all" ? t("clients.filterAll") : f.toUpperCase()} <span className="dp-seg-count" style={{ opacity: 0.7 }}>{langCounts[f]}</span>
                      </button>
                    ))}
                  </div>
                  <div className="dp-search">
                    <SearchPill value={search} onChange={setSearch} open={searchOpen || !!search} onOpenChange={setSearchOpen} placeholder={t("clients.searchPlaceholder", "Search personas...")} />
                  </div>
                </div>

                {groups.length > 0 && (
                  <div className="dp-captions" aria-hidden>
                    <span /><span>{t("clients.captions.persona")}</span><span>{t("clients.captions.languages")}</span>
                    <span style={{ textAlign: "right" }}>{t("clients.captions.updated")}</span><span style={{ textAlign: "right" }}>{t("clients.captions.id")}</span><span />
                  </div>
                )}
                {groups.length === 0 && (
                  <EmptyState icon={SearchX} title={t("clients.noMatchesTitle")} body={search.trim() ? t("clients.noMatches") : t("clients.noMatchesLanguage")} />
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

function EmptyState({ icon: Icon, title, body }: { icon: typeof UsersRound; title: string; body: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 10, padding: "64px 12px" }}>
      <span className="am-icon-tile" style={{ width: 48, height: 48, color: "var(--mute)" }}><Icon className="h-5 w-5" /></span>
      <div className="serif" style={{ fontSize: 20, color: "var(--ink)" }}>{title}</div>
      <p style={{ fontSize: 13.5, color: "var(--mute)", maxWidth: 380, lineHeight: 1.55, margin: 0 }}>{body}</p>
    </div>
  );
}
