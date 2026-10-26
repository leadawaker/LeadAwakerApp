// Voice tab "Prompt & test" (Owner only): everything she is told, editable
// next to the test call, saved as you type. The call button first, then who
// she is (name, voice, language), this business's own text (greeting,
// instructions), then the two prompts every client line in this language shares
// (on an ElevenLabs line: the draft, then one folded card with the call review, its change cards and the coach).
import { useEffect, useRef, useState } from "react";
import { BookOpen, Loader2, MessageSquareQuote, NotebookPen, Waves } from "lucide-react";
import { useVoiceT } from "./voiceGender";
import { VoiceCardShell, helpStyle, inputStyle } from "./voiceAtoms";
import { EXTRA_INSTRUCTIONS_MAX, type VoiceLine, type VoiceLinePatch } from "./voiceApi";
import { TestCard } from "./TestCard";
import { AgentVoiceCard } from "./AgentVoiceCard";
import { LineEngineCard } from "./LineEngineCard";
import { PromptCounts } from "./PromptCounts";
import { runsOnEleven } from "./lineEngine";
import { useAutosave } from "./useAutosave";
import { AutosaveBadge, SharedPromptCard } from "./SharedPromptCard";
import { useAccountVoicePrompts, useSaveVoicePrompt } from "./voicePromptsApi";
import { ElevenDraftCard } from "./coach/ElevenDraftCard";
import { ImprovePromptCard } from "./coach/ImprovePromptCard";
import { promptLangOf } from "./coach/coachApi";
import type { VoiceCard } from "./readiness";

const GREETING_MAX = 500;

function AccountTextCard({ card, icon, title, help, shared, value, max, rows, onSave }: {
  card: VoiceCard; icon: React.ReactNode; title: string; help: string; shared?: string;
  value: string; max: number; rows: number; onSave: (text: string) => Promise<boolean>;
}) {
  const [text, setText] = useState(value);
  // A save elsewhere (a name change rewrites the greeting) moves the server
  // value: follow it unless something is being typed here.
  const seen = useRef(value);
  useEffect(() => {
    setText((cur) => (cur === seen.current ? value : cur));
    seen.current = value;
  }, [value]);
  const over = text.length > max;
  // Over the limit the server refuses it: hold the save until it fits.
  const state = useAutosave(over ? value : text, value, onSave);
  return (
    <VoiceCardShell card={card} icon={icon} title={title} action={<AutosaveBadge state={state} />}>
      <p style={helpStyle}>{help}</p>
      {shared && <p style={helpStyle} data-testid={`voice-shared-${card}`}>{shared}</p>}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={rows}
        className="neu-inset-crisp"
        style={{ ...inputStyle, padding: "11px 13px", resize: "vertical", lineHeight: 1.5 }}
        aria-label={title}
      />
      <div style={{ marginTop: 6, textAlign: "right", fontFamily: "var(--mono)", fontSize: 10.5, letterSpacing: "0.08em", color: over ? "var(--stage-lost)" : "var(--mute)" }}>
        {text.length} / {max}
      </div>
      <PromptCounts text={text} />
    </VoiceCardShell>
  );
}

export function PromptSection({ line, canEdit, saving, onSave }: {
  line: VoiceLine; canEdit: boolean; saving: boolean; onSave: (patch: VoiceLinePatch) => Promise<boolean>;
}) {
  const { t } = useVoiceT();
  const prompts = useAccountVoicePrompts(line.accountId, line.locale);
  const savePrompt = useSaveVoicePrompt(line.accountId);
  const language = line.locale ?? "";
  const onEleven = runsOnEleven(line.number);

  // These two texts are the account's: the client line on it reads the same ones.
  const clientLines = (line.otherLines ?? []).map((l) => l.phoneNumber).join(", ");
  const shared = onEleven && clientLines ? t("agent.alsoUsedBy", { number: clientLines }) : undefined;
  const eleven = prompts.data?.eleven;

  return (
    <>
      <TestCard line={line} canEdit={canEdit} saving={saving} onSave={onSave} />
      <AgentVoiceCard line={line} canEdit={canEdit} saving={saving} onSave={onSave} />
      <LineEngineCard line={line} />
      <AccountTextCard
        card="promptGreeting"
        icon={<MessageSquareQuote size={17} />}
        title={t("prompt.greeting.title")}
        help={t("prompt.greeting.help")}
        shared={shared}
        value={line.greeting ?? ""}
        max={GREETING_MAX}
        rows={2}
        onSave={(greeting) => onSave({ greeting })}
      />
      {/* Extra instructions are GPT Live's: the ElevenLabs prompt leaves them out. */}
      {!onEleven && <AccountTextCard
        card="promptExtra"
        icon={<NotebookPen size={17} />}
        title={t("extra.title")}
        help={t("prompt.extra.help")}
        shared={shared}
        value={line.extraInstructions ?? ""}
        max={EXTRA_INSTRUCTIONS_MAX}
        rows={6}
        onSave={(extraInstructions) => onSave({ extraInstructions })}
      />}
      {prompts.isLoading && (
        <div style={{ display: "flex", justifyContent: "center", padding: 24, color: "var(--mute)" }}>
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}
      {!line.locale && !prompts.isLoading && <p style={helpStyle}>{t("prompt.noLanguage")}</p>}
      {prompts.isError && <p style={{ ...helpStyle, color: "var(--stage-lost)" }}>{t("common.loadFailed")}</p>}
      {!onEleven && prompts.data?.layer && (
        <SharedPromptCard
          key={`layer-${prompts.data.layer.id}`}
          card="promptLayer"
          kind="layer"
          accountId={line.accountId}
          icon={<Waves size={17} />}
          title={t("prompt.layer.title", { language })}
          help={t("prompt.layer.help")}
          row={prompts.data.layer}
          onSave={savePrompt}
        />
      )}
      {!onEleven && prompts.data?.backend && (
        <SharedPromptCard
          key={`backend-${prompts.data.backend.id}`}
          card="promptBackend"
          kind="backend"
          accountId={line.accountId}
          icon={<BookOpen size={17} />}
          title={t("prompt.backend.title", { language })}
          help={t("prompt.backend.help")}
          row={prompts.data.backend}
          onSave={savePrompt}
        />
      )}
      {/* Edits go to a draft; only its Save to live changes what calls hear. */}
      {onEleven && eleven && (
        <ElevenDraftCard
          key={`eleven-${eleven.id}`}
          accountId={line.accountId}
          lineId={line.number?.id}
          defaultLang={promptLangOf(line.locale)}
        />
      )}
      {/* The call review, its change cards and the coach, folded: cards change the draft only on Accept. */}
      {onEleven && <ImprovePromptCard accountId={line.accountId} lang={promptLangOf(line.locale)} />}
    </>
  );
}
