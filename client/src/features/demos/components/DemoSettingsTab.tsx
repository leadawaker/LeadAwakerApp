// Demos → Settings. One side tab (SectionRail) per service, from the same
// SERVICES list the New demo form and the sessions table read, so a new
// service gets its settings tab without anyone remembering to add it here.
//
// A service tile holds the full settings of the demo campaign it runs on
// (DemoCampaignSettings); the widget adds its agent photo and the voice demo
// has its own settings instead. A campaign two services share opens under the
// first of them. Demo campaigns no service runs on get one more tile.
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight, Layers, Loader2, RotateCcw, Upload } from "lucide-react";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useLastTab } from "@/hooks/useLastTab";
import { SectionHeader, SectionLayout, SectionRail, type SectionRailItem } from "@/features/accounts/components/workspace/SectionRail";
import { SERVICES } from "../services";
import { DemoCampaignSettings, OtherDemoCampaigns, useDemoCampaigns } from "./DemoCampaignSettings";
import { EngineTestSettings } from "./EngineTestSettings";
import { PublicDemoSettings } from "./PublicDemoSettings";
import { CommaListInput } from "./CommaListInput";
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
    try {
      await save.mutateAsync({
        defaultVoices: draft.defaultVoices ?? {},
        passwords: draft.passwords ?? [],
        // null clears a saved limit back to the engine's default.
        maxCallMinutes: draft.maxCallMinutes ?? null,
        forgetNumbers: draft.forgetNumbers ?? [],
      });
      setDraft(null);
    } catch {
      // The draft stays for another try; the reason shows under the button.
    }
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
              {(["female", "male"] as const).map((gender) => {
                const voices = (engine?.voices ?? []).filter((v) => (v.gender ?? "female") === gender);
                return voices.length ? (
                  <optgroup key={gender} label={t(`settings.voice.${gender}`)}>
                    {voices.map((v) => (
                      <option key={v.id} value={v.id}>{v.id} — {v.label}</option>
                    ))}
                  </optgroup>
                ) : null;
              })}
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
        <CommaListInput
          style={{ ...INPUT, width: "100%" }}
          value={current.passwords ?? []}
          placeholder={t("settings.voice.passwordPlaceholder")}
          onChange={(passwords) => patch({ passwords })}
        />
      </label>

      <label style={{ display: "block", marginTop: 16 }}>
        <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
          {t("settings.voice.forgetTitle")}
        </span>
        <span style={{ display: "block", fontSize: 12, color: "var(--mute)", margin: "2px 0 8px" }}>
          {t("settings.voice.forgetHint")}
        </span>
        <CommaListInput
          style={{ ...INPUT, width: "100%" }}
          value={current.forgetNumbers ?? []}
          placeholder={t("settings.voice.forgetPlaceholder")}
          onChange={(forgetNumbers) => patch({ forgetNumbers })}
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
          onChange={(e) => {
            const n = Math.round(Number(e.target.value));
            // Empty means the engine default; anything else is kept in 1..30.
            patch({ maxCallMinutes: e.target.value === "" || !n ? null : Math.min(30, Math.max(1, n)) });
          }}
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

/** The tile for demo campaigns no service runs on. */
const OTHER_CAMPAIGNS = "campaigns";

// Which tile edits which demo campaign: the first service (in pitch order) that
// runs on it. Voice only mints its persona on a campaign; its calls run on the
// voice settings, so it claims none.
const CAMPAIGN_OWNER = new Map<number, string>();
for (const s of SERVICES) {
  if (s.campaignId != null && !s.voice && !CAMPAIGN_OWNER.has(s.campaignId)) CAMPAIGN_OWNER.set(s.campaignId, s.key);
}
const serviceOf = (key: string) => SERVICES.find((s) => s.key === key);
const TILE_KEYS: readonly string[] = [...SERVICES.map((s) => s.key), OTHER_CAMPAIGNS];
/** The campaign this tile edits, or null. */
const ownCampaign = (key: string): number | null => {
  const id = serviceOf(key)?.campaignId;
  return id != null && CAMPAIGN_OWNER.get(id) === key ? id : null;
};
/** The tile that edits this service's campaign when another one claims it (Quote runs on DBR's). */
const sharedWith = (key: string): string | null => {
  const s = serviceOf(key);
  const owner = s && !s.voice && s.campaignId != null ? CAMPAIGN_OWNER.get(s.campaignId) : undefined;
  return owner && owner !== key ? owner : null;
};

