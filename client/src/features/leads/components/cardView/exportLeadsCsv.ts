// CSV export for the Leads card view. Exports the currently-filtered leads
// (name, phone, email, status, score, campaign, account, booked date).
import { getLeadId, getFullName, getStatus, getScore, getPhone } from "./leadUtils";

function csvEscape(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function exportLeadsCsv(
  leads: Record<string, any>[],
  campaignsById?: Map<number, { name: string }>,
  accountsById?: Map<number, string>,
) {
  const headers = ["ID", "Name", "Phone", "Email", "Status", "Score", "Campaign", "Account", "Booked Date"];
  const rows = leads.map((l) => {
    const cId = Number(l.Campaigns_id ?? l.campaigns_id ?? l.campaignsId ?? 0);
    const aId = Number(l.Accounts_id ?? l.account_id ?? l.accounts_id ?? 0);
    return [
      getLeadId(l),
      getFullName(l),
      getPhone(l),
      l.email || l.Email || "",
      getStatus(l),
      getScore(l),
      (cId && campaignsById?.get(cId)?.name) || "",
      (aId && accountsById?.get(aId)) || "",
      l.booked_call_date || l.bookedCallDate || "",
    ].map(csvEscape).join(",");
  });
  const csv = [headers.join(","), ...rows].join("\n");
  // Prepend BOM so Excel reads UTF-8 correctly.
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `leads-export-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
