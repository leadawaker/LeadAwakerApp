// Demos → Settings → Voice: the landing page's website demo
// (specs/public-website-demo). The switch turns the whole feature off at once
// (the page shows "book a call" within a minute); the budget and the daily cap
// bound what strangers can spend. Today's estimated spend sits underneath so
// the numbers are read against something real.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  usePublicDemoSettings,
  useSavePublicDemoSettings,
  type PublicDemoSettings as Settings,
} from "../api/publicDemoApi";

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
  width: 110,
};

type NumberKey = "dailyBudgetEur" | "maxDemosPerDay" | "voiceMaxMinutesPerSession" | "voiceMaxSessionsPerDemo";
const FIELDS: { key: NumberKey; step: number; min: number; max: number }[] = [
  { key: "dailyBudgetEur", step: 1, min: 0, max: 1000 },
  { key: "maxDemosPerDay", step: 1, min: 0, max: 1000 },
  { key: "voiceMaxMinutesPerSession", step: 1, min: 1, max: 30 },
  { key: "voiceMaxSessionsPerDemo", step: 1, min: 1, max: 20 },
];

export function PublicDemoSettings() {
  const { t } = useTranslation("demos");
  const { data, isLoading, error } = usePublicDemoSettings();
  const save = useSavePublicDemoSettings();
  const [draft, setDraft] = useState<Partial<Settings>>({});
  const dirty = Object.keys(draft).length > 0;
  const current = { ...(data?.settings ?? {}), ...draft } as Settings;
  const failure = (error || save.error) as Error | null;

  const onSave = async () => {
    await save.mutateAsync(draft);
    setDraft({});
  };

  return (
    <div className="neu-raised" style={CARD}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>
            {t("settings.publicDemo.title")}
          </span>
          <span style={{ display: "block", fontSize: 12, color: "var(--mute)", marginTop: 2 }}>
            {t("settings.publicDemo.hint")}
          </span>
        </div>
        {isLoading || save.isPending ? (
          <Loader2 size={16} className="animate-spin" style={{ color: "var(--mute)", marginTop: 2 }} />
        ) : (
          <Switch
            checked={!!data?.settings.enabled}
            disabled={!data}
            onCheckedChange={(v) => save.mutate({ enabled: v })}
            aria-label={t("settings.publicDemo.title")}
          />
        )}
      </div>

      {data && (
        <span style={{ display: "block", fontSize: 12, color: "var(--ink-soft)", marginTop: 10 }}>
          {t("settings.publicDemo.today", {
            eur: data.today.eur.toFixed(2),
            budget: data.settings.dailyBudgetEur,
            built: data.today.built,
            cap: data.settings.maxDemosPerDay,
          })}
        </span>
      )}

      <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
        {FIELDS.map((f) => (
          <label key={f.key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ flex: 1, fontSize: 13, color: "var(--ink)" }}>{t(`settings.publicDemo.${f.key}`)}</span>
            <input
              type="number"
              step={f.step}
              min={f.min}
              max={f.max}
              style={INPUT}
              value={current[f.key] ?? ""}
              onChange={(e) => setDraft({ ...draft, [f.key]: Number(e.target.value) })}
            />
          </label>
        ))}
        <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ flex: 1, fontSize: 13, color: "var(--ink)" }}>{t("settings.publicDemo.callNumber")}</span>
          <input
            style={{ ...INPUT, width: 160 }}
            value={current.callNumber ?? ""}
            placeholder="+31…"
            onChange={(e) => setDraft({ ...draft, callNumber: e.target.value.trim() || null })}
          />
        </label>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 18 }}>
        <button
          type="button"
          className="la-btn la-btn--primary"
          disabled={!dirty || save.isPending}
          onClick={() => void onSave()}
        >
          {t("settings.voice.save")}
        </button>
        {dirty && (
          <button type="button" className="la-btn la-btn--soft" onClick={() => setDraft({})}>
            {t("settings.voice.cancel")}
          </button>
        )}
        {failure && <span style={{ fontSize: 12, color: "var(--danger, #B3261E)" }}>{failure.message}</span>}
      </div>
    </div>
  );
}