export function DemoSettingsTab() {
  const { t } = useTranslation("demos");
  const stacked = useIsMobile(768);
  // Reopens on the tile used last.
  const [service, setService] = useLastTab<string>("demos.settings", TILE_KEYS, SERVICES[0]!.key);
  const [otherId, setOtherId] = useState<number>();
  const { data: demoCampaigns = [] } = useDemoCampaigns();
  const others = demoCampaigns.filter((c) => !SERVICES.some((s) => s.campaignId === c.id));
  const campaignName = (id: number) => demoCampaigns.find((c) => c.id === id)?.name || `#${id}`;
  const labelOf = (key: string) => (key === OTHER_CAMPAIGNS ? t("settings.campaigns.label") : t(serviceOf(key)?.labelKey ?? key));

  // One fact per tile: the campaign it edits, what else it sets, or that it has nothing yet.
  const detailOf = (key: string) => {
    if (key === OTHER_CAMPAIGNS) return others.map((c) => c.name || `#${c.id}`).join(", ") || t("settings.campaigns.none");
    if (key === "voice") return t("settings.rail.voice");
    const own = ownCampaign(key);
    if (own != null) return [key === "widget" ? t("settings.widget.avatarTitle") : null, campaignName(own)].filter(Boolean).join(" · ");
    const owner = sharedWith(key);
    if (owner) return t("settings.rail.shared", { service: labelOf(owner) });
    return key === "widget" ? t("settings.widget.avatarTitle") : t("settings.rail.none");
  };
  const helpOf = (key: string) =>
    key === OTHER_CAMPAIGNS ? t("settings.campaigns.help") : ownCampaign(key) != null ? t("settings.campaign.help") : detailOf(key);
  const items: SectionRailItem<string>[] = [
    ...SERVICES.map((s) => ({ key: s.key, icon: <s.icon size={16} />, label: t(s.labelKey), detail: detailOf(s.key) })),
    { key: OTHER_CAMPAIGNS, icon: <Layers size={16} />, label: labelOf(OTHER_CAMPAIGNS), detail: detailOf(OTHER_CAMPAIGNS) },
  ];
  const index = items.findIndex((i) => i.key === service);
  const own = ownCampaign(service);
  const owner = sharedWith(service);

  return (
    <div
      className="h-full min-h-0 overflow-y-auto"
      // The menu sticks 18px under the top of this scroller, level with its padding (SectionLayout adds 32px).
      style={{ padding: "18px 24px 24px", ["--ws-sticky-top" as string]: "-14px" }}
    >
      <div className="la-page-center">
        <SectionLayout
          stacked={stacked}
          testId="demo-settings"
          rail={(layout) => (
            <SectionRail items={items} active={service} onSelect={setService} layout={layout} testId="demo-settings-rail" ariaLabel={t("settings.rail.label")} />
          )}
        >
          <section style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>
            <SectionHeader index={index + 1} title={labelOf(service)} help={helpOf(service)} />
            {service === OTHER_CAMPAIGNS ? (
              <OtherDemoCampaigns campaigns={others} value={otherId} onChange={setOtherId} />
            ) : service === "voice" ? (
              <>
                <VoiceSettings />
                <EngineTestSettings />
                <PublicDemoSettings />
              </>
            ) : (
              <>
                {service === "widget" && <WidgetSettings />}
                {own != null && <DemoCampaignSettings key={own} campaignId={own} />}
                {owner && (
                  <div className="neu-raised" style={CARD} data-testid="demo-settings-shared">
                    <span style={{ display: "block", fontSize: 13, color: "var(--ink)", lineHeight: 1.5 }}>
                      {t("settings.campaign.sharedHelp", {
                        service: labelOf(service), owner: labelOf(owner), campaign: campaignName(ownCampaign(owner) ?? 0),
                      })}
                    </span>
                    <button type="button" className="la-btn la-btn--soft" style={{ marginTop: 14 }} onClick={() => setService(owner)}>
                      {t("settings.campaign.openShared", { service: labelOf(owner) })} <ArrowRight size={13} />
                    </button>
                  </div>
                )}
                {own == null && !owner && service !== "widget" && (
                  <span style={{ fontSize: 13, color: "var(--mute-2)" }}>{t("settings.empty")}</span>
                )}
              </>
            )}
          </section>
        </SectionLayout>
      </div>
    </div>
  );
}
