// Demos → Settings. One sub-tab per service, from the same SERVICES list the
// New demo form and the sessions table read, so a new service gets its
// settings tab without anyone remembering to add it here.
//
// Only the widget has a setting today (the agent photo). The rest are listed
// empty on purpose: the place to put the next knob already exists.
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, RotateCcw, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { SERVICES } from "../services";
import {
  apiAsset,
  useDemoSettings,
  useEngineVoiceOptions,
  useSaveVoiceSettings,
  useSetWidgetAvatar,
  type VoiceDemoSettings,
} from "../api/demoSettingsApi";

// Shown at 42px in the widget; 192 covers 3x screens with room to spare and
// keeps the upload to a few tens of KB.
const AVATAR_PX = 192;

/** Center-crop to a square and re-encode as WebP, in the browser, so the server
 *  never stores a multi-MB phone photo for a 42px circle. */
function toAvatarDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      const canvas = document.createElement("canvas");
      canvas.width = AVATAR_PX;
      canvas.height = AVATAR_PX;
      const ctx = canvas.getContext("2d");
      if (!ctx) { URL.revokeObjectURL(url); reject(new Error("canvas")); return; }
      ctx.drawImage(
        img,
        (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side,
        0, 0, AVATAR_PX, AVATAR_PX,
      );
      URL.revokeObjectURL(url);
      // Safari before 17 cannot encode WebP and silently hands back PNG, which
      // the server also accepts.
      resolve(canvas.toDataURL("image/webp", 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("image")); };
    img.src = url;
  });
}

function WidgetSettings() {
  const { t } = useTranslation("demos");
  const { data, isLoading } = useDemoSettings();
  const setAvatar = useSetWidgetAvatar();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      await setAvatar.mutateAsync(await toAvatarDataUrl(file));
    } catch (err) {
      setError(err instanceof Error && err.message !== "image" ? err.message : t("settings.widget.avatarError"));
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const current = data?.widgetAvatarUrl || "";
  const isDefault = !!data && current === data.defaultWidgetAvatarUrl;

  return (
    <div className="neu-raised" style={{ borderRadius: "var(--r-card)", background: "var(--bone)", padding: "20px 22px", maxWidth: 560 }}>
      <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{t("settings.widget.avatarTitle")}</span>
      <span style={{ display: "block", fontSize: 12, color: "var(--mute)", marginTop: 2 }}>{t("settings.widget.avatarHint")}</span>

      <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 16 }}>
        <span style={{ width: 72, height: 72, borderRadius: "50%", overflow: "hidden", flexShrink: 0, background: "var(--card)", boxShadow: "var(--sh-raised-crisp)" }}>
          {isLoading ? null : (
            <img src={apiAsset(current)} alt={t("settings.widget.avatarTitle")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          )}
        </span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            style={{ display: "none" }}
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
          <button type="button" className="la-btn" onClick={() => fileRef.current?.click()} disabled={setAvatar.isPending}>
            {setAvatar.isPending ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
            {t("settings.widget.upload")}
          </button>
          {!isDefault && data && (
            <button
              type="button"
              className="la-btn"
              onClick={() => { setError(null); setAvatar.mutate(null); }}
              disabled={setAvatar.isPending}
              style={{ background: "transparent", boxShadow: "none", color: "var(--mute)" }}
            >
              <RotateCcw size={13} />
              {t("settings.widget.reset")}
            </button>
          )}
        </div>
      </div>
      {error && <span style={{ display: "block", marginTop: 10, fontSize: 12, color: "var(--danger, #B3261E)" }}>{error}</span>}
    </div>
  );
}

const CARD: React.CSSProperties = {
  borderRadius: "var(--r-card)",
  background: "var(--bone)",
  padding: "20px 22px",
  maxWidth: 560,
};
const INPUT: React.CSSProperties = {
  height: 34,
  borderRadius: "var(--r-field, 8px)",
  border: "1px solid var(--line)",
  background: "var(--card)",
  color: "var(--ink)",
  padding: "0 9px",
  fontSize: 13,
};

/**
 * The /voice-demo page's own settings: which voice answers per language, the
 * door password and how long a call may run.
 *
 * The languages and voices come from the engine rather than a list kept here,
 * so a voice added in Python shows up without a second edit. Saving is
 * explicit: these change what a prospect hears on the next call, which is not
 * something to do on every keystroke.
 */
