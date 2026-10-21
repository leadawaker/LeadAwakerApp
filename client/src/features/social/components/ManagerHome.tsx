// The client's phone home on the Socials page (Manager, Viewer): add a topic idea (typed or spoken),
// answer the scripts Gabriel sent, approve the videos waiting (the existing approve / reject flow),
// and jump to the calendar (above the posts) or Sobre mim. Viewers see the same lists without buttons.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CalendarDays, ChevronRight, Loader2, UserRound } from "lucide-react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { SocialApiError, fetchSocialPosts, socialPostsKey } from "../api/socialApi";
import { fetchScripts, reviewScript, socialScriptsKey, type ScriptView } from "../api/studioApi";
import { canActOnSocial } from "../lib/socialState";
import { managerHome, studioErrorKey } from "../lib/studio";
import { PostCard } from "./PostCard";
import { TopicComposer } from "./studio/TopicComposer";

const card: React.CSSProperties = { borderRadius: "var(--r-card)", background: "var(--bone)", padding: "16px 16px", display: "flex", flexDirection: "column", gap: 12 };
const h: React.CSSProperties = { margin: 0, fontSize: 15, fontWeight: 700, color: "var(--ink)" };
/** Phone tap target for the answer buttons. */
const touch: React.CSSProperties = { minHeight: 40, padding: "10px 16px" };

function ScriptToReview({ script, accountId, canAnswer }: { script: ScriptView; accountId: number; canAnswer: boolean }) {
  const { t } = useTranslation("social");
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState("");
  const answer = useMutation({
    mutationFn: (decision: "ok" | "changes") => reviewScript(accountId, script, decision, note.trim()),
    onSuccess: () => { setAsking(false); setNote(""); qc.invalidateQueries({ queryKey: socialScriptsKey(accountId) }); },
    // Gabriel changed the text meanwhile: show the new version.
    onError: (err) => { if (err instanceof SocialApiError && err.status === 409) qc.invalidateQueries({ queryKey: socialScriptsKey(accountId) }); },
  });
  return (
    <li className="neu-inset-crisp" style={{ borderRadius: "var(--r-surface)", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }} data-testid={`review-script-${script.id}`}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
        <span style={{ flex: 1 }}>{script.title}</span>
        <ChevronRight size={16} style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform 150ms" }} />
      </button>
      {open && <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "var(--ink-soft)", whiteSpace: "pre-wrap" }}>{script.body}</p>}
      {canAnswer && !asking && (
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="la-btn la-btn--wine" style={touch} disabled={answer.isPending} onClick={() => answer.mutate("ok")} data-testid={`review-ok-${script.id}`}>
            {answer.isPending && <Loader2 size={12} className="animate-spin" />}{t("home.ok")}
          </button>
          <button type="button" className="la-btn la-btn--soft" style={touch} onClick={() => { setAsking(true); setOpen(true); }} data-testid={`review-changes-${script.id}`}>{t("home.changes")}</button>
        </div>
      )}
      {canAnswer && asking && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label htmlFor={`note-${script.id}`} style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-soft)" }}>{t("home.changesNote")}</label>
          <textarea id={`note-${script.id}`} className="neu-input" rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("home.changesPlaceholder")}
            style={{ fontSize: 14, padding: "10px 12px", width: "100%", resize: "vertical" }} />
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="la-btn la-btn--wine" style={touch} disabled={!note.trim() || answer.isPending} onClick={() => answer.mutate("changes")}>{t("home.send")}</button>
            <button type="button" className="la-btn la-btn--plain" style={touch} onClick={() => setAsking(false)}>{t("home.cancel")}</button>
          </div>
        </div>
      )}
      {answer.error && <p role="alert" style={{ margin: 0, fontSize: 12, color: "hsl(var(--destructive))" }}>{t(studioErrorKey(answer.error instanceof SocialApiError ? answer.error.reason : "failed"))}</p>}
    </li>
  );
}

export function ManagerHome({ accountId, timeZone, onOpen }: { accountId: number; timeZone: string; onOpen: (section: "about" | "posts") => void }) {
  const { t } = useTranslation("social");
  const { isAgencyUser, userRole } = useWorkspace();
  const qc = useQueryClient();
  const canAct = canActOnSocial({ isAgency: isAgencyUser, userRole });
  const scripts = useQuery({ queryKey: socialScriptsKey(accountId), queryFn: () => fetchScripts(accountId), staleTime: 15_000 });
  const posts = useQuery({ queryKey: socialPostsKey(accountId), queryFn: () => fetchSocialPosts(accountId), staleTime: 15_000, refetchInterval: 60_000 });
  const home = managerHome(scripts.data ?? [], posts.data ?? []);
  const who = { isAgency: isAgencyUser, userRole };
  const refreshPosts = () => qc.invalidateQueries({ queryKey: socialPostsKey(accountId) });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 640 }} data-testid="manager-home">
      {canAct && (
        <section className="neu-raised" style={card}>
          <TopicComposer accountId={accountId} />
          <p style={{ margin: 0, fontSize: 12, color: "var(--mute)" }}>{t("home.topicHelp")}</p>
        </section>
      )}

      <section className="neu-raised" style={card} data-testid="home-videos">
        <h3 style={h}>{t("home.videosWaiting")}</h3>
        {posts.isLoading && <Loader2 size={14} className="animate-spin" style={{ color: "var(--mute-2)" }} />}
        {!posts.isLoading && home.videosWaiting.length === 0 && <p style={{ margin: 0, fontSize: 13, color: "var(--mute)" }}>{t("home.videosWaitingEmpty")}</p>}
        {home.videosWaiting.map((p) => (
          <PostCard key={p.id} post={p} accountId={accountId} timeZone={timeZone} who={who} onChanged={refreshPosts} onEdit={() => onOpen("posts")} />
        ))}
      </section>

      <section className="neu-raised" style={card} data-testid="home-scripts">
        <h3 style={h}>{t("home.scriptsWaiting")}</h3>
        {scripts.isLoading && <Loader2 size={14} className="animate-spin" style={{ color: "var(--mute-2)" }} />}
        {!scripts.isLoading && home.scriptsWaiting.length === 0 && <p style={{ margin: 0, fontSize: 13, color: "var(--mute)" }}>{t("home.scriptsWaitingEmpty")}</p>}
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          {home.scriptsWaiting.map((s) => <ScriptToReview key={s.id} script={s} accountId={accountId} canAnswer={canAct} />)}
        </ul>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <button type="button" className="neu-raised" onClick={() => onOpen("posts")} style={{ ...card, border: "none", cursor: "pointer", alignItems: "flex-start", textAlign: "left" }} data-testid="home-open-calendar">
          <CalendarDays size={18} style={{ color: "var(--wine)" }} />
          <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}>{t("page.tabs.posts")}</span>
          <span style={{ fontSize: 12, color: "var(--mute)" }}>{t("home.upcomingCount", { count: home.upcoming.length })}</span>
        </button>
        <button type="button" className="neu-raised" onClick={() => onOpen("about")} style={{ ...card, border: "none", cursor: "pointer", alignItems: "flex-start", textAlign: "left" }} data-testid="home-open-about">
          <UserRound size={18} style={{ color: "var(--wine)" }} />
          <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}>{t("page.tabs.about")}</span>
          <span style={{ fontSize: 12, color: "var(--mute)" }}>{t("home.aboutHelp")}</span>
        </button>
      </div>
    </div>
  );
}
