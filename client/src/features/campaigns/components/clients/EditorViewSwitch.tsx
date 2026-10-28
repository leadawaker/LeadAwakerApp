import { cn } from "@/lib/utils";

/**
 * The section switch under a persona panel's title (Persona / Wording / Media, and the
 * Demos page's leading "Demos"). A tablist of equal-width buttons; the caller owns which
 * view is selected and what each one shows.
 */
export function EditorViewSwitch<T extends string>({ views, value, onChange, label }: {
  views: { id: T; label: string }[];
  value: T;
  onChange: (view: T) => void;
  /** aria-label of the tablist. */
  label: string;
}) {
  return (
    <div className="la-seg la-seg--fill" role="tablist" aria-label={label} style={{ maxWidth: views.length > 3 ? 520 : 420 }}>
      {views.map((v) => (
        <button
          key={v.id}
          type="button"
          role="tab"
          aria-selected={value === v.id}
          className={cn("la-seg-btn", value === v.id && "on")}
          onClick={() => onChange(v.id)}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}
