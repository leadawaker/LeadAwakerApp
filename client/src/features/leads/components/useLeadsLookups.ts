// Name lookups for the Leads page: accounts, campaigns (with their service type
// and booking mode) and tags. Archived accounts/campaigns are left out so they
// never clutter filters or labels (Gabriel, 2026-06-21).
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiUtils";

export type CampaignInfo = { name: string; accountId: number | null; bookingMode: string | null; campaignType: string | null; bumpMode: string | null };

const listOf = (data: any): any[] => (Array.isArray(data) ? data : data?.list || data?.data || []);
const archived = (x: any) => String(x?.status || x?.Status || "").toLowerCase() === "archived";

export function useLeadsLookups(isAgencyView: boolean) {
  const [accountsById, setAccountsById] = useState<Map<number, string>>(new Map());
  const [campaignsById, setCampaignsById] = useState<Map<number, CampaignInfo>>(new Map());
  const [allTagsById, setAllTagsById] = useState<Map<number, { name: string; color: string }>>(new Map());

  useEffect(() => {
    apiFetch("/api/tags").then((r) => (r.ok ? r.json() : [])).then((data) => {
      const m = new Map<number, { name: string; color: string }>();
      listOf(data).forEach((tg: any) => m.set(Number(tg.id), { name: tg.name || `Tag ${tg.id}`, color: tg.color || "gray" }));
      setAllTagsById(m);
    }).catch((err) => console.error("Failed to fetch tags", err));
  }, []);

  useEffect(() => {
    if (!isAgencyView) return;
    apiFetch("/api/accounts").then((r) => (r.ok ? r.json() : [])).then((data) => {
      const m = new Map<number, string>();
      listOf(data).forEach((a: any) => { if (!archived(a)) m.set(Number(a.id ?? a.Id), a.name || a.Name || `Account ${a.id ?? a.Id}`); });
      setAccountsById(m);
    }).catch((err) => console.error("Failed to fetch accounts", err));
  }, [isAgencyView]);

  useEffect(() => {
    apiFetch("/api/campaigns").then((r) => (r.ok ? r.json() : [])).then((data) => {
      const m = new Map<number, CampaignInfo>();
      listOf(data).forEach((c: any) => {
        if (archived(c)) return;
        const id = Number(c.id ?? c.Id);
        m.set(id, {
          name: c.name || c.Name || c.campaign_name || `Campaign ${id}`,
          accountId: c.Accounts_id ?? c.accounts_id ?? c.accountsId ?? null,
          bookingMode: c.booking_mode_override ?? c.bookingModeOverride ?? null,
          campaignType: c.campaign_type ?? c.campaignType ?? null,
          bumpMode: c.bump_mode ?? c.bumpMode ?? null,
        });
      });
      setCampaignsById(m);
    }).catch((err) => console.error("Failed to fetch campaigns", err));
  }, []);

  return { accountsById, campaignsById, allTagsById };
}
