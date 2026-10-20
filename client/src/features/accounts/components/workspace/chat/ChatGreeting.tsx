// Chat > Greeting: the line the website chat opens with (stored on the widget,
// the same field Integrations > Website chat edits) and how WhatsApp starts.
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Globe, MessageCircle } from "lucide-react";
import { EditText, InfoRow } from "@/features/campaigns/components/formFields";
import type { WidgetConfigRow } from "../../../api/widgetApi";
import { ChatCard, helpStyle } from "./chatAtoms";

export function ChatGreeting({ widget, canEdit, onSaveWidget }: {
  widget: WidgetConfigRow | null; canEdit: boolean; onSaveWidget: (body: Partial<WidgetConfigRow>) => Promise<boolean>;
}) {
  const { t } = useTranslation("chatTab");
  const server = widget?.greeting ?? "";
  const [text, setText] = useState(server);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  useEffect(() => { setText(server); }, [server]);

  // Saves when the field is left, like the Integrations card.
  const commit = async () => {
    if (!widget || text === server) return;
    setState("saving");
    setState((await onSaveWidget({ greeting: text })) ? "saved" : "failed");
  };

  return (
    <>
      <ChatCard icon={<Globe size={17} />} title={t("greeting.websiteTitle")} testId="chat-greeting-website">
        <p style={helpStyle}>{t("greeting.websiteHelp")}</p>
        {!widget ? (
          <p style={{ ...helpStyle, margin: 0, color: "var(--ink-soft)" }}>{t(canEdit ? "greeting.noWidget" : "greeting.agencyOnly")}</p>
        ) : (
          <InfoRow
            label={t("greeting.websiteLabel")}
            value={server || null}
            noBorder
            editChild={canEdit ? (
              <div data-testid="chat-greeting-input">
                <EditText value={text} onChange={setText} onBlur={commit} multiline minRows={2} placeholder={t("greeting.websitePlaceholder")} />
              </div>
            ) : undefined}
          />
        )}
        {state !== "idle" && (
          <p role={state === "failed" ? "alert" : "status"} style={{ ...helpStyle, margin: "8px 0 0", color: state === "failed" ? "var(--stage-lost)" : "var(--mute)" }}>
            {t(`greeting.${state}`)}
          </p>
        )}
      </ChatCard>

      <ChatCard icon={<MessageCircle size={17} />} title={t("greeting.whatsappTitle")} testId="chat-greeting-whatsapp">
        <p style={{ ...helpStyle, margin: 0 }}>{t("greeting.whatsappHelp")}</p>
      </ChatCard>
    </>
  );
}
