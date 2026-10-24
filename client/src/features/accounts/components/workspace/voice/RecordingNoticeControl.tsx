// The recorded "this call is recorded" line a caller hears before she answers:
// a switch, and a popover to hear the line, try the voices and make the
// account's own. The engine keeps the clips (recording_notice.py); the voice
// samples are fixed files, so only "Generate clip" costs anything.
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Pause, Play } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { ENGINE_BASE_URL } from "@/features/voiceDemo/engine";
import { Chip } from "../communication/wizardAtoms";
import { FieldLabel, helpStyle, inputStyle } from "./voiceAtoms";
import {
  applyRecordingNotice, draftRecordingNotice, resetRecordingNotice, voiceLineKey,
  type NoticeVoice, type RecordingNoticeDraft, type VoiceLine, type VoiceLinePatch,
} from "./voiceApi";

// Mirrors VOICES / SPEEDS / STANDARD_TEXT / NOTICE_VERSION in the engine's recording_notice.py.
type Maker = "openai" | "google" | "eleven";
const VOICES: { id: NoticeVoice; gender: "female" | "male"; maker: Maker }[] = [
  { id: "nova", gender: "female", maker: "openai" }, { id: "sage", gender: "female", maker: "openai" },
  { id: "ash", gender: "male", maker: "openai" }, { id: "onyx", gender: "male", maker: "openai" },
  { id: "kore", gender: "female", maker: "google" }, { id: "aoede", gender: "female", maker: "google" },
  { id: "puck", gender: "male", maker: "google" }, { id: "charon", gender: "male", maker: "google" },
  // Emma is the voice the ElevenLabs (Realtime Max) receptionist speaks with.
  { id: "emma", gender: "female", maker: "eleven" }, { id: "iris", gender: "female", maker: "eleven" },
  { id: "jasmijn", gender: "female", maker: "eleven" },
];
const MAKERS: Maker[] = ["openai", "google", "eleven"];
const SPEEDS = [1, 1.25, 1.5];
const NOTICE_LOCALES = ["nl", "en-GB", "en-US", "pt-BR", "pt-PT"];
const STANDARD_VERSION = 2;
/** The voice and speed each standard clip was made with: where the editor starts. */
const STANDARD_PICK: Record<string, { voice: NoticeVoice; speed: number }> = {
  nl: { voice: "ash", speed: 1.5 }, "en-GB": { voice: "nova", speed: 1.5 }, "en-US": { voice: "nova", speed: 1 },
  "pt-BR": { voice: "nova", speed: 1.5 }, "pt-PT": { voice: "nova", speed: 1 },
};
const TEXT_MIN = 8;
const TEXT_MAX = 200;

const noticeLocale = (locale: string | null) => (locale && NOTICE_LOCALES.includes(locale) ? locale : "en-GB");
const standardUrl = (locale: string) => `${ENGINE_BASE_URL}/voice/phone/notice/${locale}.mp3?v=${STANDARD_VERSION}`;
const sampleUrl = (locale: string, voice: string) => `${ENGINE_BASE_URL}/voice/phone/notice/sample/${locale}-${voice}.mp3?v=${STANDARD_VERSION}`;
const customUrl = (accountId: number, v: number) => `${ENGINE_BASE_URL}/voice/phone/notice/custom/${accountId}.mp3?v=${v}`;
const label = (v: string) => v[0].toUpperCase() + v.slice(1);

/** One audio element for the popover: whichever clip was pressed last. */
function useClipPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  const toggle = (url: string) => {
    if (!audioRef.current) {
      const a = new Audio();
      a.addEventListener("ended", () => setCurrent(null));
      a.addEventListener("pause", () => setCurrent(null));
      a.addEventListener("error", () => { setCurrent(null); setFailed(a.src); });
      audioRef.current = a;
    }
    const a = audioRef.current;
    if (current === url) { a.pause(); return; }
    a.src = url;
    setFailed(null);
    a.play().then(() => setCurrent(url)).catch(() => { /* the error event reports it */ });
  };

  return { current, failed, toggle };
}

