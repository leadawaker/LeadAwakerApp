// The studio, agency layout: topic ideas from the client (and Gabriel's own), the script board by
// status, and the selected script in a right panel (stacked on a phone). Gabriel stays in control of
// scripts; the client only answers the ones sent to him.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Loader2, Mic, Plus } from "lucide-react";
import { GroupHeader } from "@/components/crm/primitives";
import { useIsMobile } from "@/hooks/useIsMobile";
import { SocialApiError } from "../../api/socialApi";
import {
  createScript, fetchScripts, fetchTopics, setTopicStatus, socialScriptsKey, socialTopicsKey, type TopicView,
} from "../../api/studioApi";
import { groupScripts, sortTopics, studioErrorKey } from "../../lib/studio";
import { ScriptCard } from "./ScriptCard";
import { ScriptPanel } from "./ScriptPanel";
import { TopicComposer } from "./TopicComposer";

const cardStyle: React.CSSProperties = { borderRadius: "var(--r-card)", background: "var(--bone)", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 };

function TopicRow({ topic, accountId, onScript }: { topic: TopicView; accountId: number; onScript: (scriptId: number) => void }) {
  const { t, i18n } = useTranslation("social");
  const qc = useQueryClient();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: socialTopicsKey(accountId) });
    qc.invalidateQueries({ queryKey: socialScriptsKey(accountId) });
  };
  const make = useMutation({ mutationFn: () => createScript(accountId, { title: topic.text.slice(0, 200), topicId: topic.id }), onSuccess: (s) => { refresh(); onScript(s.id); } });
  const status = useMutation({ mutationFn: (next: TopicView["status"]) => setTopicStatus(accountId, topic.id, next), onSuccess: refresh });
  return (
    <li className="neu-inset" style={{ borderRadius: "var(--r-surface)", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6, opacity: topic.status === "dismissed" ? 0.6 : 1 }} data-testid={`topic-${topic.id}`}>
      <p style={{ margin: 0, fontSize: 13, color: "var(--ink-soft)", whiteSpace: "pre-wrap" }}>{topic.text}</p>
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--mute-2)", flex: 1 }}>
          {topic.source === "voice" && <Mic size={10} style={{ display: "inline", marginRight: 4 }} />}
          {new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" }).format(new Date(topic.createdAt))} · {t(`topics.statuses.${topic.status}`)}
        </span>
        {topic.scriptId ? (
          <button type="button" className="la-btn la-btn--plain" onClick={() => onScript(topic.scriptId!)}>{t("topics.openScript")}</button>
        ) : topic.status === "new" ? (
          <>
            <button type="button" className="la-btn la-btn--soft" disabled={make.isPending} onClick={() => make.mutate()} data-testid={`topic-make-script-${topic.id}`}>
              {make.isPending && <Loader2 size={12} className="animate-spin" />}{t("topics.makeScript")}
            </button>
            <button type="button" className="la-btn la-btn--plain" disabled={status.isPending} onClick={() => status.mutate("dismissed")}>{t("topics.dismiss")}</button>
          </>
        ) : topic.status === "dismissed" ? (
          <button type="button" className="la-btn la-btn--plain" disabled={status.isPending} onClick={() => status.mutate("new")}>{t("topics.restore")}</button>
        ) : null}
      </div>
    </li>
  );
}

function NewScript({ accountId, onCreated }: { accountId: number; onCreated: (id: number) => void }) {
  const { t } = useTranslation("social");
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const make = useMutation({
    mutationFn: () => createScript(accountId, { title: title.trim() }),
    onSuccess: (s) => { setTitle(""); qc.invalidateQueries({ queryKey: socialScriptsKey(accountId) }); onCreated(s.id); },
  });
  return (
    <form className="row" style={{ gap: 8 }} onSubmit={(e) => { e.preventDefault(); if (title.trim()) make.mutate(); }}>
      <input className="neu-input" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} placeholder={t("scripts.newTitlePlaceholder")} aria-label={t("scripts.newTitlePlaceholder")}
        style={{ flex: 1, minWidth: 0, fontSize: 12.5, padding: "8px 11px" }} data-testid="script-new-title" />
      <button type="submit" className="la-btn la-btn--wine" disabled={!title.trim() || make.isPending} data-testid="script-new">
        {make.isPending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}{t("scripts.new")}
      </button>
    </form>
  );
}

