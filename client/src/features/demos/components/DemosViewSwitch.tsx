import { useIsMobile } from "@/hooks/useIsMobile";
import { GroupBySwitch } from "@/features/campaigns/components/clients/GroupBySwitch";
import type { PersonaView } from "@/features/campaigns/components/clients/usePersonaView";

/**
 * The page's one view switch, in the topbar's left group right after the main tabs: Category | Date
 * on Personas (Settings has none). A thin divider and a gap set it apart from the tabs. The
 * persona view is the page's own (one call in DemosPage), so switching tabs never resets a choice.
 */
export function DemosViewSwitch({ tab, personas }: {
  tab: "personas" | "settings";
  personas: PersonaView;
}) {
  const isPhone = useIsMobile(768);
  if (tab === "settings") return null;
  return (
    <div className="ml-2 flex items-center gap-3">
      <span aria-hidden className="h-5 w-px shrink-0" style={{ background: "var(--line-strong)" }} />
      <GroupBySwitch value={personas.groupBy} onChange={personas.setGroupBy} compact={isPhone} />
    </div>
  );
}
