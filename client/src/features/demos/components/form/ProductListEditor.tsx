import { useTranslation } from "react-i18next";
import { Plus, X } from "lucide-react";
import { IconBtn } from "@/components/ui/icon-btn";
import { Input } from "@/components/ui/input";
import { MAX_PRODUCTS, PRODUCT_LIMITS, type DemoProduct } from "@shared/demoProducts";
import { TOUCH, TOUCH_ROW } from "../../touchTargets";

/**
 * What a business sells, one line per item: name, detail, price, remove. Self-contained
 * (props only), because the Personas editor renders it too. Rows wrap onto two lines when
 * the space is narrow. The inputs stop at the lengths the server keeps (PRODUCT_LIMITS), so
 * nothing typed is cut silently on save; items with no name are dropped by the server.
 */
export function ProductListEditor({ value, onChange, disabled }: {
  value: DemoProduct[];
  onChange: (value: DemoProduct[]) => void;
  /** Locks every input and button, e.g. while the list is being saved. */
  disabled?: boolean;
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
                maxLength={PRODUCT_LIMITS.name}
                disabled={disabled}
                aria-label={t("create.itemName")}
                placeholder={t("create.itemName")}
                onChange={(e) => edit(i, { name: e.target.value })}
                className={`min-w-0 flex-[2_1_8rem] ${TOUCH_ROW}`}
              />
              <Input
                value={p.detail}
                maxLength={PRODUCT_LIMITS.detail}
                disabled={disabled}
                aria-label={t("create.itemDetail")}
                placeholder={t("create.itemDetail")}
                onChange={(e) => edit(i, { detail: e.target.value })}
                className={`min-w-0 flex-[3_1_8rem] ${TOUCH_ROW}`}
              />
              <Input
                value={p.price}
                maxLength={PRODUCT_LIMITS.price}
                disabled={disabled}
                aria-label={t("create.itemPrice")}
                placeholder={t("create.itemPrice")}
                onChange={(e) => edit(i, { price: e.target.value })}
                className={`min-w-0 flex-[1_1_5rem] ${TOUCH_ROW}`}
              />
              <IconBtn
                aria-label={t("create.removeItem")}
                title={t("create.removeItem")}
                disabled={disabled}
                className={`${TOUCH} disabled:opacity-50`}
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
        disabled={disabled || value.length >= MAX_PRODUCTS}
        onClick={() => onChange([...value, { name: "", detail: "", price: "" }])}
      >
        <Plus size={13} />
        {t("create.addItem")}
      </button>
    </div>
  );
}
