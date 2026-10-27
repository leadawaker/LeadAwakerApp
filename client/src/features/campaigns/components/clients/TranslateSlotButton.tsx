import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Languages, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  translateDemoClient,
  type ClientTranslation,
  type DemoLang,
  type EditableDemoClient,
} from "../../api/demoClientsApi";
import { translateSources } from "./clientDraft";

/**
 * "Translate" for a language the persona lacks. It asks the server to translate
 * the English or Dutch copy of the SAVED persona and hands the answer to the
 * editor, which fills the empty slots and lets autosave persist them; nothing
 * is written here. With both English and Dutch written, a small switch picks
 * the source (English first); with only one, that one is used. With neither
 * there is nothing to translate from and the button stays away.
 */
export function TranslateSlotButton({ client, to, onTranslated }: {
  client: EditableDemoClient;
  to: DemoLang;
  onTranslated: (translation: ClientTranslation) => void;
}) {
  const { t } = useTranslation("demos");
  const sources = translateSources(client, to);
  const [picked, setPicked] = useState<"en" | "nl">("en");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  if (sources.length === 0) return null;
  const from = sources.includes(picked) ? picked : sources[0];

  const run = async () => {
    setBusy(true);
    setFailed(false);
    try {
      onTranslated(await translateDemoClient(client.niche, { from, to }));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="dp-translate" data-testid="persona-translate">
      <div className="dp-translate-row">
        {sources.length > 1 && (
          <div className="la-seg" role="tablist" aria-label={t("personas.translateFrom")}>
            {sources.map((l) => (
              <button
                key={l}
                type="button"
                role="tab"
                aria-selected={from === l}
                disabled={busy}
                className={cn("la-seg-btn", from === l && "on")}
                onClick={() => setPicked(l)}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        )}
        <button type="button" className="la-btn la-btn--soft dp-touch" onClick={run} disabled={busy}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Languages className="h-3.5 w-3.5" />}
          {busy ? t("personas.translating") : t("personas.translate", { from: from.toUpperCase(), to: to.toUpperCase() })}
        </button>
      </div>
      <p className="dp-help" style={{ margin: 0 }}>{t("personas.translateHint", { to: to.toUpperCase() })}</p>
      {failed && <p className="dp-error" role="alert" style={{ margin: 0 }}>{t("personas.translateFailed")}</p>}
    </div>
  );
}
