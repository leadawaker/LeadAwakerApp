// Hours and knowledge base: the Voice tab reuses the Account's own cards instead
// of rebuilding them. Both save on their own, so the wrapper nudges the voice
// line (readiness, kbCount) to refetch shortly after the user interacts.
import { useEffect, useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { BookOpen, CalendarClock } from "lucide-react";
import { AvailabilityCard } from "../AvailabilityCard";
import { KBPanel } from "../knowledge/KBPanel";
import { VoiceCardShell, ReadOnlyValue } from "./voiceAtoms";
import { cardAnchorId, type VoiceCard } from "./readiness";
import type { VoiceLine } from "./voiceApi";

function RefetchOnActivity({ card, onChanged, children }: { card: VoiceCard; onChanged: () => void; children: ReactNode }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const nudge = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(onChanged, 1500);
  };
  return (
    <div id={cardAnchorId(card)} style={{ scrollMarginTop: 96 }} data-testid={`voice-card-${card}`} onClickCapture={nudge} onBlurCapture={nudge}>
      {children}
    </div>
  );
}

export function HoursCard({ line, canEdit, onChanged }: { line: VoiceLine; canEdit: boolean; onChanged: () => void }) {
  const { t } = useTranslation("voiceTab");
  if (canEdit) {
    return (
      <RefetchOnActivity card="hours" onChanged={onChanged}>
        <div className="neu-raised" style={{ borderRadius: "var(--r-card)", overflow: "hidden" }}>
          <AvailabilityCard accountId={line.accountId} />
        </div>
      </RefetchOnActivity>
    );
  }
  const { start, end, timezone } = line.hours;
  const text = start && end ? `${start} – ${end}${timezone ? ` · ${timezone}` : ""}` : "";
  return (
    <VoiceCardShell card="hours" icon={<CalendarClock size={17} />} title={t("hours.title")}>
      <ReadOnlyValue value={text} />
    </VoiceCardShell>
  );
}

export function KnowledgeCard({ line, canEdit, onChanged }: { line: VoiceLine; canEdit: boolean; onChanged: () => void }) {
  const { t } = useTranslation("voiceTab");
  if (canEdit) {
    return (
      <RefetchOnActivity card="knowledge" onChanged={onChanged}>
        <KBPanel accountId={line.accountId} />
      </RefetchOnActivity>
    );
  }
  return (
    <VoiceCardShell card="knowledge" icon={<BookOpen size={17} />} title={t("knowledge.title")}>
      <ReadOnlyValue value={t("knowledge.count", { count: line.kbCount })} />
    </VoiceCardShell>
  );
}
