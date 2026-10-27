import { useTranslation } from "react-i18next";
import type { DemoProduct, ProductsByLang } from "@shared/demoProducts";
import type { DemoLang } from "../../api/demoClientsApi";
import { ProductListEditor } from "@/features/demos/components/form/ProductListEditor";

/**
 * What the business sells, for the language the Persona section is showing,
 * plus the stock page and city the demo prompts also read. Phone is stored on
 * the persona but not shown here (it reaches no prompt yet). Presentation only:
 * every change goes back through `onChange` into the editor's draft.
 */
export function ProductsSection({ lang, products, stockUrl, city, onChange }: {
  lang: DemoLang;
  products: ProductsByLang;
  stockUrl: string;
  city: string;
  onChange: (patch: { products?: ProductsByLang; stockUrl?: string; city?: string }) => void;
}) {
  const { t } = useTranslation("demos");
  const setList = (list: DemoProduct[]) => onChange({ products: { ...products, [lang]: list } });

  return (
    <div data-testid="persona-products">
      <span className="dp-label">{t("personas.products", { lang: lang.toUpperCase() })}</span>
      <ProductListEditor value={products[lang] ?? []} onChange={setList} />
      <p className="dp-help">{t("personas.productsHint")}</p>
      <div className="dp-pair" style={{ marginTop: 14 }}>
        <div>
          <label className="dp-label" htmlFor="dp-stock-url">{t("personas.stockUrl")}</label>
          <input
            id="dp-stock-url"
            className="la-input dp-input"
            type="url"
            inputMode="url"
            value={stockUrl}
            placeholder="https://"
            maxLength={500}
            onChange={(e) => onChange({ stockUrl: e.target.value })}
          />
        </div>
        <div>
          <label className="dp-label" htmlFor="dp-city">{t("personas.city")}</label>
          <input
            id="dp-city"
            className="la-input dp-input"
            value={city}
            maxLength={120}
            onChange={(e) => onChange({ city: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}
