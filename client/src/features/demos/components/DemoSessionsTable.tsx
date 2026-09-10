import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Copy, ExternalLink, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { demoOpenUrl, useUpdateDemoIdentity, type DemoSession } from "../api/demoSessionsApi";
import { SERVICES } from "../services";
import { groupProspects, type ProspectRow } from "../prospectRows";
import { ServiceCell } from "./ServiceCell";

/** Column widths are fixed so the static header and the scrolling body line up:
 *  two <table>s share one <colgroup>, which is the house pattern for a list
 *  whose header must not scroll away (see TagsInlineTable). */
const LEAD_COLS = [
  { key: "prospect", width: 140 },
  { key: "company", width: 160 },
  { key: "client", width: 140 },
] as const;
const TAIL_COLS = [{ key: "created", width: 90 }] as const;
const SERVICE_WIDTH = 104;
const OTHER_WIDTH = 92;

type SortKey = "created" | "prospect" | "company";

/**
 * A name that can be fixed after the link was sent.
 *
 * Click to edit, Enter or blur to save, Escape to abandon. The write fans out
 * to every link this prospect holds, so the name cannot end up right on the
 * voice demo and wrong on the chat one.
 */
function EditableCell({
  value,
  placeholder,
  tokens,
  field,
  style,
}: {
  value: string;
  placeholder: string;
  tokens: string[];
  field: "firstName" | "companyName";
  style: React.CSSProperties;
}) {
  const { t } = useTranslation("demos");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const update = useUpdateDemoIdentity();

  const commit = () => {
    setEditing(false);
    const next = draft.trim();
    // A first name is the one field the server will not take empty, and
    // clearing it is never what a mis-click meant.
    if (next === value || (field === "firstName" && !next)) return setDraft(value);
    update.mutate({ tokens, [field]: next });
  };

  if (!editing) {
    return (
      <button
        type="button"
        title={t("table.editHint")}
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        className="w-full truncate rounded px-1 py-0.5 text-left hover:bg-muted"
        style={style}
      >
        {update.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : value || placeholder}
      </button>
    );
  }

  return (
    <input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") {
          setDraft(value);
          setEditing(false);
        }
      }}
      className="w-full rounded px-1 py-0.5"
      style={{
        ...style,
        border: "1px solid var(--line)",
        background: "var(--bg)",
        fontFamily: "var(--sans)",
      }}
    />
  );
}

/** Links with no service column to sit in: an older duplicate, or a link on a
 *  campaign that is not one of the services. Rare, and never dropped. */
