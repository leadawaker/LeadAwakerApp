// Agency only: the account's caption style (what the caption writer follows) and voice guide (the
// system prompt of "Draft with AI"). Both are plain text per account, never code. Comment-to-DM
// settings live in their own section.
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { SocialApiError } from "../api/socialApi";
import { fetchSocialSettings, saveSocialSettings, socialSettingsKey, type SocialSettingsView } from "../api/studioApi";
import { studioErrorKey } from "../lib/studio";

const labelStyle: React.CSSProperties = { fontSize: 13.5, fontWeight: 700, color: "var(--ink)", display: "block" };
const helpStyle: React.CSSProperties = { margin: "2px 0 8px", fontSize: 12, color: "var(--mute)", lineHeight: 1.5 };

export function SocialSettingsSection({ accountId }: { accountId: number }) {
  const { t } = useTranslation("social");
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: socialSettingsKey(accountId), queryFn: () => fetchSocialSettings(accountId), staleTime: 30_000 });
  const [captionStyle, setCaptionStyle] = useState("");
  const [voiceGuide, setVoiceGuide] = useState("");
  useEffect(() => {
    if (!data) return;
    setCaptionStyle(data.captionStyle ?? "");
    setVoiceGuide(data.voiceGuide ?? "");
  }, [data?.captionStyle, data?.voiceGuide]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = useMutation({
    mutationFn: () => saveSocialSettings(accountId, { captionStyle, voiceGuide }),
    onSuccess: (v) => qc.setQueryData(socialSettingsKey(accountId), (old: SocialSettingsView | undefined) => ({ ...old, ...v })),
  });
  const dirty = !!data && (captionStyle !== (data.captionStyle ?? "") || voiceGuide !== (data.voiceGuide ?? ""));

  if (isLoading) return <Loader2 size={14} className="animate-spin" style={{ color: "var(--mute-2)" }} />;

  return (
    <section className="neu-raised" style={{ borderRadius: "var(--r-card)", background: "var(--bone)", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 16, maxWidth: 900 }} data-testid="social-settings">
      <div>
        <label style={labelStyle} htmlFor="settings-caption-style">{t("settings.captionStyle")}</label>
        <p style={helpStyle}>{t("settings.captionStyleHelp")}</p>
        <textarea id="settings-caption-style" className="neu-input" rows={12} maxLength={20000} value={captionStyle} onChange={(e) => setCaptionStyle(e.target.value)}
          style={{ fontSize: 12.5, lineHeight: 1.5, padding: "10px 12px", width: "100%", resize: "vertical", fontFamily: "var(--mono)" }} data-testid="settings-caption-style" />
      </div>
      <div>
        <label style={labelStyle} htmlFor="settings-voice-guide">{t("settings.voiceGuide")}</label>
        <p style={helpStyle}>{t("settings.voiceGuideHelp")}</p>
        <textarea id="settings-voice-guide" className="neu-input" rows={12} maxLength={40000} value={voiceGuide} onChange={(e) => setVoiceGuide(e.target.value)}
          style={{ fontSize: 12.5, lineHeight: 1.5, padding: "10px 12px", width: "100%", resize: "vertical", fontFamily: "var(--mono)" }} data-testid="settings-voice-guide" />
      </div>
      <div className="row" style={{ gap: 10 }}>
        <button type="button" className="la-btn la-btn--wine" disabled={!dirty || save.isPending} onClick={() => save.mutate()} data-testid="settings-save">
          {save.isPending && <Loader2 size={12} className="animate-spin" />}{t("settings.save")}
        </button>
        {save.isSuccess && !dirty && <span role="status" style={{ fontSize: 12, color: "var(--good)" }}>{t("settings.saved")}</span>}
      </div>
      {save.error && <p role="alert" style={{ margin: 0, fontSize: 12, color: "hsl(var(--destructive))" }}>{t(studioErrorKey(save.error instanceof SocialApiError ? save.error.reason : "failed"))}</p>}
    </section>
  );
}
