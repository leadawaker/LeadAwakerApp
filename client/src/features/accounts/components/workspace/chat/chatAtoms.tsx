// Small shared pieces for the Chat tab: the card shell, a switch row, and the
// edit props every section gets. Inputs themselves are the campaign settings'
// own fields (InfoRow, EditText, EditSelect), so both pages look and save alike.
import { RequestChangeNote } from "@/components/crm/RequestChangeNote";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { resolveLang, setLang } from "@shared/langField";
import { Panel } from "../atoms";
import type { ChatCampaign } from "./useChatCampaign";

export const helpStyle = { fontSize: 12.5, color: "var(--mute)", margin: "0 0 12px", lineHeight: 1.5 } as const;

/** What every editing section receives: the campaign, the shared draft and whether it may change it. */
export interface ChatEdit {
  campaign: ChatCampaign;
  draft: Record<string, unknown>;
  setDraft: Dispatch<SetStateAction<Record<string, unknown>>>;
  canEdit: boolean;
}

export function ChatCard({ icon, title, action, children, testId }: {
  icon?: ReactNode; title: ReactNode; action?: ReactNode; children: ReactNode; testId?: string;
}) {
  return (
    <div data-testid={testId}>
      <Panel icon={icon} title={title} action={action} pad={20}>{children}</Panel>
    </div>
  );
}

export function SwitchRow({ checked, onChange, label, help, disabled, saving, testId }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; help?: string; disabled?: boolean; saving?: boolean; testId?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 0" }}>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} aria-label={label} data-testid={testId} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13.5, color: "var(--ink)", fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
          {label}
          {saving && <Loader2 size={13} className="animate-spin" style={{ color: "var(--mute-2)" }} />}
        </div>
        {help && <div style={{ ...helpStyle, margin: "2px 0 0" }}>{help}</div>}
      </div>
    </div>
  );
}

/** Replaces the old read-only banner: Lead Awaker looks after this, with a "Request a change" button. */
export function ReadOnlyNote() {
  const { t } = useTranslation("crm");
  return <RequestChangeNote area={t("requestChange.areas.chat")} />;
}

/** Two-language text fields ({en, nl} JSON): read and write the UI language's half, as the campaign settings do. */
export function useLocalized({ campaign, draft, setDraft }: Pick<ChatEdit, "campaign" | "draft" | "setDraft">) {
  const { i18n } = useTranslation();
  const lang = i18n.language?.startsWith("nl") ? "nl" : "en";
  const raw = (field: string) => draft[field] ?? campaign[field];
  return {
    get: (field: string) => resolveLang(raw(field), lang),
    set: (field: string, text: string) => setDraft((d) => ({ ...d, [field]: setLang(d[field] ?? campaign[field], lang, text) })),
  };
}

/** "09:00:00" (Postgres time) to "09:00". */
export const hhmm = (v: unknown) => (typeof v === "string" && v ? v.slice(0, 5) : "");
