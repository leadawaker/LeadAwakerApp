// Presenting mode on the Chats page: the Owner hides lead names and phone numbers while
// screensharing. Same switch and stored choice as the Calls page (voiceCalls/usePresenting),
// so turning it on in one place masks the other too. Masking runs at the render edge only:
// edits, copies and sends still use the real values.
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff } from "lucide-react";
import { useVoiceCapabilities } from "@/features/voiceCalls/api/voiceCallsApi";
import { usePresenting } from "@/features/voiceCalls/usePresenting";
import { maskName, maskNumber, maskSpoken } from "@/features/voiceCalls/maskIdentity";
import { TopbarIconButton } from "@/components/crm/primitives/TopbarIconButton";
import { PresentingDrawerRow } from "@/features/voiceCalls/components/PresentingToggle";

interface ChatsPresenting {
  /** The Owner (the server grants voice `demo` only to the Owner who is not impersonating). */
  canToggle: boolean;
  masked: boolean;
  toggle: () => void;
}

const OFF: ChatsPresenting = { canToggle: false, masked: false, toggle: () => {} };
const Ctx = createContext<ChatsPresenting>(OFF);

function OwnerPresenting({ children }: { children: ReactNode }) {
  const isOwner = useVoiceCapabilities().data?.demo === true;
  const { masked, toggle } = usePresenting(isOwner);
  const value = useMemo(() => ({ canToggle: isOwner, masked, toggle }), [isOwner, masked, toggle]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Wrap the Chats page. Elsewhere (`enabled` false) nothing is masked and no toggle shows. */
export function ChatsPresentingProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  return enabled ? <OwnerPresenting>{children}</OwnerPresenting> : <>{children}</>;
}

export function useChatsPresenting(): ChatsPresenting {
  return useContext(Ctx);
}

/** Display helpers: the real value when not masked. */
export function presentName(name: string, masked: boolean): string {
  return masked ? maskName(name) ?? name : name;
}
export function presentNumber(phone: string, masked: boolean): string {
  return masked ? maskNumber(phone) ?? phone : phone;
}
/** Message text: numbers and the lead's name. Data URLs (voice notes, images) pass untouched. */
export function presentText(text: string, name: string, masked: boolean): string {
  if (!masked || !text || text.startsWith("data:")) return text;
  return maskSpoken(text, name);
}

/** The eye in the Chats topbar (desktop `topbar`), or the Hide / Show identities row in the phone header's tools drawer (`drawer`). Owner only. */
export function ChatsPresentingToggle({ variant = "topbar" }: { variant?: "topbar" | "drawer" }) {
  const { t } = useTranslation("leads");
  const { canToggle, masked, toggle } = useChatsPresenting();
  if (!canToggle) return null;
  const Icon = masked ? EyeOff : Eye;
  const label = masked ? t("presenting.on") : t("presenting.off");
  if (variant === "drawer") return <PresentingDrawerRow masked={masked} onToggle={toggle} testId="chats-presenting-toggle" />;
  return (
    <TopbarIconButton label={label} onClick={toggle} aria-pressed={masked} className={masked ? "on" : undefined} data-testid="chats-presenting-toggle">
      <Icon className="h-4 w-4 shrink-0" />
    </TopbarIconButton>
  );
}
