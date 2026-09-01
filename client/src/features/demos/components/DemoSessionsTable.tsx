import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Copy, ExternalLink, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { demoOpenUrl, type DemoSession } from "../api/demoSessionsApi";

/** Column widths are fixed so the static header and the scrolling body line up:
 *  two <table>s share one <colgroup>, which is the house pattern for a list
 *  whose header must not scroll away (see TagsInlineTable). */
const COLS = [
  { key: "prospect", width: 150 },
  { key: "company", width: 190 },
  { key: "client", width: 160 },
  { key: "mode", width: 110 },
  { key: "browser", width: 130 },
  { key: "whatsapp", width: 130 },
  { key: "created", width: 110 },
  { key: "actions", width: 150 },
] as const;

type SortKey = "created" | "prospect" | "company";

function CopyButton({ value, title }: { value: string; title: string }) {
  const { t } = useTranslation("demos");
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      title={copied ? t("actions.copied") : title}
      aria-label={title}
      onClick={() => {
        navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted"
      style={{ color: "var(--mute-2)" }}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

/** One surface's progress: whether it was opened, when, and how far they got.
 *  "Never opened" is the answer this page exists to give, and a bare 0 does not
 *  say it — so the unopened case is a phrase, not a count. */
function SurfaceCell({ surface, fmt }: { surface: DemoSession["browser"]; fmt: Intl.DateTimeFormat }) {
  const { t } = useTranslation("demos");
  if (!surface.opened) {
    return <span style={{ color: "var(--mute-2)", fontSize: 12 }}>{t("status.unopened")}</span>;
  }
  return (
    <div className="flex flex-col leading-tight">
      <span
        style={{
          fontSize: 12,
          fontWeight: surface.replies > 0 ? 600 : 400,
          color: surface.replies > 0 ? "var(--ink)" : "var(--mute)",
        }}
      >
        {surface.replies > 0 ? t("status.replies", { count: surface.replies }) : t("status.opened")}
      </span>
      {surface.openedAt && (
        <span style={{ fontSize: 10.5, color: "var(--mute-2)" }}>{fmt.format(new Date(surface.openedAt))}</span>
      )}
    </div>
  );
}

export function DemoSessionsTable({ sessions }: { sessions: DemoSession[] }) {
  const { t, i18n } = useTranslation("demos");
  const [sort, setSort] = useState<SortKey>("created");
  const [asc, setAsc] = useState(false);

  const rows = useMemo(() => {
    const out = [...sessions];
    out.sort((a, b) => {
      let d = 0;
      if (sort === "created") {
        d = (a.createdAt ? Date.parse(a.createdAt) : 0) - (b.createdAt ? Date.parse(b.createdAt) : 0);
      } else if (sort === "prospect") {
        d = a.firstName.localeCompare(b.firstName);
      } else {
        d = a.companyName.localeCompare(b.companyName);
      }
      return asc ? d : -d;
    });
    return out;
  }, [sessions, sort, asc]);

  const toggleSort = (key: SortKey) => {
    if (key === sort) setAsc((v) => !v);
    else {
      setSort(key);
      setAsc(key !== "created");
    }
  };

  const dateFmt = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { day: "numeric", month: "short" }),
    [i18n.language],
  );
  // Opens carry the time as well as the day: "did they look at it right after I
  // sent it, or three days later" is the whole point of showing the moment.
  const stampFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language, {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }),
    [i18n.language],
  );

  const colgroup = (
    <colgroup>
      {COLS.map((c) => (
        <col key={c.key} style={{ width: c.width, minWidth: c.width }} />
      ))}
    </colgroup>
  );

  const sortable: Record<string, SortKey | undefined> = {
    prospect: "prospect",
    company: "company",
    created: "created",
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <table
        className="w-full shrink-0"
        style={{ tableLayout: "fixed", borderCollapse: "separate", borderSpacing: 0, minWidth: 1000 }}
      >
        {colgroup}
        <thead>
          <tr>
            {COLS.map((c) => {
              const s = sortable[c.key];
              return (
                <th
                  key={c.key}
                  onClick={s ? () => toggleSort(s) : undefined}
                  className={cn(
                    "select-none whitespace-nowrap border-b border-border/20 bg-muted px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-foreground/50",
                    s && "cursor-pointer",
                  )}
                >
                  {t(`table.${c.key}`)}
                  {s === sort ? (asc ? " ↑" : " ↓") : ""}
                </th>
              );
            })}
          </tr>
        </thead>
      </table>

      <div className="min-h-0 flex-1 overflow-auto">
        <table
          className="w-full"
          style={{ tableLayout: "fixed", borderCollapse: "separate", borderSpacing: "0 3px", minWidth: 1000 }}
        >
          {colgroup}
          <tbody>
            {rows.map((s) => {
              return (
                <tr key={s.token} className="la-lead-row h-[52px]">
                  <td className="truncate px-3" style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
                    {s.firstName || "—"}
                  </td>
                  <td className="truncate px-3" style={{ fontSize: 12.5, color: "var(--ink)" }}>
                    {s.companyName || "—"}
                  </td>
                  <td className="truncate px-3" style={{ fontSize: 12, color: "var(--mute)" }}>
                    {s.clientNiche || "—"}
                  </td>
                  <td className="px-3">
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: "var(--mute-2)",
                      }}
                    >
                      {t(`mode.${s.scenario === "deciding" ? "deciding" : "inquired"}`)}
                      {" · "}
                      {s.language.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-3">
                    <SurfaceCell surface={s.browser} fmt={stampFmt} />
                  </td>
                  <td className="px-3">
                    <SurfaceCell surface={s.whatsapp} fmt={stampFmt} />
                  </td>
                  <td className="px-3" style={{ fontSize: 12, color: "var(--mute-2)" }}>
                    {s.createdAt ? dateFmt.format(new Date(s.createdAt)) : "—"}
                  </td>
                  <td className="px-3">
                    <div className="flex items-center gap-1">
                      <a
                        href={demoOpenUrl(s.demoUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={t("actions.open")}
                        aria-label={t("actions.open")}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted"
                        style={{ color: "var(--mute-2)" }}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                      <CopyButton value={s.demoUrl} title={t("actions.copyBrowser")} />
                      <CopyButton value={s.whatsappUrl} title={t("actions.copyWhatsapp")} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function DemosLoading() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--mute-2)" }} />
    </div>
  );
}
