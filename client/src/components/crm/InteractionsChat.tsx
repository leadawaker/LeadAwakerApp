import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import DOMPurify from "dompurify";
import type { Interaction, Lead } from "@/types/models";
import { useInteractions } from "@/hooks/useApiData";
import { useWorkspace } from "@/hooks/useWorkspace";
import { cn } from "@/lib/utils";
import { DataEmptyState } from "@/components/crm/DataEmptyState";

// data-as-labels: map raw interaction type values to i18n keys
const INTERACTION_TYPE_I18N_KEY: Record<string, string> = {
  SMS: "chat.interactionTypes.SMS",
  WhatsApp: "chat.interactionTypes.WhatsApp",
  Email: "chat.interactionTypes.Email",
  Call: "chat.interactionTypes.Call",
  Note: "chat.interactionTypes.Note",
};

export function InteractionsChat({ lead }: { lead: Lead | null }) {
  const { t } = useTranslation("crm");
  const { accounts } = useWorkspace();
  const { interactions, loading } = useInteractions(
    undefined,
    lead?.id
  );
  const timezone = useMemo(() => {
    if (!lead) return "Europe/Amsterdam";
    const acct = accounts.find((a) => a.id === (lead.account_id ?? lead.accounts_id));
    return (acct?.timezone as string) || "Europe/Amsterdam";
  }, [lead, accounts]);

  const items = useMemo(() => {
    if (!lead) return [];
    return interactions
      .sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
  }, [lead, interactions]);

  return (
    <div className="h-full flex flex-col" data-testid="panel-interactions">
      <div className="px-4 py-3 border-b border-border">
        <div className="text-sm font-semibold" data-testid="text-chat-title">
          {t("chat.title")}
        </div>
        <div className="text-xs text-muted-foreground" data-testid="text-chat-subtitle">
          {lead ? `${lead.full_name} • ${lead.phone}` : t("chat.selectLead")}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-3" data-testid="list-interactions">
        {!lead ? (
          <div data-testid="empty-chat">
            <DataEmptyState
              variant="conversations"
              title={t("chat.selectLead")}
              description={t("chat.selectLeadDescription")}
              compact
            />
          </div>
        ) : loading ? (
          <div className="text-sm text-muted-foreground">{t("chat.loading")}</div>
        ) : items.length === 0 ? (
          <div data-testid="empty-chat-no-messages">
            <DataEmptyState
              variant="conversations"
              title={t("chat.noInteractions")}
              description={t("chat.noInteractionsDescription")}
              compact
            />
          </div>
        ) : (
          items.map((it) => <Bubble key={it.id} item={it} interactionTypeKey={INTERACTION_TYPE_I18N_KEY} timezone={timezone} />)
        )}
      </div>

      <div className="border-t border-border p-4 bg-background" data-testid="panel-manual-send-wrap">
        <div className="text-xs text-muted-foreground" data-testid="text-real-comment">
          {t("chat.sendViaApi")}
        </div>
      </div>
    </div>
  );
}

function Bubble({ item, interactionTypeKey, timezone }: { item: Interaction; interactionTypeKey: Record<string, string>; timezone: string }) {
  const { t } = useTranslation("crm");
  const outbound = item.direction === "Outbound";
  const typeLabel = t(interactionTypeKey[item.type] ?? `chat.interactionTypes.${item.type}`, item.type);
  return (
    <div
      className={cn("flex", outbound ? "justify-end" : "justify-start")}
      data-testid={`row-interaction-${item.id}`}
    >
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-3 py-2 text-sm border",
          outbound
            ? "bg-brand-indigo text-white border-brand-indigo/20"
            : "bg-card text-foreground border-border",
        )}
        data-testid={`bubble-interaction-${item.id}`}
      >
        <div
          className="whitespace-pre-wrap leading-relaxed [&_table]:text-[11px] [&_img]:max-w-[200px]"
          dangerouslySetInnerHTML={{
            __html: item.content?.includes("<")
              ? DOMPurify.sanitize(item.content, {
                  ALLOWED_TAGS: ["p", "br", "b", "strong", "i", "em", "a", "ul", "ol", "li", "div", "span", "table", "tr", "td", "th", "img", "hr"],
                  ALLOWED_ATTR: ["href", "target", "style", "src", "alt", "width", "height", "cellpadding", "cellspacing"],
                  ADD_ATTR: ["target"],
                })
              : (item.content ?? "").replace(/\n/g, "<br>"),
          }}
        />
        <div className={cn("mt-1 text-[11px] opacity-80", outbound ? "text-white/80" : "text-muted-foreground")}>
          {item.created_at ? new Date(item.created_at).toLocaleString([], { timeZone: timezone }) : ""} • {typeLabel}
        </div>
      </div>
    </div>
  );
}
