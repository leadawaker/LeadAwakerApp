import { useTranslation } from "react-i18next";
import { ChevronRight, Trash2 } from "lucide-react";
import type { DemoClientSummary } from "../../api/demoClientsApi";
import { ClientThumb } from "./ClientThumb";
import { LANGS, clientNames } from "./clientDisplay";
import { canDeletePersona, personaDate, type ListLayout } from "./personaView";
import "./personaRows.css";
import "./personaCards.css";

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

/**
 * One persona: its picture, the name large with a line under it, its languages,
 * when it was added, and Delete. No icon or emoji per persona. Shown as a roomy row
 * in the vertical list (a persona is open) or as a small bordered card in the grid
 * (nothing open). Both are the same element with the same children, only the class
 * differs (`.dp-row` / `.dp-card`), so opening a persona from the keyboard keeps focus
 * on its name button while the card turns into a row.
 *
 * The row is not itself a button (Delete sits inside it, and a button may not hold a
 * button): the name is the button, stretched over the whole row by `.dp-open::after`,
 * and Delete sits above that layer.
 */
export function ClientRow({ client, layout, selected, showCategory, formatDate, onOpen, onDelete }: {
  client: DemoClientSummary;
  layout: ListLayout;
  selected: boolean;
  /** Date sections lose the category heading, so the row names it. */
  showCategory: boolean;
  formatDate: (iso: string) => string;
  onOpen: () => void;
  onDelete: (niche: string) => void;
}) {
  const { t } = useTranslation("campaigns");
  const { t: td } = useTranslation("demos");
  const card = layout === "cards";
  const { title, sub } = clientNames(client);
  const date = personaDate(client);
  const category = (client.category ?? "").trim();
  const dateTitle = [
    client.createdAt && td("personaList.addedOn", { date: new Date(client.createdAt).toLocaleString() }),
    client.updatedAt && td("personaList.updatedOn", { date: new Date(client.updatedAt).toLocaleString() }),
  ].filter(Boolean).join("\n");

  return (
    <div
      className={`${card ? "dp-card" : "am-row dp-row"}${selected ? " is-selected" : ""}`}
      data-niche={client.niche}
      data-testid={`persona-row-${client.id}`}
    >
      <ClientThumb key={`${client.logo}|${client.screenshot}`} client={client} name={title} />

      <div className="dp-who">
        <div className="dp-title-line">
          <button type="button" className="dp-open" onClick={onOpen} aria-pressed={selected} title={title}>
            <span className="am-name dp-name">{title}</span>
          </button>
          {client.isLive && <span className="dp-live">{t("clients.live.badge")}</span>}
        </div>
        <div className="am-desc dp-sub" title={sub || undefined}>
          <LangMarks client={client} inline />
          {showCategory && category && <span className="dp-cat-tag">{category}</span>}
          {sub}
        </div>
      </div>

      <div className="dp-col-langs"><LangMarks client={client} /></div>

      <div className="dp-col-when" title={dateTitle || undefined}>
        <span className="dp-date">{date ? formatDate(date) : ""}</span>
        <span className="am-mono dp-id">#{client.id}</span>
      </div>

      <div className="dp-col-del">
        {canDeletePersona(client) && (
          <button
            type="button"
            className="dp-del"
            onClick={() => onDelete(client.niche)}
            title={td("personaList.delete", { name: title })}
            aria-label={td("personaList.delete", { name: title })}
            data-testid={`persona-delete-${client.id}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {!card && <ChevronRight className="am-chev h-4 w-4" />}
    </div>
  );
}
