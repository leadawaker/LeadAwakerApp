// One home per lead: the Chats page list (LeadsCardView with the chat panel),
// with that lead selected through the `?lead=<id>` deep link that LeadsTable
// reads. Every in-app "open this lead" goes through these helpers; the retired
// /platform/leads and /platform/contacts/:id routes redirect here (pages/app.tsx).
import { setPersistedSelection } from "@/hooks/usePersistedSelection";

export const LEAD_HOME_PATH = "/platform/chat";

/** `/platform/chat?lead=<id>`: the lead's one home. */
export function leadPath(leadId: number | string): string {
  return `${LEAD_HOME_PATH}?lead=${encodeURIComponent(String(leadId))}`;
}

/** The `?lead=` id in a search string, or "" when it is missing or not a number. */
export function readLeadParam(search: string): string {
  try {
    const id = new URLSearchParams(search).get("lead");
    return id && /^\d+$/.test(id) ? id : "";
  } catch {
    return "";
  }
}

/**
 * Opens a lead in its home. Also writes the persisted selection, so a Chats
 * page that is already on screen switches to the lead without remounting.
 */
export function openLead(setLocation: (to: string) => void, leadId: number | string): void {
  try {
    setPersistedSelection("selected-lead-id", leadId);
  } catch {
    /* storage unavailable: the ?lead= link still selects it */
  }
  setLocation(leadPath(leadId));
}
