// Add a topic idea: type it, or tap the mic, speak, and the text lands in the box to check before
// sending. Used on the Manager's phone home and in agency's studio. Agency and Managers only.
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Loader2, Mic, Send, Square } from "lucide-react";
import { IconBtn } from "@/components/ui/icon-btn";
import { SocialApiError } from "../../api/socialApi";
import { addTopic, socialTopicsKey } from "../../api/studioApi";
import { studioErrorKey } from "../../lib/studio";
import { useTopicRecorder } from "../../lib/useTopicRecorder";

export function TopicComposer({ accountId, onAdded }: { accountId: number; onAdded?: () => void }) {
  const { t } = useTranslation("social");
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [spoken, setSpoken] = useState(false);
  const [sent, setSent] = useState(false);
  const rec = useTopicRecorder(accountId, (heard) => {
    setText((prev) => (prev.trim() ? `${prev.trim()} ${heard}` : heard));
    setSpoken(true);
  });
  const save = useMutation({
    mutationFn: () => addTopic(accountId, text.trim(), spoken ? "voice" : "typed"),
    onSuccess: () => {
      setText("");
      setSpoken(false);
      setSent(true);
      qc.invalidateQueries({ queryKey: socialTopicsKey(accountId) });
      onAdded?.();
    },
  });
  const reason = save.error instanceof SocialApiError ? save.error.reason : save.error ? "failed" : rec.error;
  const busy = save.isPending || rec.state !== "idle";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }} data-testid="topic-composer">
      <label htmlFor={`topic-${accountId}`} style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{t("topics.addLabel")}</label>
      <textarea id={`topic-${accountId}`} className="neu-input" rows={3} maxLength={2000} value={text}
        onChange={(e) => { setText(e.target.value); setSent(false); }} placeholder={t("topics.placeholder")}
        style={{ fontSize: 14, padding: "10px 12px", width: "100%", resize: "vertical" }} data-testid="topic-text" />
      <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
        {rec.state === "recording" ? (
          <IconBtn onClick={rec.stop} title={t("topics.stop")} aria-label={t("topics.stop")} data-testid="topic-mic-stop">
            <Square className="w-4 h-4" />
          </IconBtn>
        ) : (
          <IconBtn onClick={rec.start} disabled={busy} title={t("topics.record")} aria-label={t("topics.record")} data-testid="topic-mic">
            {rec.state === "transcribing" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
          </IconBtn>
        )}
        <span role="status" style={{ flex: 1, minWidth: 0, fontSize: 12, color: "var(--mute)" }}>
          {rec.state === "recording" ? t("topics.recording", { seconds: rec.elapsed }) : rec.state === "transcribing" ? t("topics.transcribing") : sent ? t("topics.sent") : ""}
        </span>
        <button type="button" className="la-btn la-btn--wine" style={{ minHeight: 40, padding: "10px 16px" }} disabled={busy || !text.trim()} onClick={() => save.mutate()} data-testid="topic-send">
          {save.isPending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
          {t("topics.send")}
        </button>
      </div>
      {reason && <p role="alert" style={{ margin: 0, fontSize: 12, color: "hsl(var(--destructive))" }}>{t(studioErrorKey(reason))}</p>}
    </div>
  );
}