export function StudioSection({ accountId, timeZone }: { accountId: number; timeZone: string }) {
  const { t } = useTranslation("social");
  const isMobile = useIsMobile(1024);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showDismissed, setShowDismissed] = useState(false);
  const topics = useQuery({ queryKey: socialTopicsKey(accountId), queryFn: () => fetchTopics(accountId), staleTime: 15_000 });
  const scripts = useQuery({ queryKey: socialScriptsKey(accountId), queryFn: () => fetchScripts(accountId), staleTime: 15_000 });
  const selected = scripts.data?.find((s) => s.id === selectedId) ?? null;
  const allTopics = sortTopics(topics.data ?? []);
  const visibleTopics = allTopics.filter((x) => showDismissed || x.status !== "dismissed");
  const loadError = topics.error ?? scripts.error;

  const lists = (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
      <section className="neu-raised" style={cardStyle} data-testid="studio-topics">
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>{t("topics.title")}</h3>
        <p style={{ margin: 0, fontSize: 12, color: "var(--mute)" }}>{t("topics.help")}</p>
        {visibleTopics.length === 0 && !topics.isLoading && <p style={{ margin: 0, fontSize: 12.5, color: "var(--mute)" }}>{t("topics.empty")}</p>}
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          {visibleTopics.map((topic) => <TopicRow key={topic.id} topic={topic} accountId={accountId} onScript={setSelectedId} />)}
        </ul>
        {allTopics.some((x) => x.status === "dismissed") && (
          <button type="button" className="la-btn la-btn--plain" style={{ alignSelf: "flex-start" }} onClick={() => setShowDismissed((v) => !v)}>
            {t(showDismissed ? "topics.hideDismissed" : "topics.showDismissed")}
          </button>
        )}
        <TopicComposer accountId={accountId} />
      </section>

      <section className="neu-raised" style={cardStyle} data-testid="studio-scripts">
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>{t("scripts.title")}</h3>
        <NewScript accountId={accountId} onCreated={setSelectedId} />
        {scripts.isLoading && <Loader2 size={14} className="animate-spin" style={{ color: "var(--mute-2)" }} />}
        {scripts.data && scripts.data.length === 0 && <p style={{ margin: 0, fontSize: 12.5, color: "var(--mute)" }}>{t("scripts.empty")}</p>}
        {groupScripts(scripts.data ?? []).map((g) => (
          <div key={g.status} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <GroupHeader label={t(`scripts.statuses.${g.status}`)} count={g.scripts.length} sticky={false} />
            {g.scripts.map((s) => <ScriptCard key={s.id} script={s} selected={s.id === selectedId} onSelect={() => setSelectedId(s.id)} />)}
          </div>
        ))}
      </section>
    </div>
  );

  return (
    <div data-testid="studio-section" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {loadError && <p role="alert" style={{ margin: 0, fontSize: 12.5, color: "hsl(var(--destructive))" }}>{t(studioErrorKey(loadError instanceof SocialApiError ? loadError.reason : "failed"))}</p>}
      {isMobile ? (
        <>
          {selected && <ScriptPanel key={selected.id} accountId={accountId} timeZone={timeZone} script={selected} onClose={() => setSelectedId(null)} />}
          {!selected && lists}
        </>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(300px, 380px) minmax(0, 1fr)", gap: 18, alignItems: "start" }}>
          {lists}
          {selected ? (
            <ScriptPanel key={selected.id} accountId={accountId} timeZone={timeZone} script={selected} onClose={() => setSelectedId(null)} />
          ) : (
            <div className="neu-inset" style={{ borderRadius: "var(--r-card)", padding: "28px 20px", textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: 13, color: "var(--mute)" }}>{t("scripts.pickOne")}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