function PlayButton({ url, player, name }: { url: string; player: ReturnType<typeof useClipPlayer>; name: string }) {
  const { t } = useTranslation("voiceTab");
  const playing = player.current === url;
  const title = `${t(playing ? "notice.pause" : "notice.play")}: ${name}`;
  return (
    <button
      type="button"
      className={`la-btn la-btn--icon la-btn--pill ${playing ? "la-btn--wine" : "la-btn--soft"}`}
      onClick={() => player.toggle(url)}
      aria-label={title}
      title={title}
      style={{ flexShrink: 0 }}
    >
      {playing ? <Pause size={13} /> : <Play size={13} />}
    </button>
  );
}

function NoticeEditor({ line }: { line: VoiceLine }) {
  const { t } = useTranslation("voiceTab");
  const qc = useQueryClient();
  const player = useClipPlayer();
  const locale = noticeLocale(line.locale);
  const custom = line.recordingNotice.custom;
  const standardText = t(`notice.standard.${locale}`);

  const [text, setText] = useState(custom?.text ?? standardText);
  const standardPick = STANDARD_PICK[locale];
  const [voice, setVoice] = useState<NoticeVoice>(custom?.voice ?? standardPick.voice);
  const [speed, setSpeed] = useState(custom?.speed ?? standardPick.speed);
  const [draft, setDraft] = useState<RecordingNoticeDraft | null>(null);
  const [busy, setBusy] = useState<"draft" | "apply" | "reset" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (kind: "draft" | "apply" | "reset") => {
    setBusy(kind);
    setError(null);
    try {
      if (kind === "draft") {
        setDraft(await draftRecordingNotice(line.accountId, { text: clean, voice, speed }));
      } else {
        const fresh = kind === "apply" ? await applyRecordingNotice(line.accountId) : await resetRecordingNotice(line.accountId);
        qc.setQueryData(voiceLineKey(line.accountId), fresh);
        setDraft(null);
        if (kind === "reset") { setText(standardText); setVoice(standardPick.voice); setSpeed(standardPick.speed); }
      }
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t("notice.failed"));
    } finally {
      setBusy(null);
    }
  };

  // The engine collapses spaces and line breaks; compare the same way.
  const clean = text.split(/\s+/).filter(Boolean).join(" ");
  const length = clean.length;
  // A draft of other words, another voice or another speed is not what "use this" would save.
  const draftIsCurrent = !!draft && draft.text === clean && draft.voice === voice && draft.speed === speed;
  const currentUrl = custom ? customUrl(line.accountId, custom.v) : standardUrl(locale);
  // What callers hear now, in the editor's terms: anything else is unsaved.
  const heard = custom ?? { text: standardText, ...standardPick };
  const changed = clean !== heard.text || voice !== heard.voice || speed !== heard.speed;

  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <div className="eyebrow eyebrow-sm" style={{ marginBottom: 6 }}>{t("notice.title")}</div>
        <p style={{ ...helpStyle, margin: 0 }}>{t("notice.help")}</p>
      </div>

      <div>
        <FieldLabel>{t("notice.current")}</FieldLabel>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <PlayButton url={currentUrl} player={player} name={t("notice.current")} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13.5, color: "var(--ink)", overflowWrap: "anywhere" }}>{custom?.text ?? standardText}</div>
            <div style={{ fontSize: 12, color: "var(--mute)" }}>{t(custom ? "notice.customTag" : "notice.standardTag")}</div>
          </div>
        </div>
      </div>

      <div>
        <FieldLabel>{t("notice.text")}</FieldLabel>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, TEXT_MAX))}
          rows={2}
          style={{ ...inputStyle, resize: "vertical", lineHeight: 1.45 }}
          data-testid="notice-text"
        />
        <p style={{ ...helpStyle, margin: "6px 0 0" }}>{t("notice.textHelp", { count: length, max: TEXT_MAX })}</p>
      </div>

      <div>
        <FieldLabel>{t("notice.voice")}</FieldLabel>
        {MAKERS.map((maker) => (
          <div key={maker} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: "var(--mute)", marginBottom: 6 }}>{t(`notice.makers.${maker}`)}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {VOICES.filter((v) => v.maker === maker).map(({ id, gender }) => (
                <div key={id} style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <PlayButton url={sampleUrl(locale, id)} player={player} name={label(id)} />
                  <Chip selected={voice === id} onClick={() => setVoice(id)} label={`${label(id)} · ${t(`notice.${gender}`)}`} />
                </div>
              ))}
            </div>
          </div>
        ))}
        <p style={{ ...helpStyle, margin: "8px 0 0" }}>{t("notice.voiceHelp")}</p>
      </div>

      <div>
        <FieldLabel>{t("notice.speed")}</FieldLabel>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {SPEEDS.map((s) => <Chip key={s} selected={speed === s} onClick={() => setSpeed(s)} label={`${s}×`} />)}
        </div>
      </div>

      {draft && draftIsCurrent && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: "var(--r-button)", background: "var(--wine-tint)" }}>
          <PlayButton url={draft.url} player={player} name={t("notice.draft", { seconds: draft.seconds })} />
          <span style={{ fontSize: 13, color: "var(--ink)", flex: 1, minWidth: 0 }}>{t("notice.draft", { seconds: draft.seconds })}</span>
          <button type="button" className="la-btn la-btn--wine" onClick={() => run("apply")} disabled={busy !== null} data-testid="notice-use">
            {busy === "apply" && <Loader2 size={13} className="animate-spin" />}{t("notice.use")}
          </button>
        </div>
      )}

      {changed && !draftIsCurrent && (
        <p style={{ ...helpStyle, margin: 0, color: "var(--wine)" }} data-testid="notice-unsaved">{t("notice.unsaved")}</p>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button
          type="button"
          className={`la-btn ${changed && !draftIsCurrent ? "la-btn--wine" : "la-btn--soft"}`}
          onClick={() => run("draft")}
          disabled={busy !== null || length < TEXT_MIN || draftIsCurrent}
          data-testid="notice-generate"
        >
          {busy === "draft" && <Loader2 size={13} className="animate-spin" />}
          {t(busy === "draft" ? "notice.generating" : "notice.generate")}
        </button>
        {custom && (
          <button type="button" className="la-btn la-btn--soft" onClick={() => run("reset")} disabled={busy !== null}>
            {busy === "reset" && <Loader2 size={13} className="animate-spin" />}{t("notice.reset")}
          </button>
        )}
      </div>
      {(error || player.failed) && (
        <p role="alert" style={{ ...helpStyle, margin: 0, color: "var(--stage-lost)" }}>{error ?? t("notice.loadFailed")}</p>
      )}
    </div>
  );
}

