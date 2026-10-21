// Quick add for ideas: a one-line looking box that grows when you focus it or paste a list. One idea
// per line (the server makes one topic per line). Tap the mic, speak, and the text lands in the box to
// check before sending. Used on the Manager's phone home and in agency's studio. Agency and Managers only.
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Loader2, Mic, Plus, Square } from "lucide-react";
import { IconBtn } from "@/components/ui/icon-btn";
import { SocialApiError } from "../../api/socialApi";
import { addTopic, socialTopicsKey } from "../../api/studioApi";
import { studioErrorKey } from "../../lib/studio";
import { useTopicRecorder } from "../../lib/useTopicRecorder";

const BATCH_MAX = 50;

export function TopicComposer({ accountId, onAdded }: { accountId: number; onAdded?: () => void }) {
  const { t } = useTranslation("social");
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [spoken, setSpoken] = useState(false);
  const [added, setAdded] = useState(0);
  const [focused, setFocused] = useState(false);
  const rec = useTopicRecorder(accountId, (heard) => {
    setText((prev) => (prev.trim() ? `${prev.trim()}\n${heard}` : heard));
    setSpoken(true);
  });
  const save = useMutation({
    mutationFn: () => addTopic(accountId, text.trim(), spoken ? "voice" : "typed"),
    onSuccess: (created) => {
      // More lines than one submit takes: keep the rest in the box for the next tap.
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      setText(lines.length > BATCH_MAX && created.length >= BATCH_MAX ? lines.slice(BATCH_MAX).join("\n") : "");
      setSpoken(false);
      setAdded(created.length);
      qc.invalidateQueries({ queryKey: socialTopicsKey(accountId) });
      onAdded?.();
    },
  });
  const reason = save.error instanceof SocialApiError ? save.error.reason : save.error ? "failed" : rec.error;
  const busy = save.isPending || rec.state !== "idle";
  // Stays open while there is text, so the button does not jump away from under a tap when focus leaves.
  const open = focused || text.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }} data-testid="topic-composer">
      <div className="row" style={{ gap: 8, alignItems: open ? "flex-end" : "center" }}>
        <textarea id={`topic-${accountId}`} className="neu-input" rows={open ? 4 : 1} maxLength={30_000} value={text}
          aria-label={t("topics.placeholder")} placeholder={t("topics.placeholder")}
          onChange={(e) => { setText(e.target.value); setAdded(0); }}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          style={{ flex: 1, minWidth: 0, fontSize: 14, padding: "9px 12px", resize: "none", lineHeight: 1.4, minHeight: 40 }} data-testid="topic-text" />
        {rec.state === "recording" ? (
          <IconBtn onClick={rec.stop} title={t("topics.stop")} aria-label={t("topics.stop")} data-testid="topic-mic-stop">
            <Square className="w-4 h-4" />
          </IconBtn>
        ) : (
          <IconBtn onClick={rec.start} disabled={busy} title={t("topics.record")} aria-label={t("topics.record")} data-testid="topic-mic">
            {rec.state === "transcribing" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
          </IconBtn>
        )}
      </div>
      <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
        <span role="status" style={{ flex: 1, minWidth: 0, fontSize: 12, color: "var(--mute)" }}>
          {rec.state === "recording" ? t("topics.recording", { seconds: rec.elapsed }) : rec.state === "transcribing" ? t("topics.transcribing") : added > 1 ? t("topics.sentMany", { n: added }) : added === 1 ? t("topics.sent") : ""}
        </span>
        <button type="button" className="la-btn la-btn--wine" style={{ minHeight: 40, padding: "10px 16px" }} disabled={busy || !text.trim()} onClick={() => save.mutate()} data-testid="topic-send">
          {save.isPending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
          {t("topics.send")}
        </button>
      </div>
      {reason && <p role="alert" style={{ margin: 0, fontSize: 12, color: "hsl(var(--destructive))" }}>{t(studioErrorKey(reason))}</p>}
    </div>
  );
}
