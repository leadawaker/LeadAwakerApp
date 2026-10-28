import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { DemoClientSummary } from "@/features/campaigns/api/demoClientsApi";
import { ClientActionsMenu } from "@/features/campaigns/components/clients/ClientActionsMenu";
import { ClientEditor } from "@/features/campaigns/components/clients/ClientEditor";
import { ClientsTab } from "@/features/campaigns/components/clients/ClientsTab";
import type { PersonaDecoration } from "@/features/campaigns/components/clients/personaDecoration";
import type { PersonaView } from "@/features/campaigns/components/clients/usePersonaView";
import {
  NO_PERSONA_KEY,
  WEBSITE_KEY,
  isSpecialKey,
  prospectSummary,
  prospectTexts,
  rowsForKey,
  visibleSpecialKeys,
} from "../../personaDemos";
import { nextSort } from "../../sessionsView";
import { PersonaCardMeta } from "./PersonaCardMeta";
import { PersonaDemosTab } from "./PersonaDemosTab";
import { SpecialPersonaCards } from "./SpecialPersonaCards";
import { SpecialPersonaPanel } from "./SpecialPersonaPanel";
import type { PersonaActivity } from "./usePersonaActivity";
import type { DemosPageState } from "./useDemosPageState";
import type { useProspectData } from "./useProspectData";

/**
 * The Personas tab of the Demos page: the persona library (ClientsTab) with what the Demos page
 * adds to it. Each card shows its prospect count and an activity dot; No persona and Website
 * visitors close the list as cards of their own; and an open card's panel starts with the Demos
 * tab (that card's prospects as a table), followed by the persona's own editor tabs.
 */
export function PersonasWithDemos({ state, view, data, activity, select, onAddProspect }: {
  state: DemosPageState;
  view: PersonaView;
  data: ReturnType<typeof useProspectData>;
  activity: PersonaActivity;
  /** Open (or close, with null) a card; marks the closed and the opened card seen. */
  select: (key: string | null) => void;
  /** Prefill the draft for this card and open the create panel. "" = No persona. */
  onAddProspect: (clientNiche: string) => void;
}) {
  const { t } = useTranslation("demos");
  const { split, dots, followUp } = activity;

  const decorate = (c: DemoClientSummary): PersonaDecoration => {
    const summary = prospectSummary(rowsForKey(split, c.niche));
    const dot = dots.get(c.niche) ?? null;
    return {
      meta: summary.prospects > 0 ? <PersonaCardMeta summary={summary} /> : undefined,
      dot,
      dotLabel: dot ? t(`merge.dot.${dot}`) : undefined,
    };
  };

  // The topbar search also finds a persona through its prospects' first names and companies.
  const searchExtra = useMemo(() => (c: DemoClientSummary) => prospectTexts(rowsForKey(split, c.niche)), [split]);

  const special = visibleSpecialKeys(split, dots, {
    filters: view.filters,
    followUp: state.followUp,
    selected: state.selected,
  }).map((key) => ({ key, rows: rowsForKey(split, key), dot: dots.get(key) ?? null }));

  const renderPanel = (key: string, close: () => void) => {
    const website = key === WEBSITE_KEY;
    const tab = (
      <PersonaDemosTab
        rows={rowsForKey(split, key)}
        isLoading={data.isLoading}
        error={data.error}
        onRetry={data.refresh}
        sort={state.sort}
        onSort={(k) => state.setSort(nextSort(state.sort, k))}
        highlightKey={state.highlightKey}
        onHighlightShown={state.flash}
        onOpenRow={(rowKey) => state.setPanel({ kind: "detail", key: rowKey })}
        onAddProspect={website ? undefined : () => onAddProspect(key === NO_PERSONA_KEY ? "" : key)}
        emptyText={website ? t("merge.demosTab.emptyWebsite") : t("merge.demosTab.empty")}
      />
    );
    if (isSpecialKey(key)) {
      return <SpecialPersonaPanel kind={key} onBack={close}>{tab}</SpecialPersonaPanel>;
    }
    return (
      <ClientEditor
        niche={key}
        onBack={close}
        leadingView={{ label: t("merge.demosTab.label"), content: tab }}
        actions={
          <ClientActionsMenu
            variant="panel"
            niche={key}
            onDeleted={() => select(null)}
            onDuplicated={(newNiche) => select(newNiche)}
          />
        }
      />
    );
  };

  return (
    <ClientsTab
      selectedNiche={state.selected}
      onSelectNiche={select}
      view={view}
      decorate={decorate}
      onlyNiches={state.followUp ? followUp : null}
      onlyNichesEmpty={t("merge.followUpEmpty")}
      searchExtra={searchExtra}
      // null (not an empty element) when there is nothing: an element would hide ClientsTab's no-match state.
      trailing={(layout) =>
        special.length === 0 ? null : (
          <SpecialPersonaCards cards={special} layout={layout} selectedKey={state.selected} onSelect={select} />
        )
      }
      renderPanel={renderPanel}
    />
  );
}
