import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiUtils";
import { toCampaignRow, toContractRow, toTeamMember } from "./adapters";
import type { CampaignRowData, ContractRowData, TeamMemberData } from "./types";

interface AccountDetailData {
  campaigns: CampaignRowData[];
  contracts: ContractRowData[];
  team: TeamMemberData[];
  leadCount: number | null;
  loadingCampaigns: boolean;
  loadingContracts: boolean;
  loadingTeam: boolean;
  refresh: () => void;
}

async function fetchList(url: string): Promise<any[]> {
  const res = await apiFetch(url);
  const data = await res.json();
  return Array.isArray(data) ? data : (data?.list ?? data?.data ?? []);
}

/**
 * Per-account related data: campaigns, contracts, team members, lead count.
 * Contract rows are linked to their campaign (campaignId) so panels can pair them.
 */
export function useAccountDetailData(accountId: number): AccountDetailData {
  const [campaigns, setCampaigns] = useState<CampaignRowData[]>([]);
  const [contracts, setContracts] = useState<ContractRowData[]>([]);
  const [team, setTeam] = useState<TeamMemberData[]>([]);
  const [leadCount, setLeadCount] = useState<number | null>(null);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [loadingContracts, setLoadingContracts] = useState(true);
  const [loadingTeam, setLoadingTeam] = useState(true);
  const [nonce, setNonce] = useState(0);

  const refresh = () => setNonce((n) => n + 1);

  useEffect(() => {
    if (!accountId) return;
    let alive = true;

    setLoadingCampaigns(true);
    fetchList(`/api/campaigns?accountId=${accountId}`)
      .then((list) => { if (alive) setCampaigns(list.map(toCampaignRow)); })
      .catch(() => { if (alive) setCampaigns([]); })
      .finally(() => { if (alive) setLoadingCampaigns(false); });

    setLoadingContracts(true);
    fetchList(`/api/contracts?accountId=${accountId}`)
      .then((list) => { if (alive) setContracts(list.map(toContractRow)); })
      .catch(() => { if (alive) setContracts([]); })
      .finally(() => { if (alive) setLoadingContracts(false); });

    setLoadingTeam(true);
    fetchList(`/api/users`)
      .then((list) => {
        if (!alive) return;
        const filtered = list.filter((u: any) => {
          const uid = u.accountsId ?? u.Accounts_id ?? u.accounts_id ?? u.account_id;
          return uid === accountId;
        });
        setTeam(filtered.map(toTeamMember));
      })
      .catch(() => { if (alive) setTeam([]); })
      .finally(() => { if (alive) setLoadingTeam(false); });

    setLeadCount(null);
    apiFetch(`/api/leads?accountId=${accountId}&page=1&limit=1`)
      .then((r) => r.json())
      .then((data: any) => {
        if (!alive) return;
        const total = data?.total ?? data?.pagination?.total ?? null;
        setLeadCount(typeof total === "number" ? total : null);
      })
      .catch(() => { if (alive) setLeadCount(null); });

    return () => { alive = false; };
  }, [accountId, nonce]);

  return {
    campaigns,
    contracts,
    team,
    leadCount,
    loadingCampaigns,
    loadingContracts,
    loadingTeam,
    refresh,
  };
}
