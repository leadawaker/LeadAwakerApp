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
import { apiAsset, useDemoSettings, useSetWidgetAvatar } from "../api/demoSettingsApi";

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
        ) : (
          <span style={{ fontSize: 13, color: "var(--mute-2)" }}>{t("settings.empty")}</span>
        )}
      </div>
    </div>
  );
}
