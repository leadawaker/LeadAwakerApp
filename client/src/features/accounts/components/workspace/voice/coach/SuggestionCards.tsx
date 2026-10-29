// The change cards the call review and the coach propose for the shared ElevenLabs
// prompt (Voice tab, Prompt & test, Owner only), folded to a title with the open count.
// Open, it has three lists: still open, accepted (waiting in the draft) and done (live or
// rejected), each card folded to its title. Accept and Reject are per card.
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ListChecks, Loader2 } from "lucide-react";
import type { SuggestionDto, SuggestionStatus } from "@shared/voiceReview";
import { helpStyle } from "../voiceAtoms";
import { useSuggestions } from "./coachApi";
import { Fold } from "./Fold";
import { SuggestionItem } from "./SuggestionItem";

const TABS = ["open", "accepted", "done"] as const;
type Tab = (typeof TABS)[number];

const TAB_OF: Record<SuggestionStatus, Tab> = {
  proposed: "open", stale: "open", accepted: "accepted", live: "done", rejected: "done",
};

export function SuggestionCards({ accountId }: { accountId: number }) {
  const { t } = useTranslation("voiceCoach");
  const suggestions = useSuggestions(accountId);
  const [tab, setTab] = useState<Tab>("open");

  const byTab = useMemo(() => {
    const groups: Record<Tab, SuggestionDto[]> = { open: [], accepted: [], done: [] };
    for (const card of suggestions.data ?? []) groups[TAB_OF[card.status]].push(card);
    return groups;
  }, [suggestions.data]);
  const shown = byTab[tab];

  return (
    <Fold
      title={t("cards.title")} icon={<ListChecks size={15} />} rememberAs={`cards-${accountId}`} testId="voice-cards"
      note={suggestions.data ? t("cards.openCount", { count: byTab.open.length }) : undefined}
    >
      <p style={helpStyle}>{t("cards.help")}</p>
      <div className="la-seg la-seg--main la-seg--soft" role="tablist" aria-label={t("cards.tabsLabel")} style={{ marginBottom: 14, flexWrap: "wrap", maxWidth: "100%" }}>
        {TABS.map((id) => (
          <button
            key={id} type="button" role="tab" aria-selected={tab === id} className={`la-seg-btn${tab === id ? " on" : ""}`}
            style={{ paddingInline: 9 }} onClick={() => setTab(id)} data-testid={`voice-cards-tab-${id}`}
          >
            {t(`cards.tabs.${id}`)}
            <span style={{ opacity: 0.7 }}>{byTab[id].length}</span>
          </button>
        ))}
      </div>

      {suggestions.isLoading && (
        <div style={{ display: "flex", justifyContent: "center", padding: 24, color: "var(--mute)" }}><Loader2 className="h-5 w-5 animate-spin" /></div>
      )}
      {suggestions.isError && !suggestions.data && <p role="alert" style={{ ...helpStyle, color: "var(--stage-lost)" }}>{t("cards.loadFailed")}</p>}
      {suggestions.data && shown.length === 0 && <p style={{ ...helpStyle, margin: 0 }} data-testid="voice-cards-empty">{t(`cards.empty.${tab}`)}</p>}
      {shown.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }} data-testid="voice-cards-list">
          {shown.map((card) => <SuggestionItem key={card.id} card={card} accountId={accountId} folded />)}
        </div>
      )}
    </Fold>
  );
}