function VoiceSettings() {
  const { t } = useTranslation("demos");
  const { data } = useDemoSettings();
  const { data: engine, isLoading, error } = useEngineVoiceOptions();
  const save = useSaveVoiceSettings();

  const saved = (data?.settings?.voice || {}) as VoiceDemoSettings;
  const [draft, setDraft] = useState<VoiceDemoSettings | null>(null);
  const current = draft ?? saved;
  const dirty = draft !== null;

  const patch = (next: Partial<VoiceDemoSettings>) => setDraft({ ...current, ...next });

  const onSave = async () => {
    if (!draft) return;
    await save.mutateAsync({
      defaultVoices: draft.defaultVoices ?? {},
      passwords: draft.passwords ?? [],
      maxCallMinutes: draft.maxCallMinutes,
    });
    setDraft(null);
  };

  if (error) {
    return <span style={{ fontSize: 13, color: "var(--danger, #B3261E)" }}>{t("settings.voice.engineDown")}</span>;
  }

  return (
    <div className="neu-raised" style={CARD}>
      <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>
        {t("settings.voice.voicesTitle")}
      </span>
      <span style={{ display: "block", fontSize: 12, color: "var(--mute)", marginTop: 2 }}>
        {t("settings.voice.voicesHint")}
      </span>

      <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
        {(engine?.locales ?? []).map((l) => (
          <label key={l.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ flex: 1, fontSize: 13, color: "var(--ink)" }}>{l.label}</span>
            <select
              style={{ ...INPUT, width: 190 }}
              value={current.defaultVoices?.[l.id] ?? ""}
              onChange={(e) =>
                patch({ defaultVoices: { ...(current.defaultVoices ?? {}), [l.id]: e.target.value } })
              }
            >
              {/* Empty means the engine's own default, which is named here so
                  nobody has to guess what "default" sounds like. */}
              <option value="">{t("settings.voice.engineDefault", { voice: l.voice })}</option>
              {(engine?.voices ?? []).map((v) => (
                <option key={v.id} value={v.id}>{v.id} — {v.label}</option>
              ))}
            </select>
          </label>
        ))}
        {isLoading && <span style={{ fontSize: 12, color: "var(--mute)" }}>{t("settings.voice.loading")}</span>}
      </div>

      <div style={{ height: 1, background: "var(--line)", margin: "18px 0" }} />

      <label style={{ display: "block" }}>
        <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
          {t("settings.voice.passwordTitle")}
        </span>
        <span style={{ display: "block", fontSize: 12, color: "var(--mute)", margin: "2px 0 8px" }}>
          {t("settings.voice.passwordHint")}
        </span>
        <input
          style={{ ...INPUT, width: "100%" }}
          value={(current.passwords ?? []).join(", ")}
          placeholder={t("settings.voice.passwordPlaceholder")}
          onChange={(e) =>
            patch({ passwords: e.target.value.split(",").map((p) => p.trim()).filter(Boolean) })
          }
        />
      </label>

      <label style={{ display: "block", marginTop: 16 }}>
        <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
          {t("settings.voice.limitTitle")}
        </span>
        <span style={{ display: "block", fontSize: 12, color: "var(--mute)", margin: "2px 0 8px" }}>
          {t("settings.voice.limitHint")}
        </span>
        <input
          type="number"
          min={1}
          max={30}
          style={{ ...INPUT, width: 90 }}
          value={current.maxCallMinutes ?? engine?.max_call_minutes ?? 5}
          onChange={(e) => patch({ maxCallMinutes: Number(e.target.value) || undefined })}
        />
      </label>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 18 }}>
        <button
          type="button"
          className="la-btn la-btn--primary"
          disabled={!dirty || save.isPending}
          onClick={() => void onSave()}
        >
          {save.isPending && <Loader2 size={13} className="animate-spin" />}
          {t("settings.voice.save")}
        </button>
        {dirty && (
          <button type="button" className="la-btn la-btn--soft" onClick={() => setDraft(null)}>
            {t("settings.voice.cancel")}
          </button>
        )}
        {save.isError && (
          <span style={{ fontSize: 12, color: "var(--danger, #B3261E)" }}>
            {(save.error as Error)?.message}
          </span>
        )}
      </div>
    </div>
  );
}

export function DemoSettingsTab() {
  const { t } = useTranslation("demos");
  const [service, setService] = useState(SERVICES[0]!.key);

  return (
    <div className="h-full min-h-0 overflow-y-auto" style={{ padding: "18px 24px 24px" }}>
      <div className="max-w-[1386px] mr-auto" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div className="la-seg shrink-0" role="tablist" style={{ alignSelf: "flex-start", flexWrap: "wrap" }}>
          {SERVICES.map((s) => (
            <button
              key={s.key}
              role="tab"
              aria-selected={service === s.key}
              className={cn("la-seg-btn", service === s.key && "on")}
              style={{ padding: "7px 11px", fontSize: 11, letterSpacing: "0.1em" }}
              onClick={() => setService(s.key)}
            >
              <span className="flex items-center"><s.icon size={13} /></span>
              {t(s.labelKey)}
            </button>
          ))}
        </div>

        {service === "widget" ? (
          <WidgetSettings />
        ) : service === "voice" ? (
          <VoiceSettings />
        ) : (
          <span style={{ fontSize: 13, color: "var(--mute-2)" }}>{t("settings.empty")}</span>
        )}
      </div>
    </div>
  );
}
