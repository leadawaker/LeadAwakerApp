import { useIsMobile } from "@/hooks/useIsMobile";
import { GroupBySwitch } from "@/features/campaigns/components/clients/GroupBySwitch";
import type { PersonaView } from "@/features/campaigns/components/clients/usePersonaView";
import { SessionsViewSwitch } from "./sessions/SessionsViewSwitch";
import type { SessionsState } from "./sessions/useSessionsState";

/**
 * The page's one view switch, in the topbar's left group right after the main tabs, in the same
 * place on both tabs that have one: Table | Cards on Sessions, Category | Date on Demo personas
 * (Settings has none). A thin divider and a gap set it apart from the tabs. Each tab's state is
 * the page's own (one call each in DemosPage), so switching tabs never resets a choice.
 */
export function DemosViewSwitch({ tab, sessions, personas }: {
  tab: "sessions" | "clients" | "settings";
  sessions: SessionsState;
  personas: PersonaView;
}) {
  const isPhone = useIsMobile(768);
  if (tab === "settings") return null;
  return (
    <div className="ml-2 flex items-center gap-3">
      <span aria-hidden className="h-5 w-px shrink-0" style={{ background: "var(--line-strong)" }} />
      {tab === "sessions" ? (
        <SessionsViewSwitch view={sessions.view} onView={sessions.setView} />
      ) : (
        <GroupBySwitch value={personas.groupBy} onChange={personas.setGroupBy} compact={isPhone} />
      )}
    </div>
  );
}
