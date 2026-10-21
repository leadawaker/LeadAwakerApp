// The Settings tab: the three texts the AI works from, side by side on wide screens (caption style,
// voice guide, about me), each saved on its own. Agency sees all three; a client user sees only
// "Sobre mim" (a Manager edits it, a Viewer reads it). The server answers clients without the other two.
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { fetchSocialSettings, socialSettingsKey } from "../api/studioApi";
import { canActOnSocial } from "../lib/socialState";
import { AboutMeCard } from "./settings/AboutMeCard";
import { CaptionStyleCard, VoiceGuideCard } from "./settings/AgencyTextCards";

export function SocialSettingsSection({ accountId }: { accountId: number }) {
  const { isAgencyUser, userRole } = useWorkspace();
  const { data, isLoading } = useQuery({ queryKey: socialSettingsKey(accountId), queryFn: () => fetchSocialSettings(accountId), staleTime: 30_000 });
  if (isLoading || !data) return <Loader2 size={14} className="animate-spin" style={{ color: "var(--mute-2)" }} />;

  // Three equal columns from about 1100px of width, two in the middle, one on a phone. auto-fit
  // collapses unused tracks, so a lone card (client view) is capped instead of stretching.
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: 16, alignItems: "stretch", maxWidth: isAgencyUser ? undefined : 760 }} data-testid="social-settings">
      {isAgencyUser && <CaptionStyleCard accountId={accountId} data={data} />}
      {isAgencyUser && <VoiceGuideCard accountId={accountId} data={data} />}
      <AboutMeCard accountId={accountId} data={data} canEdit={canActOnSocial({ isAgency: isAgencyUser, userRole })} />
    </div>
  );
}
