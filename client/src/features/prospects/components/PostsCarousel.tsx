import { useState } from "react";
import { ChevronLeft, ChevronRight, Heart, ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";

export interface CarouselPost {
  title: string;
  date: string;
  reactions: number;
  url?: string;
}

/**
 * Display up to N posts one at a time with left/right arrow navigation.
 * Tolerates data stored as JSON string or array.
 */
export function PostsCarousel({
  posts,
  label,
}: {
  posts: unknown;
  label: string;
}) {
  const { t } = useTranslation("prospects");
  const list = normalizePosts(posts);
  const [index, setIndex] = useState(0);

  if (list.length === 0) return null;

  const current = list[index];
  const count = list.length;
  const canPrev = count > 1;
  const canNext = count > 1;

  return (
    <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-border/60 shadow-sm">
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-[10px] font-bold uppercase tracking-widest text-brand-indigo dark:text-blue-400">
          {label}
        </div>
        {count > 1 && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={!canPrev}
              onClick={() => setIndex((i) => (i - 1 + count) % count)}
              className="p-0.5 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label={t("enrich.previousPost", "Previous post")}
            >
              <ChevronLeft className="h-3.5 w-3.5 text-brand-indigo" />
            </button>
            <span className="text-[10px] text-foreground/50 font-medium tabular-nums">
              {index + 1} / {count}
            </span>
            <button
              type="button"
              disabled={!canNext}
              onClick={() => setIndex((i) => (i + 1) % count)}
              className="p-0.5 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label={t("enrich.nextPost", "Next post")}
            >
              <ChevronRight className="h-3.5 w-3.5 text-brand-indigo" />
            </button>
          </div>
        )}
      </div>

      <div className="text-[12px] text-foreground/80 leading-relaxed italic mb-2">
        {current.title}
      </div>

      <div className="flex items-center gap-3 text-[10px] text-foreground/50">
        {current.date && <span>{formatDate(current.date)}</span>}
        {typeof current.reactions === "number" && (
          <span className="flex items-center gap-0.5">
            <Heart className="h-2.5 w-2.5" /> {current.reactions}
          </span>
        )}
        {current.url && (
          <a
            href={current.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-0.5 text-brand-indigo hover:underline ml-auto"
          >
            <ExternalLink className="h-2.5 w-2.5" /> {t("enrich.open", "Open")}
          </a>
        )}
      </div>
    </div>
  );
}

function normalizePosts(raw: unknown): CarouselPost[] {
  if (!raw) return [];
  let arr: unknown = raw;
  if (typeof raw === "string") {
    try { arr = JSON.parse(raw); } catch { return []; }
  }
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((p): p is Record<string, unknown> => !!p && typeof p === "object")
    .map((p) => ({
      title: String(p.title ?? ""),
      date: String(p.date ?? ""),
      reactions: Number(p.reactions ?? 0),
      url: p.url ? String(p.url) : undefined,
    }))
    .filter((p) => p.title.length > 0);
}

function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
