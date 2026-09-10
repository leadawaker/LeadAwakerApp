import type { DemoSession } from "./api/demoSessionsApi";
import { serviceOf } from "./services";

/**
 * One prospect on the Demos page: who they are, and the link they hold for
 * each service.
 *
 * The row's `key` doubles as the prospect group id used when minting a further
 * service from this row. For links minted before grouping existed there is no
 * group to join, so the key is derived from the token — deterministically, so
 * the new link's group matches the key this row is already computed under and
 * the two land in the same row on the next refetch.
 */
export interface ProspectRow {
  key: string;
  firstName: string;
  companyName: string;
  clientNiche: string;
  language: string;
  /** The most recent link in the row: "when did I last send this prospect
   *  something", which is what the column is read for. */
  createdAt: string | null;
  /** Every token in the row, so a rename reaches all of them. */
  tokens: string[];
  byService: Record<string, DemoSession>;
  /** Links with no column to sit in: an older duplicate of a service already
   *  filled, or a link on a campaign that is not one of the services. Kept
   *  rather than dropped — a sent link must never vanish from this page. */
  extra: DemoSession[];
}

export function groupProspects(sessions: DemoSession[]): ProspectRow[] {
  const rows = new Map<string, ProspectRow>();

  for (const s of sessions) {
    const key = s.prospectGroup || `token:${s.token}`;
    let row = rows.get(key);
    if (!row) {
      row = {
        key,
        firstName: "",
        companyName: "",
        clientNiche: "",
        language: "",
        createdAt: null,
        tokens: [],
        byService: {},
        extra: [],
      };
      rows.set(key, row);
    }

    row.tokens.push(s.token);
    // The links in a row were minted from one form, so these agree; when they
    // don't (a rename that only reached some), the first non-empty value wins
    // and the row still renders something rather than an empty cell.
    if (!row.firstName) row.firstName = s.firstName;
    if (!row.companyName) row.companyName = s.companyName;
    if (!row.clientNiche) row.clientNiche = s.clientNiche;
    if (!row.language) row.language = s.language;
    if (s.createdAt && (!row.createdAt || s.createdAt > row.createdAt)) row.createdAt = s.createdAt;

    const svc = serviceOf(s);
    // Newest wins the cell: the list arrives newest-first, so a service minted
    // twice shows the link that was actually sent last.
    if (svc && !row.byService[svc]) row.byService[svc] = s;
    else row.extra.push(s);
  }

  return Array.from(rows.values());
}
