import { useTranslation } from "react-i18next";
import { ChevronRight, FolderOpen, UserRound } from "lucide-react";
import { SectionCard } from "@/components/crm/primitives";
import type { DemoClientSummary } from "../../api/demoClientsApi";
import { LANGS, clientNames } from "./clientDisplay";

/** Which languages a persona is written in, as three fixed slots so the column lines up down the list. */
function LangMarks({ client, inline = false }: { client: DemoClientSummary; inline?: boolean }) {
  const { t } = useTranslation("campaigns");
  if (client.languages.length === 0) {
    return inline ? null : <span className="am-mono" style={{ color: "var(--mute-2)" }}>{t("clients.wordsOnly")}</span>;
  }
  return (
    <span className={`dp-langs${inline ? " dp-langs--inline" : ""}`} aria-label={client.languages.map((l) => t(`clients.langName.${l}`)).join(", ")}>
      {LANGS.filter((l) => !inline || client.languages.includes(l)).map((l) => (
        <span key={l} className={client.languages.includes(l) ? "on" : "off"} aria-hidden>{l.toUpperCase()}</span>
      ))}
    </span>
  );
}

/** One persona as a table-like row: who it plays, its languages, when it last changed. */
function ClientRow({ client, selected, formatDate, onClick }: {
  client: DemoClientSummary;
  selected: boolean;
  formatDate: (iso: string) => string;
  onClick: () => void;
}) {
  const { t } = useTranslation("campaigns");
  const { title, sub } = clientNames(client);

  return (
    <button
      type="button"
      className={`am-row dp-row${selected ? " is-selected" : ""}`}
      onClick={onClick}
      aria-pressed={selected}
      data-niche={client.niche}
      data-testid={`persona-row-${client.id}`}
    >
      <span className="am-icon-tile" aria-hidden>
        {client.emoji ? <span className="dp-emoji">{client.emoji}</span> : <UserRound className="h-4 w-4" />}
      </span>
      <div style={{ minWidth: 0 }}>
        <div className="dp-title-line">
          <span className="am-name">{title}</span>
          {client.isLive && <span className="dp-live">{t("clients.live.badge")}</span>}
        </div>
        <div className="am-desc" title={sub || undefined}>
          <LangMarks client={client} inline />
          {sub}
        </div>
      </div>
      <div className="dp-col-langs"><LangMarks client={client} /></div>
      <div className="dp-col-when am-mono" style={{ textAlign: "right" }} title={client.updatedAt ? new Date(client.updatedAt).toLocaleString() : undefined}>
        {client.updatedAt ? formatDate(client.updatedAt) : ""}
      </div>
      <div className="dp-col-id am-mono" style={{ textAlign: "right", color: "var(--mute-2)" }}>#{client.id}</div>
      <ChevronRight className="am-chev h-4 w-4" />
    </button>
  );
}

/** One category as a card: what is filed under it in a line, then its personas. */
export function ClientCategorySection({ label, uncategorized, items, selectedNiche, formatDate, onSelect }: {
  label: string;
  uncategorized: boolean;
  items: DemoClientSummary[];
  selectedNiche: string | null;
  formatDate: (iso: string) => string;
  onSelect: (niche: string) => void;
}) {
  const { t } = useTranslation("campaigns");
  // The category's own picture: the emoji most of its personas carry.
  const tally = new Map<string, number>();
  for (const c of items) if (c.emoji) tally.set(c.emoji, (tally.get(c.emoji) ?? 0) + 1);
  const emoji = uncategorized ? null : Array.from(tally.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const blurb = uncategorized
    ? t("clients.uncategorizedBlurb")
    : Array.from(new Set(items.map((c) => (c.label || c.niche).trim()).filter(Boolean))).join(", ");

  return (
    <SectionCard padded={false} className="overflow-hidden">
      <div className="am-section-head">
        <span className="am-icon-tile" aria-hidden>
          {emoji ? <span className="dp-emoji">{emoji}</span> : <FolderOpen className="h-4 w-4" />}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="am-section-title">{label}</div>
          <div className="dp-section-blurb" title={blurb}>{blurb}</div>
        </div>
        <span className="am-mono" title={t("clients.countTitle", { count: items.length })}>{items.length}</span>
      </div>
      <div>
        {items.map((c) => (
          <ClientRow key={c.id} client={c} selected={selectedNiche === c.niche} formatDate={formatDate} onClick={() => onSelect(c.niche)} />
        ))}
      </div>
    </SectionCard>
  );
}
