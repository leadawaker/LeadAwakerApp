export interface OnboardingPrefs {
  dismissed?: boolean;
  visited?: { receptionist?: boolean; call?: boolean };
  installed?: boolean;
}
export type ChecklistKey = "details" | "alerts" | "call" | "install";

interface Input {
  prefs: OnboardingPrefs;
  recipients: { email?: string | null; phone?: string | null }[];
  userEmail: string | null;
  userPhone: string | null;
  standalone: boolean;
}

const normEmail = (v?: string | null) => (v ?? "").trim().toLowerCase();
const normPhone = (v?: string | null) => (v ?? "").replace(/[^\d]/g, "");

export function buildChecklist(i: Input) {
  const email = normEmail(i.userEmail);
  const phone = normPhone(i.userPhone);
  const inAlerts = i.recipients.some(
    (r) => (email !== "" && normEmail(r.email) === email) || (phone !== "" && normPhone(r.phone) === phone),
  );
  const items: { key: ChecklistKey; done: boolean }[] = [
    { key: "details", done: !!i.prefs.visited?.receptionist },
    { key: "alerts", done: inAlerts },
    { key: "call", done: !!i.prefs.visited?.call },
    { key: "install", done: i.standalone || !!i.prefs.installed },
  ];
  const allDone = items.every((x) => x.done);
  return { items, allDone, visible: !i.prefs.dismissed && !allDone };
}
