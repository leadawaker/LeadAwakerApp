// "Create caption" in the New / Edit post panel: 3 options in the account's caption style, from the
// linked script or from a line about the video. Picking one fills the caption field (still editable).
// Nothing is saved or published here. States: idle, loading, options, error.
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Check, Loader2, Sparkles } from "lucide-react";
import { SocialApiError } from "../api/socialApi";
import { suggestCaptions } from "../api/studioApi";
import { captionErrorKey } from "../lib/studio";

const labelStyle: React.CSSProperties = { fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--mute-2)", marginBottom: 5, display: "block" };

export function CaptionWriter({ accountId, scriptId, scriptTitle, onPick }: {
  accountId: number;
  /** A post made from a studio script: the script is the input, no topic box. */
  scriptId?: number;
  scriptTitle?: string;
  onPick: (caption: string) => void;
}) {
  const { t } = useTranslation("social");
  const [about, setAbout] = useState("");
  const [picked, setPicked] = useState<number | null>(null);
  const write = useMutation({
    mutationFn: () => suggestCaptions(accountId, scriptId ? { scriptId } : { about: about.trim() }),
    onMutate: () => setPicked(null),
  });
  const options = write.data?.options ?? [];
  const reason = write.error instanceof SocialApiError ? write.error.reason : write.error ? "failed" : null;
  const canWrite = !write.isPending && (!!scriptId || about.trim().length > 0);

  return (
    <div className="neu-inset" style={{ borderRadius: "var(--r-surface)", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }} data-testid="caption-writer">
      {scriptId ? (
        <p style={{ margin: 0, fontSize: 12, color: "var(--mute)" }}>{t("captions.fromScript", { title: scriptTitle ?? "" })}</p>
      ) : (
        <div>
          <label style={labelStyle} htmlFor="caption-about">{t("captions.aboutLabel")}</label>
          <textarea id="caption-about" className="neu-input" rows={2} value={about} maxLength={4000}
            onChange={(e) => setAbout(e.target.value)} placeholder={t("captions.aboutPlaceholder")}
            style={{ fontSize: 12.5, padding: "8px 11px", width: "100%", resize: "vertical" }} data-testid="caption-about" />
        </div>
      )}
      <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
        <button type="button" className="la-btn la-btn--soft" disabled={!canWrite} onClick={() => write.mutate()} data-testid="caption-create">
          {write.isPending ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          {t(options.length ? "captions.again" : "captions.create")}
        </button>
        {write.isPending && <span role="status" style={{ fontSize: 11.5, color: "var(--mute)" }}>{t("captions.loading")}</span>}
      </div>
      {reason && <p role="alert" style={{ margin: 0, fontSize: 12, color: "hsl(var(--destructive))" }} data-testid="caption-error">{t(captionErrorKey(reason))}</p>}
      {options.length > 0 && !write.isPending && (
        <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }} aria-label={t("captions.optionsLabel")}>
          {options.map((o, i) => (
            <li key={i} className="neu-raised" style={{ borderRadius: "var(--r-surface)", background: "var(--bone)", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }} data-testid={`caption-option-${i}`}>
              <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-soft)", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{o}</p>
              <div>
                <button type="button" className={picked === i ? "la-btn la-btn--wine" : "la-btn la-btn--plain"}
                  onClick={() => { setPicked(i); onPick(o); }} data-testid={`caption-use-${i}`}>
                  {picked === i && <Check size={12} />}
                  {t(picked === i ? "captions.used" : "captions.use")}
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
