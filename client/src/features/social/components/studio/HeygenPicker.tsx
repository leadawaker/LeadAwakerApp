// "Videos from HeyGen" for one script: the account's finished HeyGen videos (read-only list), with
// "Use this video" on the completed ones that were not used yet. The server downloads the mp4 and
// checks it like an upload. Agency only.
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Film, Loader2 } from "lucide-react";
import { Pill } from "@/components/crm/primitives";
import { SocialApiError } from "../../api/socialApi";
import { fetchHeygenVideos, heygenVideosKey, pullHeygenVideo, type ScriptView } from "../../api/studioApi";
import { studioErrorKey } from "../../lib/studio";

function fmtDuration(s: number | null): string {
  if (s === null) return "";
  const r = Math.round(s);
  return `${Math.floor(r / 60)}:${String(r % 60).padStart(2, "0")}`;
}

export function HeygenPicker({ accountId, scriptId, onPulled }: { accountId: number; scriptId: number; onPulled: (s: ScriptView) => void }) {
  const { t, i18n } = useTranslation("social");
  const [tokens, setTokens] = useState<(string | null)[]>([null]);
  const token = tokens[tokens.length - 1];
  const list = useQuery({ queryKey: heygenVideosKey(accountId, token), queryFn: () => fetchHeygenVideos(accountId, token), staleTime: 60_000 });
  const pull = useMutation({
    mutationFn: (videoId: string) => pullHeygenVideo(accountId, scriptId, videoId),
    onSuccess: (r) => { list.refetch(); onPulled(r.script); },
  });
  const reason = pull.error instanceof SocialApiError ? pull.error.reason : pull.error ? "failed" : null;
  const date = (iso: string | null) => (iso ? new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" }).format(new Date(iso)) : "");

  if (list.isLoading) return <div role="status" aria-label={t("heygen.loading")} style={{ color: "var(--mute-2)" }}><Loader2 size={14} className="animate-spin" /></div>;
  if (list.isError) return <p role="alert" style={{ margin: 0, fontSize: 12, color: "hsl(var(--destructive))" }}>{t("errors.heygen_failed")}</p>;
  if (!list.data?.configured) return <p style={{ margin: 0, fontSize: 12, color: "var(--mute)" }} data-testid="heygen-not-configured">{t("heygen.notConfigured")}</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }} data-testid="heygen-picker">
      {list.data.videos.length === 0 && <p style={{ margin: 0, fontSize: 12, color: "var(--mute)" }}>{t("heygen.empty")}</p>}
      {list.data.videos.map((v) => (
        <div key={v.id} className="row neu-inset-crisp" style={{ gap: 10, borderRadius: "var(--r-surface)", padding: 8 }} data-testid={`heygen-video-${v.id}`}>
          <span style={{ width: 40, height: 64, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--mute-2)", flexShrink: 0 }}><Film size={14} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.title || v.id}</div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--mute-2)" }}>{[fmtDuration(v.durationS), date(v.createdAt)].filter(Boolean).join(" · ")}</div>
            <div className="row" style={{ gap: 6, marginTop: 4, flexWrap: "wrap" }}>
              {!v.selectable && <Pill>{t("heygen.status", { status: v.status })}</Pill>}
              {v.alreadyUsed && <Pill color="var(--mute)">{t("heygen.used")}</Pill>}
            </div>
          </div>
          {v.selectable && !v.alreadyUsed && (
            <button type="button" className="la-btn la-btn--soft" disabled={pull.isPending} onClick={() => pull.mutate(v.id)} data-testid={`heygen-use-${v.id}`}>
              {pull.isPending && pull.variables === v.id && <Loader2 size={12} className="animate-spin" />}
              {t("heygen.use")}
            </button>
          )}
        </div>
      ))}
      {pull.isPending && <p role="status" style={{ margin: 0, fontSize: 12, color: "var(--mute)" }}>{t("heygen.pulling")}</p>}
      {reason && <p role="alert" style={{ margin: 0, fontSize: 12, color: "hsl(var(--destructive))" }}>{t(studioErrorKey(reason))}</p>}
      <div className="row" style={{ gap: 8 }}>
        {tokens.length > 1 && <button type="button" className="la-btn la-btn--plain" onClick={() => setTokens((x) => x.slice(0, -1))}>{t("heygen.newer")}</button>}
        {list.data.nextToken && <button type="button" className="la-btn la-btn--plain" onClick={() => setTokens((x) => [...x, list.data!.nextToken])}>{t("heygen.older")}</button>}
      </div>
    </div>
  );
}
