import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ScanReview } from "../../createDraft";
import { TOUCH_ROW } from "../../touchTargets";
import { FormField } from "../form/FormField";
import { ProductListEditor } from "../form/ProductListEditor";

/**
 * What the scan found, for Gabriel to correct before it is saved onto the Client:
 * the summary, the products, the city and the stock page. The Client already exists
 * (the scan saved it), so Save client only writes these edits.
 */
export function ScanReviewStep({ review, onChange, onSave, saving }: {
  review: ScanReview;
  onChange: (review: ScanReview) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const { t } = useTranslation("demos");
  const id = useId();
  const set = (patch: Partial<ScanReview>) => onChange({ ...review, ...patch });

  return (
    <section className="space-y-4" aria-label={t("create.reviewTitle")}>
      <div className="space-y-1">
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{review.client}</h3>
        <p style={{ fontSize: 12, color: "var(--mute)" }}>{t("create.reviewTitle")}</p>
      </div>

      <FormField label={t("create.summary")} htmlFor={`${id}-summary`}>
        <Textarea
          id={`${id}-summary`}
          rows={5}
          value={review.summary}
          onChange={(e) => set({ summary: e.target.value })}
          disabled={saving}
        />
      </FormField>

      <FormField label={t("create.products")}>
        <ProductListEditor value={review.products} onChange={(products) => set({ products })} />
      </FormField>

      <FormField label={t("create.city")} htmlFor={`${id}-city`}>
        <Input
          id={`${id}-city`}
          value={review.city}
          maxLength={120}
          onChange={(e) => set({ city: e.target.value })}
          disabled={saving}
          className={TOUCH_ROW}
        />
      </FormField>

      <FormField label={t("create.stockUrl")} htmlFor={`${id}-stock`}>
        <Input
          id={`${id}-stock`}
          value={review.stockUrl}
          maxLength={500}
          inputMode="url"
          placeholder="https://"
          onChange={(e) => set({ stockUrl: e.target.value })}
          disabled={saving}
          className={TOUCH_ROW}
        />
      </FormField>

      <button type="button" className={`la-btn la-btn--soft ${TOUCH_ROW} disabled:opacity-50`} onClick={onSave} disabled={saving}>
        {saving && <Loader2 size={13} className="animate-spin" />}
        {t("create.saveClient")}
      </button>
    </section>
  );
}
