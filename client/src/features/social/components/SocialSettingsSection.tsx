// The Settings tab: the three texts the AI works from (caption style, voice guide, about me), each saved
// on its own. Agency sees all three; a client user sees only "Sobre mim" (a Manager edits it, a Viewer
// reads it). The server answers clients without the other two.
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { fetchSocialSettings, socialSettingsKey } from "../api/studioApi";
import { canActOnSocial } from "../lib/socialState";
import { AboutMeCard } from "./settings/AboutMeCard";
import { CaptionStyleCard, VoiceGuideCard } from "./settings/AgencyTextCards";
import { EDITOR_GAP, settingsLayout } from "./settings/settingsLayout";

/** The width of the grid, measured (the page has side panels, so the window width would lie). */
function useMeasuredWidth(): [(el: HTMLDivElement | null) => void, number] {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!el) return;
    setWidth(el.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, width];
}

export function SocialSettingsSection({ accountId }: { accountId: number }) {
  const { isAgencyUser, userRole } = useWorkspace();
  const { data, isLoading } = useQuery({ queryKey: socialSettingsKey(accountId), queryFn: () => fetchSocialSettings(accountId), staleTime: 30_000 });
  const [ref, width] = useMeasuredWidth();
  if (isLoading || !data) return <Loader2 size={14} className="animate-spin" style={{ color: "var(--mute-2)" }} />;

  // Three across only when all three fit at 680px each, else all stacked full width (never 2 + 1).
  const layout = settingsLayout(width, isAgencyUser ? 3 : 1);
  return (
    <div ref={ref} style={{ display: "grid", gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))`, gap: EDITOR_GAP, alignItems: "stretch" }} data-testid="social-settings">
      {isAgencyUser && <CaptionStyleCard accountId={accountId} data={data} minHeight={layout.editorMinHeight} />}
      {isAgencyUser && <VoiceGuideCard accountId={accountId} data={data} minHeight={layout.editorMinHeight} />}
      <AboutMeCard accountId={accountId} data={data} canEdit={canActOnSocial({ isAgency: isAgencyUser, userRole })} minHeight={layout.editorMinHeight} />
    </div>
  );
}
