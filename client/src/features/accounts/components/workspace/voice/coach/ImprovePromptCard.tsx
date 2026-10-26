// Under the ElevenLabs draft (Voice tab, Prompt & test, Owner only): one card with three folded
// rows, the call review, the change cards it and the coach propose, and the coach itself.
// Folded, the card is three titles tall.
import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";
import type { PromptLang } from "@shared/voiceReview";
import { VoiceCardShell } from "../voiceAtoms";
import { CoachPanel } from "./CoachPanel";
import { ReviewCard } from "./ReviewCard";
import { SuggestionCards } from "./SuggestionCards";

export function ImprovePromptCard({ accountId, lang }: { accountId: number; lang: PromptLang }) {
  const { t } = useTranslation("voiceCoach");
  const rows = [
    <ReviewCard key="review" accountId={accountId} />,
    <SuggestionCards key="cards" accountId={accountId} />,
    <CoachPanel key="coach" accountId={accountId} lang={lang} />,
  ];
  return (
    <VoiceCardShell card="promptReview" icon={<Sparkles size={17} />} title={t("improve.title")}>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {rows.map((row, i) => (
          <Fragment key={row.key}>
            {i > 0 && <div className="rule" />}
            {row}
          </Fragment>
        ))}
      </div>
    </VoiceCardShell>
  );
}
