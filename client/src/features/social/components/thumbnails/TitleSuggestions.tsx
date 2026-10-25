// "Suggest titles" under the title field: the AI offers a handful of short cover titles written from the
// picked script or post (or the rough title typed so far). Pick one to fill the title and the list closes;
// "More ideas" asks again and skips the ones already shown.
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Lightbulb, Loader2 } from "lucide-react";
import { SocialApiError } from "../../api/socialApi";
import { suggestThumbnailTitles } from "../../api/thumbnailsApi";
import { thumbErrorKey, toTitleRequest, type ComposerForm } from "../../lib/thumbnails";

export function TitleSuggestions({ accountId, form, onPick }: { accountId: number; form: ComposerForm; onPick: (title: string) => void }) {
  const { t } = useTranslation("social");
  const [options, setOptions] = useState<string[]>([]);
  const [seen, setSeen] = useState<string[]>([]);
  const ask = useMutation({
    mutationFn: (avoid: string[]) => suggestThumbnailTitles(accountId, toTitleRequest(form, avoid)),
    onSuccess: ({ options: next }) => { setOptions(next); setSeen((old) => [...old, ...next]); },
  });
  const reason = ask.error instanceof SocialApiError ? ask.error.reason : ask.error ? "failed" : null;
  const open = options.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }} data-testid="thumb-title-suggestions">
      <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
        <button type="button" className="la-btn la-btn--soft" style={{ padding: "4px 10px", minHeight: 28, fontSize: 11.5 }} disabled={ask.isPending}
          onClick={() => ask.mutate(open ? seen : [])} data-testid="thumb-suggest-titles">
          {ask.isPending ? <Loader2 size={12} className="animate-spin" /> : <Lightbulb size={12} />}{t(open ? "thumbnails.titles.more" : "thumbnails.titles.suggest")}
        </button>
        {open && (
          <button type="button" className="la-btn la-btn--plain" style={{ padding: "4px 10px", minHeight: 28, fontSize: 11.5 }} onClick={() => { setOptions([]); setSeen([]); }}>
            {t("thumbnails.titles.hide")}
          </button>
        )}
      </div>
      {open && (
        <div>
          <p style={{ margin: "0 0 6px", fontSize: 11, color: "var(--mute)" }}>{t("thumbnails.titles.pick")}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {options.map((o) => (
              <button key={o} type="button" className="la-btn la-btn--soft" style={{ padding: "5px 11px", minHeight: 30, fontSize: 12.5, textAlign: "left", whiteSpace: "normal" }}
                onClick={() => { onPick(o); setOptions([]); setSeen([]); }} data-testid="thumb-title-option">
                {o}
              </button>
            ))}
          </div>
        </div>
      )}
      {reason && <p role="alert" style={{ margin: 0, fontSize: 12, color: "hsl(var(--destructive))" }} data-testid="thumb-titles-error">{t(thumbErrorKey(reason))}</p>}
    </div>
  );
}
