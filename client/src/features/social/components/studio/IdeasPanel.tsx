// Ideas: quick thoughts, one per line, in their own quiet card (a crisp inset, not raised like
// Scripts) with a quick add on top. Rows are light: hairline dividers, small muted text, small tags.
// A good idea becomes a script with one tap (it takes the idea's tags); the idea then says "Open script".
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Loader2, Mic, X } from "lucide-react";
import { createScript, fetchTopics, setTopicStatus, socialScriptsKey, socialTopicsKey, type TopicView } from "../../api/studioApi";
import { setTopicTags } from "../../api/tagsApi";
import { sortTopics } from "../../lib/studio";
import { TagStrip } from "./TagStrip";
import { TopicComposer } from "./TopicComposer";

const DOT: Record<TopicView["status"], string> = { new: "var(--wine)", used: "var(--good)", dismissed: "var(--mute-2)" };
const smallBtn: React.CSSProperties = { padding: "4px 9px", minHeight: 28, fontSize: 10.5 };

function IdeaRow({ topic, accountId, first, onScript }: { topic: TopicView; accountId: number; first: boolean; onScript: (scriptId: number) => void }) {
  const { t } = useTranslation("social");
  const qc = useQueryClient();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: socialTopicsKey(accountId) });
    qc.invalidateQueries({ queryKey: socialScriptsKey(accountId) });
  };
  const make = useMutation({ mutationFn: () => createScript(accountId, { title: topic.text.slice(0, 200), topicId: topic.id }), onSuccess: (s) => { refresh(); onScript(s.id); } });
  const status = useMutation({ mutationFn: (next: TopicView["status"]) => setTopicStatus(accountId, topic.id, next), onSuccess: refresh });
  const saveTags = async (ids: number[]) => {
    const updated = await setTopicTags(accountId, topic.id, ids);
    qc.setQueryData<TopicView[]>(socialTopicsKey(accountId), (old) => old?.map((x) => (x.id === updated.id ? updated : x)));
  };
  const label = t(`topics.statuses.${topic.status}`);
  return (
    <li style={{ display: "flex", flexDirection: "column", gap: 5, padding: "8px 2px", borderTop: first ? "none" : "1px solid var(--line)", opacity: topic.status === "dismissed" ? 0.6 : 1 }} data-testid={`topic-${topic.id}`}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <span role="img" aria-label={label} title={label} style={{ width: 6, height: 6, borderRadius: "50%", flex: "none", background: DOT[topic.status] }} />
        <p style={{ margin: 0, flex: 1, minWidth: 0, fontSize: 12.5, color: topic.status === "new" ? "var(--ink-soft)" : "var(--mute)", lineHeight: 1.35, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflowWrap: "anywhere" }} title={topic.text}>
          {topic.source === "voice" && <Mic size={10} style={{ display: "inline", marginRight: 4 }} aria-hidden />}
          {topic.text}
        </p>
        {topic.scriptId ? (
          <button type="button" className="la-btn la-btn--plain" style={smallBtn} onClick={() => onScript(topic.scriptId!)}>{t("topics.openScript")}</button>
        ) : topic.status === "new" ? (
          <>
            <button type="button" className="la-btn la-btn--plain" style={{ ...smallBtn, color: "var(--wine)" }} disabled={make.isPending} onClick={() => make.mutate()} data-testid={`topic-make-script-${topic.id}`}>
              {make.isPending && <Loader2 size={11} className="animate-spin" />}{t("topics.makeScript")}
            </button>
            <button type="button" className="la-btn la-btn--plain" style={{ ...smallBtn, padding: "4px 5px", color: "var(--mute-2)" }} disabled={status.isPending} onClick={() => status.mutate("dismissed")} title={t("topics.dismiss")} aria-label={t("topics.dismiss")}>
              <X size={13} />
            </button>
          </>
        ) : topic.status === "dismissed" ? (
          <button type="button" className="la-btn la-btn--plain" style={smallBtn} disabled={status.isPending} onClick={() => status.mutate("new")}>{t("topics.restore")}</button>
        ) : null}
      </div>
      <div style={{ paddingLeft: 15 }}>
        <TagStrip accountId={accountId} tagIds={topic.tagIds ?? []} onSave={saveTags} size="sm" compact testId={`topic-tags-${topic.id}`} />
      </div>
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
    <section className="neu-inset-crisp" style={{ borderRadius: "var(--r-card)", padding: "14px 14px 10px", display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }} data-testid="studio-topics">
      <div>
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--ink-soft)" }}>{t("topics.title")}</h3>
        <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "var(--mute)" }}>{t("topics.help")}</p>
      </div>
      <TopicComposer accountId={accountId} />
      {visible.length === 0 && !topics.isLoading && <p style={{ margin: 0, fontSize: 12, color: "var(--mute)" }}>{t("topics.empty")}</p>}
      {visible.length > 0 && (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column" }}>
          {visible.map((topic, i) => <IdeaRow key={topic.id} topic={topic} accountId={accountId} first={i === 0} onScript={onScript} />)}
        </ul>
      )}
      {all.some((x) => x.status === "dismissed") && (
        <button type="button" className="la-btn la-btn--plain" style={{ alignSelf: "flex-start", fontSize: 11, padding: "4px 8px", minHeight: 28 }} onClick={() => setShowDismissed((v) => !v)}>
          {t(showDismissed ? "topics.hideDismissed" : "topics.showDismissed")}
        </button>
      )}
    </section>
  );
}
