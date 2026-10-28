import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { DemoDraft } from "../../createDraft";
import { buildFromNiche, saveScanReview, scanWebsite, type ScanResult } from "../../api/demoScanApi";
import { TOUCH_ROW } from "../../touchTargets";
import { FormField } from "../form/FormField";
import { LanguageSeg } from "../form/LanguageSeg";
import { ProviderToggle, useGenProvider } from "../ProviderToggle";
import { ScanProgress } from "./ScanProgress";
import { ScanReviewStep } from "./ScanReviewStep";

type Action = "scan" | "notes" | "niche" | "save";
interface Failure {
  /** The translated headline. */
  message: string;
  /** The server's own words, shown smaller underneath. */
  detail?: string;
  /** What Retry runs again; null when trying again cannot help. */
  retry: Action | null;
}

const NICHE_MIN = 3;
const detailOf = (e: unknown): string | undefined => (e instanceof Error && e.message ? e.message : undefined);

/**
 * "New from website": a URL to scan, or (behind a fold) a typed niche or pasted business notes.
 * A scan and a notes build both end in the review step, where the findings are corrected and
 * saved onto the Client; a typed niche is saved by the server and goes straight to the picker.
 * Results land in the draft (`update`), so they survive the panel being closed mid-request.
 */
export function WebsiteScanFields({ draft, update, updateIf, isCurrent, onBuilt }: {
  draft: DemoDraft;
  update: (patch: Partial<DemoDraft>) => void;
  /** `update` for a request's result: applied only while the draft is still the prospect the request started for. */
  updateIf: (group: string, patch: Partial<DemoDraft>) => boolean;
  isCurrent: (group: string) => boolean;
  /** A Client is ready to use: select it and switch to Existing client. */
  onBuilt: (client: string) => void;
}) {
  const { t } = useTranslation("demos");
  const gen = useGenProvider();
  const [busy, setBusy] = useState<{ action: Action; startedAt: number } | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const working = busy !== null;

  const generateOptions = () => ({
    language: draft.language,
    // The market only means something for English; the other languages resolve their own.
    ...(draft.language === "en" && draft.market ? { market: draft.market } : {}),
    provider: gen.provider,
    ...(gen.provider === "claude" ? { claudeModel: gen.claudeModel } : {}),
  });

  const finishScan = (group: string, language: DemoDraft["language"], r: ScanResult) => {
    if (!r.saved) {
      setFailure({ message: t("create.scanFailed"), retry: null });
      return;
    }
    updateIf(group, {
      review: { client: r.client, language, summary: r.business_description, products: r.products, city: r.city, stockUrl: r.stock_url },
    });
  };

  const run = async (action: Action) => {
    const language = draft.language;
    // A request outlives Clear and the panel being closed. Clear (and an add) give the draft a new
    // prospect group, so a result for the old group is dropped: no draft write, no error, no onBuilt.
    const group = draft.prospectGroup;
    setFailure(null);
    setBusy({ action, startedAt: Date.now() });
    try {
      if (action === "scan") {
        const r = await scanWebsite({ ...generateOptions(), url: draft.websiteUrl.trim() });
        if (isCurrent(group)) finishScan(group, language, r);
      } else if (action === "notes") {
        const r = await scanWebsite({ ...generateOptions(), text: draft.notes.trim() });
        if (isCurrent(group)) finishScan(group, language, r);
      } else if (action === "niche") {
        const r = await buildFromNiche({ ...generateOptions(), niche: draft.nicheText.trim() });
        if (!isCurrent(group)) return;
        // Nothing was stored: keep the draft and say so, rather than selecting a Client that is not there.
        if (r.saved) onBuilt(r.client);
        else setFailure({ message: t("create.scanFailed"), retry: null });
      } else if (action === "save" && draft.review) {
        const { client, language: lang, summary, products, city, stockUrl } = draft.review;
        await saveScanReview(client, lang, { summary, products, city, stockUrl });
        if (isCurrent(group)) onBuilt(client);
      }
    } catch (e) {
      if (!isCurrent(group)) return;
      setFailure({
        message: t(action === "save" ? "create.saveFailed" : "create.scanFailed"),
        detail: detailOf(e),
        retry: (e as { retryable?: boolean })?.retryable === false ? null : action,
      });
    } finally {
      setBusy(null);
    }
  };

  const failureNote = failure && (
    <div role="alert" className="space-y-1.5" style={{ fontSize: 12.5 }}>
      <p style={{ color: "hsl(var(--destructive))" }}>{failure.message}</p>
      {failure.detail && <p style={{ color: "var(--mute)" }}>{failure.detail}</p>}
      {failure.retry && (
        <button type="button" className={`la-btn la-btn--soft ${TOUCH_ROW}`} disabled={working} onClick={() => void run(failure.retry!)}>
          {t("common.retry")}
        </button>
      )}
    </div>
  );

  if (draft.review) {
    return (
      <div className="space-y-4">
        <ScanReviewStep
          review={draft.review}
          onChange={(review) => update({ review })}
          onSave={() => void run("save")}
          saving={busy?.action === "save"}
        />
        {failureNote}
      </div>
    );
  }

  const canScan = !working && draft.websiteUrl.trim() !== "";
  return (
    <div className="space-y-4">
      <FormField label={t("create.language")}>
        <LanguageSeg value={draft.language} onChange={(language) => update({ language })} disabled={working} ariaLabel={t("create.language")} />
      </FormField>

      <FormField label={t("create.website")} htmlFor="demo-website" hint={t("create.websiteHint")}>
        <div className="flex items-center gap-2">
          <Input
            id="demo-website"
            value={draft.websiteUrl}
            inputMode="url"
            maxLength={500}
            placeholder="https://"
            disabled={working}
            className={TOUCH_ROW}
            onChange={(e) => update({ websiteUrl: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (canScan) void run("scan");
              }
            }}
          />
          <button type="button" className={`la-btn la-btn--soft shrink-0 ${TOUCH_ROW} disabled:opacity-50`} disabled={!canScan} onClick={() => void run("scan")}>
            {busy?.action === "scan" && <Loader2 size={13} className="animate-spin" />}
            {busy?.action === "scan" ? t("create.scanning") : t("create.scan")}
          </button>
        </div>
      </FormField>

      {/* The toggle sizes its buttons inline, so the phone height is forced from out here. */}
      <div className="max-md:[&_button]:!h-11 max-md:[&_select]:!h-11">
        <ProviderToggle gen={gen} disabled={working} />
      </div>
      {busy?.action === "scan" && <ScanProgress startedAt={busy.startedAt} />}
      {failureNote}

      <div className="space-y-3">
        <button
          type="button"
          aria-expanded={draft.foldOpen}
          onClick={() => update({ foldOpen: !draft.foldOpen })}
          className={cn("flex items-center gap-1.5", TOUCH_ROW)}
          style={{ fontSize: 12.5, fontWeight: 600, color: "var(--mute)" }}
        >
          <ChevronDown size={14} className="transition-transform" style={{ transform: draft.foldOpen ? "none" : "rotate(-90deg)" }} />
          {t("create.describeFold")}
        </button>
        {draft.foldOpen && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Textarea
                rows={3}
                maxLength={300}
                value={draft.nicheText}
                placeholder={t("create.nichePlaceholder")}
                aria-label={t("create.describeFold")}
                disabled={working}
                onChange={(e) => update({ nicheText: e.target.value })}
              />
              <button
                type="button"
                className={`la-btn la-btn--soft ${TOUCH_ROW} disabled:opacity-50`}
                disabled={working || draft.nicheText.trim().length < NICHE_MIN}
                onClick={() => void run("niche")}
              >
                {busy?.action === "niche" && <Loader2 size={13} className="animate-spin" />}
                {busy?.action === "niche" ? t("create.stepBuilding") : t("create.buildNiche")}
              </button>
            </div>
            <FormField label={t("create.notes")} htmlFor="demo-notes">
              <Textarea
                id="demo-notes"
                rows={4}
                maxLength={20000}
                value={draft.notes}
                placeholder={t("create.notesPlaceholder")}
                disabled={working}
                onChange={(e) => update({ notes: e.target.value })}
              />
            </FormField>
            <button
              type="button"
              className={`la-btn la-btn--soft ${TOUCH_ROW} disabled:opacity-50`}
              disabled={working || draft.notes.trim() === ""}
              onClick={() => void run("notes")}
            >
              {busy?.action === "notes" && <Loader2 size={13} className="animate-spin" />}
              {busy?.action === "notes" ? t("create.stepBuilding") : t("create.buildNotes")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