export function RecordingNoticeControl({ line, canEdit, saving, onSave, showEdit = true }: {
  line: VoiceLine; canEdit: boolean; saving: boolean; onSave: (patch: VoiceLinePatch) => Promise<boolean>; showEdit?: boolean;
}) {
  const { t } = useTranslation("voiceTab");
  const [error, setError] = useState<string | null>(null);
  const { enabled, custom } = line.recordingNotice;

  const flip = async (on: boolean) => {
    setError(null);
    if (!(await onSave({ recordingNotice: on }))) setError(t("common.saveFailed"));
  };

  return (
    <div style={{ marginTop: 18 }}>
      <FieldLabel>{t("notice.label")}</FieldLabel>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <Switch checked={enabled} onCheckedChange={flip} disabled={!canEdit || saving} aria-label={t("notice.label")} />
        <span style={{ fontSize: 13, color: "var(--ink-soft)", minWidth: 0, overflowWrap: "anywhere" }}>
          {enabled ? `“${custom?.text ?? t(`notice.standard.${noticeLocale(line.locale)}`)}”` : t("notice.off")}
        </span>
        {canEdit && showEdit && (
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className="la-btn la-btn--soft" data-testid="notice-open">{t("notice.edit")}</button>
            </PopoverTrigger>
            <PopoverContent
              side="right"
              align="start"
              collisionPadding={12}
              className="p-0"
              style={{ width: "min(92vw, 400px)", maxHeight: "min(var(--radix-popover-content-available-height), 720px)", overflowY: "auto" }}
            >
              <NoticeEditor line={line} />
            </PopoverContent>
          </Popover>
        )}
      </div>
      <p style={{ ...helpStyle, margin: "8px 0 0" }}>{t("notice.routeOnly")}</p>
      {error && <p role="alert" style={{ ...helpStyle, margin: "8px 0 0", color: "var(--stage-lost)" }}>{error}</p>}
    </div>
  );
}
