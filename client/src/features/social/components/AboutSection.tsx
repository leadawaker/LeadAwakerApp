// "Sobre mim": a short profile the account holder keeps up to date (bio facts, credentials, services,
// things never to say). It goes into every caption and script prompt as extra context.
// Agency and the account's Managers edit; Viewers read.
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { SocialApiError } from "../api/socialApi";
import { fetchSocialSettings, saveAboutMe, socialSettingsKey } from "../api/studioApi";
import { canActOnSocial } from "../lib/socialState";
import { studioErrorKey } from "../lib/studio";

export function AboutSection({ accountId }: { accountId: number }) {
  const { t } = useTranslation("social");
  const { isAgencyUser, userRole } = useWorkspace();
  const qc = useQueryClient();
  const canEdit = canActOnSocial({ isAgency: isAgencyUser, userRole });
  const { data, isLoading } = useQuery({ queryKey: socialSettingsKey(accountId), queryFn: () => fetchSocialSettings(accountId), staleTime: 30_000 });
  const [text, setText] = useState("");
  useEffect(() => { if (data) setText(data.aboutMe); }, [data?.aboutMe]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = useMutation({
    mutationFn: () => saveAboutMe(accountId, text),
    onSuccess: (v) => qc.setQueryData(socialSettingsKey(accountId), (old: typeof data) => ({ ...old, ...v })),
  });
  const dirty = !!data && text !== data.aboutMe;

  return (
    <section className="neu-raised" style={{ borderRadius: "var(--r-card)", background: "var(--bone)", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12, maxWidth: 760 }} data-testid="about-section">
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>{t("about.title")}</h3>
      <p style={{ margin: 0, fontSize: 12.5, color: "var(--mute)", lineHeight: 1.5 }}>{t(canEdit ? "about.help" : "about.helpReadOnly")}</p>
      {isLoading ? (
        <Loader2 size={14} className="animate-spin" style={{ color: "var(--mute-2)" }} />
      ) : canEdit ? (
        <>
          <textarea className="neu-input" rows={12} maxLength={8000} value={text} onChange={(e) => setText(e.target.value)} placeholder={t("about.placeholder")} aria-label={t("about.title")}
            style={{ fontSize: 13.5, lineHeight: 1.55, padding: "10px 12px", width: "100%", resize: "vertical" }} data-testid="about-text" />
          <div className="row" style={{ gap: 10 }}>
            <button type="button" className="la-btn la-btn--wine" disabled={!dirty || save.isPending} onClick={() => save.mutate()} data-testid="about-save">
              {save.isPending && <Loader2 size={12} className="animate-spin" />}{t("about.save")}
            </button>
            {save.isSuccess && !dirty && <span role="status" style={{ fontSize: 12, color: "var(--good)" }}>{t("about.saved")}</span>}
          </div>
          {save.error && <p role="alert" style={{ margin: 0, fontSize: 12, color: "hsl(var(--destructive))" }}>{t(studioErrorKey(save.error instanceof SocialApiError ? save.error.reason : "failed"))}</p>}
        </>
      ) : (
        <p style={{ margin: 0, fontSize: 13.5, color: "var(--ink-soft)", whiteSpace: "pre-wrap", lineHeight: 1.55 }}>{data?.aboutMe || t("about.empty")}</p>
      )}
    </section>
  );
}
