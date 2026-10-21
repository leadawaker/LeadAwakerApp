// Every post's numbers, sortable. High performers (views at least 2 x the median, see
// lib/insightsHighlight.ts) get their views in the wine color, semibold, with a trending-up icon.
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowDown, ArrowUp, ExternalLink, TrendingUp } from "lucide-react";
import type { InsightsView } from "../../api/insightsApi";
import { cell, POST_COLUMNS, sortPosts, type PostColumn } from "../../lib/insights";
import { highPerformers } from "../../lib/insightsHighlight";

export function InsightPostsTable({ v }: { v: InsightsView }) {
  const { t, i18n } = useTranslation("social");
  const [by, setBy] = useState<PostColumn | "postedAt">("views");
  const [dir, setDir] = useState<"desc" | "asc">("desc");
  const rows = useMemo(() => sortPosts(v.posts, by, dir), [v.posts, by, dir]);
  const high = useMemo(() => highPerformers(v.posts), [v.posts]);
  const sortOn = (c: PostColumn | "postedAt") => { if (c === by) setDir(dir === "desc" ? "asc" : "desc"); else { setBy(c); setDir("desc"); } };
  const date = (iso: string | null) => (iso ? new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeZone: v.timeZone }).format(new Date(iso)) : "–");
  const th = (c: PostColumn | "postedAt", label: string) => (
    <th key={c} aria-sort={by === c ? (dir === "desc" ? "descending" : "ascending") : "none"} style={{ padding: "6px 8px", textAlign: c === "postedAt" ? "left" : "right", whiteSpace: "nowrap" }}>
      <button type="button" onClick={() => sortOn(c)} style={{ all: "unset", cursor: "pointer", fontSize: 11, fontWeight: 600, color: by === c ? "var(--ink)" : "var(--mute)" }} data-testid={`insights-sort-${c}`}>
        {label}{by === c && (dir === "desc" ? <ArrowDown size={10} style={{ display: "inline", marginLeft: 2 }} /> : <ArrowUp size={10} style={{ display: "inline", marginLeft: 2 }} />)}
      </button>
    </th>
  );
  if (v.posts.length === 0) return <p style={{ margin: 0, fontSize: 12.5, color: "var(--mute)" }}>{t("insights.noPosts")}</p>;
  return (
    <div>
      <div style={{ overflowX: "auto", maxWidth: "100%" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 720 }} data-testid="insights-posts">
          <thead style={{ borderBottom: "1px solid var(--line)" }}>
            <tr>
              <th style={{ padding: "6px 8px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "var(--mute)" }}>{t("insights.post")}</th>
              {th("postedAt", t("insights.date"))}
              {POST_COLUMNS.map((c) => th(c, t(`insights.columns.${c}`)))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.igMediaId} className="transition-colors hover:bg-[var(--wine-tint)]" style={{ borderBottom: "1px solid var(--line)", height: 52 }}>
                <td style={{ padding: "6px 8px", maxWidth: 260 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--ink-soft)" }}>{p.caption || t("insights.noCaption")}</span>
                    {p.permalink && <a href={p.permalink} target="_blank" rel="noreferrer" aria-label={t("insights.open")} style={{ color: "var(--wine)", flexShrink: 0 }}><ExternalLink size={12} /></a>}
                  </span>
                </td>
                <td style={{ padding: "6px 8px", whiteSpace: "nowrap", color: "var(--mute)" }}>{date(p.postedAt)}</td>
                {POST_COLUMNS.map((c) => {
                  const hot = c === "views" && high.has(p.igMediaId);
                  return (
                    <td key={c} style={{ padding: "6px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: hot ? "var(--wine)" : "var(--ink-soft)", fontWeight: hot ? 600 : undefined }}>
                      {hot ? (
                        <span title={t("insights.highPerformer")} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <TrendingUp size={12} aria-label={t("insights.highPerformer")} role="img" />
                          {cell(c, p.metrics[c], i18n.language)}
                        </span>
                      ) : cell(c, p.metrics[c], i18n.language)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {high.size > 0 && <p style={{ margin: "8px 0 0", fontSize: 11.5, color: "var(--mute)" }}>{t("insights.highLegend")}</p>}
    </div>
  );
}
