import { useState } from "react";
import { useTranslation } from "react-i18next";

export type GenProvider = "claude" | "openai";
export type ClaudeModel = "opus" | "sonnet";

const PROVIDER_KEY = "demos.gen.provider";
const MODEL_KEY = "demos.gen.claudeModel";

function readStored<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
  } catch {
    return fallback;
  }
}

function store(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private window: the choice just is not remembered */
  }
}

/** Which model builds the Client. Remembered per browser. */
export function useGenProvider() {
  const [provider, setProviderState] = useState<GenProvider>(() =>
    readStored(PROVIDER_KEY, ["claude", "openai"] as const, "claude"),
  );
  const [claudeModel, setModelState] = useState<ClaudeModel>(() =>
    readStored(MODEL_KEY, ["opus", "sonnet"] as const, "sonnet"),
  );
  return {
    provider,
    claudeModel,
    setProvider: (p: GenProvider) => { setProviderState(p); store(PROVIDER_KEY, p); },
    setClaudeModel: (m: ClaudeModel) => { setModelState(m); store(MODEL_KEY, m); },
  };
}

/** "via Claude Sonnet" / "via OpenAI", from the server's provider_used. */
export function providerLabel(used: string | undefined): string {
  if (used === "claude-opus") return "Claude Opus";
  if (used === "claude-sonnet") return "Claude Sonnet";
  if (used === "openai") return "OpenAI";
  return "";
}

const segBtn = (active: boolean): React.CSSProperties => ({
  height: 26,
  padding: "0 10px",
  borderRadius: "calc(var(--r-surface) - 2px)",
  border: "none",
  background: active ? "var(--ink)" : "transparent",
  color: active ? "var(--bg)" : "var(--mute)",
  fontSize: 11,
  fontWeight: 600,
  cursor: "pointer",
  transition: "background 150ms, color 150ms",
});

export function ProviderToggle({ gen, disabled }: { gen: ReturnType<typeof useGenProvider>; disabled?: boolean }) {
  const { t } = useTranslation("demos");
  return (
    <div className="flex items-center gap-2" style={{ opacity: disabled ? 0.5 : 1 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--mute)" }}>{t("new.provider")}</span>
      <div
        role="radiogroup"
        aria-label={t("new.provider")}
        style={{ display: "inline-flex", padding: 2, borderRadius: "var(--r-surface)", border: "1px solid var(--line)" }}
      >
        {(["claude", "openai"] as const).map((p) => (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={gen.provider === p}
            disabled={disabled}
            onClick={() => gen.setProvider(p)}
            style={segBtn(gen.provider === p)}
          >
            {p === "claude" ? "Claude" : "OpenAI"}
          </button>
        ))}
      </div>
      {gen.provider === "claude" && (
        <select
          aria-label={t("new.claudeModel")}
          value={gen.claudeModel}
          disabled={disabled}
          onChange={(e) => gen.setClaudeModel(e.target.value as ClaudeModel)}
          style={{
            height: 30,
            padding: "0 8px",
            borderRadius: "var(--r-surface)",
            border: "1px solid var(--line)",
            background: "var(--bg)",
            color: "var(--ink)",
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          <option value="opus">Opus</option>
          <option value="sonnet">Sonnet</option>
        </select>
      )}
      <span style={{ fontSize: 11, color: "var(--mute)" }}>{t("new.providerHint")}</span>
    </div>
  );
}
