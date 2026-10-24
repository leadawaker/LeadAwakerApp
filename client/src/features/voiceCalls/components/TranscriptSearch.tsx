import { useTranslation } from "react-i18next";
import { ExpandingSearch } from "@/components/crm/primitives";

/**
 * Transcript search as a round icon beside Download: it opens into a field on
 * click and folds back once left empty. Escape or the cross clears it.
 * A thin wrapper over the shared ExpandingSearch.
 */
export function TranscriptSearch({ query, onQuery, matches }: { query: string; onQuery: (q: string) => void; matches: number }) {
  const { t } = useTranslation("voiceCalls");
  return <ExpandingSearch value={query} onChange={onQuery} placeholder={t("searchTranscript")} matchCount={matches} width={240} />;
}
