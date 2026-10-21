// The inline "Upgrade with AI" panel inside a Settings card: notes (typed or dictated), learn from the
// account's published captions, add videos (transcribed on the server). "Upgrade" sends the editor's
// current text with all of it and hands the proposal back as a new version. Nothing is saved here.
import { useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Loader2, Mic, Sparkles, Square, Upload, X } from "lucide-react";
import { IconBtn } from "@/components/ui/icon-btn";
import { SocialApiError } from "../../../api/socialApi";
import { useTopicRecorder } from "../../../lib/useTopicRecorder";
import { fetchUpgradeCaptionCount, runUpgrade, upgradeCaptionsKey } from "./upgradeApi";
import { previewText, upgradeErrorKey, type UpgradeField } from "./upgradeState";
import { useVideoTranscripts } from "./useVideoTranscripts";

interface Props {
  accountId: number;
  field: UpgradeField;
  currentText: string;
  onResult: (text: string, changes: string[]) => void;
}

const small = { fontSize: 12, color: "var(--mute)", lineHeight: 1.5, margin: 0 } as const;

export function UpgradePanel({ accountId, field, currentText, onResult }: Props) {
  const { t, i18n } = useTranslation("social");
  const [notes, setNotes] = useState("");
  const [useCaptions, setUseCaptions] = useState(true);
  const fileInput = useRef<HTMLInputElement>(null);
  const videos = useVideoTranscripts(accountId);
  const rec = useTopicRecorder(accountId, (text) => setNotes((n) => (n.trim() ? `${n.trimEnd()}\n${text}` : text)));
  const captions = useQuery({ queryKey: upgradeCaptionsKey(accountId), queryFn: () => fetchUpgradeCaptionCount(accountId), staleTime: 5 * 60_000 });
  const upgrade = useMutation({
    mutationFn: () => runUpgrade(accountId, { field, currentText, notes, useCaptions, transcripts: videos.transcripts, uiLanguage: i18n.language }),
    onSuccess: (r) => onResult(r.text, r.changes),
  });

  const captionCount = captions.data?.count ?? 0;
  const hasInput = !!notes.trim() || videos.transcripts.length > 0 || (useCaptions && captionCount > 0);
  const err = upgrade.error ? (upgrade.error instanceof SocialApiError ? upgrade.error.reason : "failed") : rec.error;
  const id = `upgrade-${field}`;

  return (
    <div className="neu-inset-crisp" style={{ borderRadius: "var(--r-card)", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }} data-testid={`${id}-panel`}>
      <p style={small}>{t("upgrade.intro")}</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label htmlFor={`${id}-notes`} style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{t("upgrade.notesLabel")}</label>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <textarea id={`${id}-notes`} className="neu-input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("upgrade.notesPlaceholder")}
            maxLength={8000} style={{ flex: 1, minHeight: 110, fontSize: 13.5, lineHeight: 1.55, padding: "10px 12px", resize: "vertical" }} data-testid={`${id}-notes`} />
          {rec.state === "recording" ? (
            <IconBtn onClick={rec.stop} title={t("upgrade.stop")} aria-label={t("upgrade.stop")} data-testid={`${id}-mic-stop`}><Square className="w-4 h-4" /></IconBtn>
          ) : (
            <IconBtn onClick={rec.start} disabled={rec.state !== "idle"} title={t("upgrade.record")} aria-label={t("upgrade.record")} data-testid={`${id}-mic`}>
              {rec.state === "transcribing" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
            </IconBtn>
          )}
        </div>
        {rec.state !== "idle" && (
          <span role="status" style={small}>{rec.state === "recording" ? t("upgrade.recording", { seconds: rec.elapsed }) : t("upgrade.transcribing")}</span>
        )}
      </div>

      <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, color: "var(--ink)", cursor: "pointer" }}>
        <input type="checkbox" checked={useCaptions} onChange={(e) => setUseCaptions(e.target.checked)} style={{ marginTop: 3 }} data-testid={`${id}-captions`} />
        <span>
          {t("upgrade.captions")}
          <span style={{ display: "block", ...small }}>
            {captions.isLoading ? t("upgrade.captionsLoading") : captions.isError ? t("errors.failed") : captionCount > 0 ? t("upgrade.captionsCount", { count: captionCount }) : t("upgrade.captionsNone")}
          </span>
        </span>
      </label>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button type="button" className="la-btn la-btn--soft" onClick={() => fileInput.current?.click()} data-testid={`${id}-add-videos`}>
            <Upload size={12} />{t("upgrade.videos")}
          </button>
          <span style={small}>{t("upgrade.videosHelp")}</span>
          <input ref={fileInput} type="file" accept="video/*,audio/*" multiple hidden
            onChange={(e) => { if (e.target.files?.length) videos.add(e.target.files); e.target.value = ""; }} />
        </div>
        {videos.items.length > 0 && (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }} data-testid={`${id}-videos`}>
            {videos.items.map((v) => (
              <li key={v.key} className="neu-raised-crisp" style={{ borderRadius: 10, padding: "8px 10px", display: "flex", gap: 8, alignItems: "flex-start", background: "var(--bone)" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.name}</div>
                  <div style={{ fontSize: 12, lineHeight: 1.45, color: v.status === "error" ? "hsl(var(--destructive))" : "var(--mute)" }}>
                    {v.status === "waiting" && t("upgrade.videoWaiting")}
                    {v.status === "working" && <><Loader2 size={11} className="animate-spin" style={{ display: "inline", marginRight: 4 }} />{t("upgrade.videoWorking")}</>}
                    {v.status === "done" && <><strong style={{ color: "var(--good)", fontWeight: 600 }}>{t("upgrade.videoDone")}</strong> {previewText(v.text ?? "")}</>}
                    {v.status === "error" && t(upgradeErrorKey(v.reason))}
                  </div>
                </div>
                <IconBtn onClick={() => videos.remove(v.key)} title={t("upgrade.remove")} aria-label={t("upgrade.remove")}><X className="w-3.5 h-3.5" /></IconBtn>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" className="la-btn la-btn--wine" disabled={!hasInput || upgrade.isPending || videos.busy || rec.state !== "idle"} onClick={() => upgrade.mutate()} data-testid={`${id}-run`}>
          {upgrade.isPending ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}{t("upgrade.run")}
        </button>
        {upgrade.isPending && <span role="status" style={small}>{t("upgrade.running")}</span>}
        {!upgrade.isPending && videos.busy && <span style={small}>{t("upgrade.waitVideos")}</span>}
      </div>
      {err && !upgrade.isPending && <p role="alert" style={{ margin: 0, fontSize: 12, color: "hsl(var(--destructive))" }}>{t(upgradeErrorKey(err))}</p>}
    </div>
  );
}
