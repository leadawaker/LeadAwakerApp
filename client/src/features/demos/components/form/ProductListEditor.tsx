import { useTranslation } from "react-i18next";
import { Plus, X } from "lucide-react";
import { IconBtn } from "@/components/ui/icon-btn";
import { Input } from "@/components/ui/input";
import { MAX_PRODUCTS, type DemoProduct } from "@shared/demoProducts";
import { TOUCH, TOUCH_ROW } from "../../touchTargets";

// The server's zod caps for one item (a longer value would be refused on save).
const NAME_MAX = 200;
const DETAIL_MAX = 400;
const PRICE_MAX = 80;

/**
 * What a business sells, one line per item: name, detail, price, remove. Self-contained
 * (props only), because the Personas editor renders it too. Rows wrap onto two lines when
 * the space is narrow. Items with no name are dropped by the server on save.
 */
export function ProductListEditor({ value, onChange }: {
  value: DemoProduct[];
  onChange: (value: DemoProduct[]) => void;
}) {
  const { t } = useTranslation("demos");
  const edit = (index: number, patch: Partial<DemoProduct>) =>
    onChange(value.map((p, i) => (i === index ? { ...p, ...patch } : p)));

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <ul className="space-y-2">
          {value.map((p, i) => (
            <li key={i} className="flex flex-wrap items-center gap-1.5">
              <Input
                value={p.name}
                maxLength={NAME_MAX}
                aria-label={t("create.itemName")}
                placeholder={t("create.itemName")}
                onChange={(e) => edit(i, { name: e.target.value })}
                className={`min-w-0 flex-[2_1_8rem] ${TOUCH_ROW}`}
              />
              <Input
                value={p.detail}
                maxLength={DETAIL_MAX}
                aria-label={t("create.itemDetail")}
                placeholder={t("create.itemDetail")}
                onChange={(e) => edit(i, { detail: e.target.value })}
                className={`min-w-0 flex-[3_1_8rem] ${TOUCH_ROW}`}
              />
              <Input
                value={p.price}
                maxLength={PRICE_MAX}
                aria-label={t("create.itemPrice")}
                placeholder={t("create.itemPrice")}
                onChange={(e) => edit(i, { price: e.target.value })}
                className={`min-w-0 flex-[1_1_5rem] ${TOUCH_ROW}`}
              />
              <IconBtn
                aria-label={t("create.removeItem")}
                title={t("create.removeItem")}
                className={TOUCH}
                onClick={() => onChange(value.filter((_, j) => j !== i))}
              >
                <X className="h-4 w-4" />
              </IconBtn>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        className={`la-btn la-btn--soft ${TOUCH_ROW} disabled:opacity-50`}
        disabled={value.length >= MAX_PRODUCTS}
        onClick={() => onChange([...value, { name: "", detail: "", price: "" }])}
      >
        <Plus size={13} />
        {t("create.addItem")}
      </button>
    </div>
  );
}
