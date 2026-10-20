// The account workspace's Social tab: the account's scheduled Reels in sections (needs approval,
// upcoming, held, failed, published), a New post panel for agency, and the Instagram connect card
// when nothing is connected yet. Client users of the account see the same list; Managers also
// approve and reject. Times are shown in the account's zone.
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Loader2, Plus } from "lucide-react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { fetchSocialPosts, socialPostsKey, type SocialPostView } from "../api/socialApi";
import { groupBySection } from "../lib/posts";
import { connectCardMode } from "../lib/socialState";
import { InstagramConnectCard, useSocialStatus } from "./InstagramConnectCard";
import { PostCard } from "./PostCard";
import { PostSheet } from "./PostSheet";

type Sheet = { kind: "new" } | { kind: "edit"; post: SocialPostView; focus: "all" | "time" } | null;

export function SocialTab({ accountId, timeZone }: { accountId: number; timeZone: string }) {
  const { t } = useTranslation("accounts");
  const { isAgencyUser, userRole } = useWorkspace();
  const qc = useQueryClient();
  const [sheet, setSheet] = useState<Sheet>(null);
  const { data: status, isLoading: statusLoading } = useSocialStatus(accountId);
  const { data: posts, isLoading, isError } = useQuery({
    queryKey: socialPostsKey(accountId),
    queryFn: () => fetchSocialPosts(accountId),
    enabled: accountId > 0,
    staleTime: 15_000,
    // Publishing moves on by itself: keep the list fresh while the tab is open.
    refetchInterval: 60_000,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: socialPostsKey(accountId) });
  const who = { isAgency: isAgencyUser, userRole };
  const connected = connectCardMode(status) !== "not_connected";
  const sections = groupBySection(posts ?? []);

  if (statusLoading || isLoading) {
    return (
      <div role="status" aria-label={t("social.posts.loading")} style={{ padding: 24, color: "var(--mute-2)" }}>
        <Loader2 size={16} className="animate-spin" />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22, minWidth: 0 }} data-testid="social-tab">
      <header className="row" style={{ gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--ink)" }}>{t("social.posts.title")}</h3>
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--mute)" }}>
            {status?.connection?.username && connected ? t("social.posts.subtitleConnected", { username: status.connection.username }) : t("social.posts.subtitle")}
          </p>
        </div>
        {isAgencyUser && connected && !sheet && (
          <button type="button" className="la-btn la-btn--wine" onClick={() => setSheet({ kind: "new" })} data-testid="social-new-post">
            <Plus size={14} />{t("social.posts.newPost")}
          </button>
        )}
      </header>

      {!connected && <InstagramConnectCard accountId={accountId} />}

      {sheet && (
        <PostSheet
          key={sheet.kind === "edit" ? `${sheet.post.id}-${sheet.post.version}-${sheet.focus}` : "new"}
          accountId={accountId}
          timeZone={timeZone}
          post={sheet.kind === "edit" ? sheet.post : undefined}
          focus={sheet.kind === "edit" ? sheet.focus : "all"}
          onClose={() => setSheet(null)}
          onSaved={() => { setSheet(null); refresh(); }}
        />
      )}

      {isError && <p role="alert" style={{ margin: 0, fontSize: 12.5, color: "hsl(var(--destructive))" }}>{t("social.posts.loadFailed")}</p>}

      {!isError && sections.length === 0 && connected && (
        <div className="neu-inset" style={{ borderRadius: "var(--r-card)", padding: "28px 20px", textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: 13, color: "var(--mute)" }}>{t(isAgencyUser ? "social.posts.emptyAgency" : "social.posts.emptyClient")}</p>
        </div>
      )}

      {sections.map(({ section, posts: list }) => (
        <section key={section} style={{ display: "flex", flexDirection: "column", gap: 10 }} data-testid={`social-section-${section}`}>
          <header className="row" style={{ gap: 10, padding: "0 4px 8px", borderBottom: "1px solid var(--line)" }}>
            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{t(`social.posts.sections.${section}`)}</h4>
            <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--mute-2)" }}>{list.length}</span>
          </header>
          {list.map((p) => (
            <PostCard
              key={p.id}
              post={p}
              accountId={accountId}
              timeZone={timeZone}
              who={who}
              onChanged={refresh}
              onEdit={(post, focus) => setSheet({ kind: "edit", post, focus })}
            />
          ))}
        </section>
      ))}
    </div>
  );
}
