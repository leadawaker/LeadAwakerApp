// Ideas: quick thoughts, one per line. A flat outlined list (not the card style of scripts) with a quick
// add on top. A good idea becomes a script with one tap; the idea then says "Open script".
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Loader2, Mic, X } from "lucide-react";
import { createScript, fetchTopics, setTopicStatus, socialScriptsKey, socialTopicsKey, type TopicView } from "../../api/studioApi";
import { sortTopics } from "../../lib/studio";
import { TopicComposer } from "./TopicComposer";

const DOT: Record<TopicView["status"], string> = { new: "var(--wine)", used: "var(--good)", dismissed: "var(--mute-2)" };
const smallBtn: React.CSSProperties = { padding: "5px 10px", minHeight: 30, fontSize: 11 };

function IdeaRow({ topic, accountId, onScript }: { topic: TopicView; accountId: number; onScript: (scriptId: number) => void }) {
  const { t } = useTranslation("social");
  const qc = useQueryClient();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: socialTopicsKey(accountId) });
    qc.invalidateQueries({ queryKey: socialScriptsKey(accountId) });
  };
  const make = useMutation({ mutationFn: () => createScript(accountId, { title: topic.text.slice(0, 200), topicId: topic.id }), onSuccess: (s) => { refresh(); onScript(s.id); } });
  const status = useMutation({ mutationFn: (next: TopicView["status"]) => setTopicStatus(accountId, topic.id, next), onSuccess: refresh });
  const label = t(`topics.statuses.${topic.status}`);
  return (
    <li style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", border: "1px solid var(--line)", borderRadius: "var(--r-surface)", opacity: topic.status === "dismissed" ? 0.6 : 1 }} data-testid={`topic-${topic.id}`}>
      <span role="img" aria-label={label} title={label} style={{ width: 8, height: 8, borderRadius: "50%", flex: "none", background: DOT[topic.status] }} />
      <p style={{ margin: 0, flex: 1, minWidth: 0, fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.35, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflowWrap: "anywhere" }} title={topic.text}>
        {topic.source === "voice" && <Mic size={10} style={{ display: "inline", marginRight: 4 }} aria-hidden />}
        {topic.text}
      </p>
      {topic.scriptId ? (
        <button type="button" className="la-btn la-btn--plain" style={smallBtn} onClick={() => onScript(topic.scriptId!)}>{t("topics.openScript")}</button>
      ) : topic.status === "new" ? (
        <>
          <button type="button" className="la-btn la-btn--soft" style={smallBtn} disabled={make.isPending} onClick={() => make.mutate()} data-testid={`topic-make-script-${topic.id}`}>
            {make.isPending && <Loader2 size={11} className="animate-spin" />}{t("topics.makeScript")}
          </button>
          <button type="button" className="la-btn la-btn--plain" style={{ ...smallBtn, padding: "5px 6px" }} disabled={status.isPending} onClick={() => status.mutate("dismissed")} title={t("topics.dismiss")} aria-label={t("topics.dismiss")}>
            <X size={14} />
          </button>
        </>
      ) : topic.status === "dismissed" ? (
        <button type="button" className="la-btn la-btn--plain" style={smallBtn} disabled={status.isPending} onClick={() => status.mutate("new")}>{t("topics.restore")}</button>
      ) : null}
    </li>
  );
}

export function IdeasPanel({ accountId, onScript }: { accountId: number; onScript: (scriptId: number) => void }) {
  const { t } = useTranslation("social");
  const [showDismissed, setShowDismissed] = useState(false);
  const topics = useQuery({ queryKey: socialTopicsKey(accountId), queryFn: () => fetchTopics(accountId), staleTime: 15_000 });
  const all = sortTopics(topics.data ?? []);
  const visible = all.filter((x) => showDismissed || x.status !== "dismissed");
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }} data-testid="studio-topics">
      <div>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>{t("topics.title")}</h3>
        <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--mute)" }}>{t("topics.help")}</p>
      </div>
      <TopicComposer accountId={accountId} />
      {visible.length === 0 && !topics.isLoading && <p style={{ margin: 0, fontSize: 12.5, color: "var(--mute)" }}>{t("topics.empty")}</p>}
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
        {visible.map((topic) => <IdeaRow key={topic.id} topic={topic} accountId={accountId} onScript={onScript} />)}
      </ul>
      {all.some((x) => x.status === "dismissed") && (
        <button type="button" className="la-btn la-btn--plain" style={{ alignSelf: "flex-start" }} onClick={() => setShowDismissed((v) => !v)}>
          {t(showDismissed ? "topics.hideDismissed" : "topics.showDismissed")}
        </button>
      )}
    </section>
  );
}
