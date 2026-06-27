import { useMemo, useState } from "react";
import { CrmShell } from "@/components/crm/CrmShell";
import { cn } from "@/lib/utils";
import { mockSpeedToLeadCampaigns } from "../data/mockMetrics";
import { SpeedToLeadListPanel } from "../components/SpeedToLeadListPanel";
import { SpeedToLeadTopbar, type SpeedToLeadTab } from "../components/SpeedToLeadTopbar";
import { SpeedToLeadDetailView } from "../components/SpeedToLeadDetailView";

function SpeedToLeadContent() {
  const [tab, setTab] = useState<SpeedToLeadTab>("performance");
  const [search, setSearch] = useState("");
  const [listHidden, setListHidden] = useState(false);
  const [selectedId, setSelectedId] = useState<number>(mockSpeedToLeadCampaigns[0]?.id ?? 0);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return mockSpeedToLeadCampaigns;
    return mockSpeedToLeadCampaigns.filter(
      (c) => c.name.toLowerCase().includes(q) || c.accountName.toLowerCase().includes(q),
    );
  }, [search]);

  const selected = mockSpeedToLeadCampaigns.find((c) => c.id === selectedId) ?? filtered[0] ?? null;

  return (
    <div className="flex flex-col h-full w-full" data-testid="page-speed-to-lead">
      <SpeedToLeadTopbar
        count={filtered.length}
        tab={tab}
        onTabChange={setTab}
        search={search}
        onSearchChange={setSearch}
        listHidden={listHidden}
        onToggleList={() => setListHidden((v) => !v)}
      />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className={cn("h-full min-h-0", listHidden ? "hidden" : "flex")}>
          <SpeedToLeadListPanel
            campaigns={filtered}
            selectedId={selected?.id ?? null}
            onSelect={setSelectedId}
          />
        </div>

        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          {selected ? (
            <SpeedToLeadDetailView campaign={selected} tab={tab} />
          ) : (
            <div className="flex-1" />
          )}
        </div>
      </div>
    </div>
  );
}

export function SpeedToLeadPage() {
  return (
    <CrmShell>
      <SpeedToLeadContent />
    </CrmShell>
  );
}