function OtherCell({ sessions }: { sessions: DemoSession[] }) {
  const { t } = useTranslation("demos");
  const [copied, setCopied] = useState("");
  if (!sessions.length) return <span style={{ fontSize: 12, color: "var(--mute-2)" }}>—</span>;

  return (
    <div className="flex flex-wrap items-center gap-0.5">
      {sessions.map((s) => (
        <span key={s.token} className="flex items-center">
          <button
            type="button"
            title={t("services.copy")}
            aria-label={t("services.copy")}
            onClick={() => {
              void navigator.clipboard.writeText(s.demoUrl);
              setCopied(s.token);
              setTimeout(() => setCopied(""), 1500);
            }}
            className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-muted"
            style={{ color: "var(--mute-2)" }}
          >
            {copied === s.token ? (
              <Check className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
          <a
            href={demoOpenUrl(s.demoUrl)}
            target="_blank"
            rel="noopener noreferrer"
            title={t("services.open")}
            aria-label={t("services.open")}
            className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-muted"
            style={{ color: "var(--mute-2)" }}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </span>
      ))}
    </div>
  );
}

export function DemoSessionsTable({ sessions }: { sessions: DemoSession[] }) {
  const { t, i18n } = useTranslation("demos");
  const [sort, setSort] = useState<SortKey>("created");
  const [asc, setAsc] = useState(false);

  const rows = useMemo(() => {
    const out = groupProspects(sessions);
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

  // The column only earns its width when something is in it, and for links
  // minted since services were tagged that is never.
  const hasOther = rows.some((r) => r.extra.length > 0);

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

  const colgroup = (
    <colgroup>
      {LEAD_COLS.map((c) => (
        <col key={c.key} style={{ width: c.width, minWidth: c.width }} />
      ))}
      {SERVICES.map((s) => (
        <col key={s.key} style={{ width: SERVICE_WIDTH, minWidth: SERVICE_WIDTH }} />
      ))}
      {hasOther && <col style={{ width: OTHER_WIDTH, minWidth: OTHER_WIDTH }} />}
      {TAIL_COLS.map((c) => (
        <col key={c.key} style={{ width: c.width, minWidth: c.width }} />
      ))}
    </colgroup>
  );

  const minWidth =
    LEAD_COLS.reduce((n, c) => n + c.width, 0) +
    SERVICES.length * SERVICE_WIDTH +
    (hasOther ? OTHER_WIDTH : 0) +
    TAIL_COLS.reduce((n, c) => n + c.width, 0);

  const headClass =
    "select-none whitespace-nowrap border-b border-border/20 bg-muted px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-foreground/50";
  const sortable: Record<string, SortKey | undefined> = {
    prospect: "prospect",
    company: "company",
    created: "created",
  };

  const header = (key: string) => {
    const s = sortable[key];
    return (
      <th key={key} onClick={s ? () => toggleSort(s) : undefined} className={cn(headClass, s && "cursor-pointer")}>
        {t(`table.${key}`)}
        {s === sort ? (asc ? " ↑" : " ↓") : ""}
      </th>
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <table
        className="w-full shrink-0"
        style={{ tableLayout: "fixed", borderCollapse: "separate", borderSpacing: 0, minWidth }}
      >
        {colgroup}
        <thead>
          <tr>
            {LEAD_COLS.map((c) => header(c.key))}
            {SERVICES.map((s) => (
              <th key={s.key} className={headClass} title={t(s.labelKey)}>
                <span className="flex items-center gap-1">
                  <s.icon size={11} />
                  {t(`table.svc.${s.key}`)}
                </span>
              </th>
            ))}
            {hasOther && <th className={headClass}>{t("table.other")}</th>}
            {TAIL_COLS.map((c) => header(c.key))}
          </tr>
        </thead>
      </table>

      <div className="min-h-0 flex-1 overflow-auto">
        <table
          className="w-full"
          style={{ tableLayout: "fixed", borderCollapse: "separate", borderSpacing: "0 3px", minWidth }}
        >
          {colgroup}
          <tbody>
            {rows.map((row) => (
              <ProspectTableRow key={row.key} row={row} dateFmt={dateFmt} hasOther={hasOther} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProspectTableRow({
  row,
  dateFmt,
  hasOther,
}: {
  row: ProspectRow;
  dateFmt: Intl.DateTimeFormat;
  hasOther: boolean;
}) {
  return (
    <tr className="la-lead-row h-[56px]">
      <td className="px-2">
        <EditableCell
          value={row.firstName}
          placeholder="—"
          tokens={row.tokens}
          field="firstName"
          style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}
        />
      </td>
      <td className="px-2">
        <EditableCell
          value={row.companyName}
          placeholder="—"
          tokens={row.tokens}
          field="companyName"
          style={{ fontSize: 12.5, color: "var(--ink)" }}
        />
      </td>
      <td className="truncate px-3" style={{ fontSize: 12, color: "var(--mute)" }}>
        {row.clientNiche || "—"}
      </td>
      {SERVICES.map((svc) => (
        <td key={svc.key} className="px-3">
          <ServiceCell svc={svc} row={row} session={row.byService[svc.key]} fmt={dateFmt} />
        </td>
      ))}
      {hasOther && (
        <td className="px-3">
          <OtherCell sessions={row.extra} />
        </td>
      )}
      <td className="px-3" style={{ fontSize: 12, color: "var(--mute-2)" }}>
        {row.createdAt ? dateFmt.format(new Date(row.createdAt)) : "—"}
      </td>
    </tr>
  );
}

export function DemosLoading() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--mute-2)" }} />
    </div>
  );
}
