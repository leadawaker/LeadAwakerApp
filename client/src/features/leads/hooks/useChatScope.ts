// The Chats page's Live / Demo tab, remembered per user. Demo is the Owner's (as on the Calls
// page): everyone else always reads Live, whatever an old saved choice says. Until the Owner
// picks, it opens on Demo, like Calls.
import { usePersistedState } from "@/hooks/usePersistedState";
import { useWorkspace } from "@/hooks/useWorkspace";

export type ChatScope = "live" | "demo";

export function useChatScope(): { scope: ChatScope; setScope: (s: ChatScope) => void; canDemo: boolean } {
  const { isOwner } = useWorkspace();
  const [stored, setStored] = usePersistedState<ChatScope>("chats-scope", "demo", (v) => v === "live" || v === "demo");
  return { scope: isOwner ? stored : "live", setScope: setStored, canDemo: isOwner };
}
