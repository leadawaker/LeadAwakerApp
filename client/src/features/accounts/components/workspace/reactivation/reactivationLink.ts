// The way into Accounts > Reactivation from elsewhere (Home > Reactivation):
// select the account, then /platform/accounts?tab=reactivation with the
// campaign to open (&campaign=<id>), the settings section (&section=), or the
// New campaign panel (&new=1). Agency only: clients have no Reactivation tab.
import { setPersistedSelection } from "@/hooks/usePersistedSelection";

export type ReactivationSection = "business" | "ai" | "behavior";

export interface ReactivationDeepLink {
  campaignId: number | null;
  section: ReactivationSection | null;
  create: boolean;
}

export function reactivationHref(opts: { campaignId?: number | null; section?: ReactivationSection; create?: boolean } = {}): string {
  const qs = new URLSearchParams({ tab: "reactivation" });
  if (opts.campaignId) qs.set("campaign", String(opts.campaignId));
  if (opts.section) qs.set("section", opts.section);
  if (opts.create) qs.set("new", "1");
  return `/platform/accounts?${qs.toString()}`;
}

/** Select the account (when known) and go to its Reactivation tab. */
export function openAccountReactivation(
  setLocation: (to: string) => void,
  accountId: number | null | undefined,
  opts: { campaignId?: number | null; section?: ReactivationSection; create?: boolean } = {},
) {
  if (accountId && accountId > 0) setPersistedSelection("selected-account-id", String(accountId));
  setLocation(reactivationHref(opts));
}

// Like the workspace's ?tab= memo: the link survives a remount of the tab
// within a few seconds, and is cleared once it has been applied.
let memo: { link: ReactivationDeepLink; at: number } | null = null;

export function readReactivationDeepLink(): ReactivationDeepLink | null {
  const params = new URLSearchParams(window.location.search);
  const id = Number(params.get("campaign"));
  const section = params.get("section");
  const create = params.get("new") === "1";
  const campaignId = Number.isSafeInteger(id) && id > 0 ? id : null;
  if (campaignId || create || section) {
    const link: ReactivationDeepLink = {
      campaignId,
      section: section === "business" || section === "ai" || section === "behavior" ? section : null,
      create,
    };
    memo = { link, at: Date.now() };
    return link;
  }
  return memo && Date.now() - memo.at < 15000 ? memo.link : null;
}

/** The user picked a campaign or closed the panel by hand: a remount must not re-apply the link. */
export function forgetReactivationDeepLink() {
  memo = null;
}

/** Strip the reactivation params from the URL once applied (the memo lives on for a remount). */
export function stripReactivationDeepLink() {
  const params = new URLSearchParams(window.location.search);
  if (!params.has("campaign") && !params.has("section") && !params.has("new")) return;
  params.delete("campaign");
  params.delete("section");
  params.delete("new");
  const qs = params.toString();
  window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : ""));
}
