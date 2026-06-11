import { useTranslation } from "react-i18next";
import { Eye, EyeOff } from "lucide-react";

// ── Reusable field component ─────────────────────────────────────────
export function Field({
  label,
  value,
  onChange,
  testId,
  placeholder,
  type = "text",
  icon: Icon,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  testId: string;
  placeholder?: string;
  type?: string;
  icon?: React.ElementType;
}) {
  return (
    <div data-testid={`${testId}-wrap`}>
      <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5" data-testid={`${testId}-label`}>
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 h-10 w-full rounded-xl border border-border/40 bg-white dark:bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-indigo/20 focus:border-brand-indigo/40"
        data-testid={testId}
        placeholder={placeholder}
      />
    </div>
  );
}

// ── Password field component ─────────────────────────────────────────
export function PasswordField({
  label,
  value,
  onChange,
  show,
  onToggleShow,
  testId,
  placeholder,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggleShow: () => void;
  testId: string;
  placeholder: string;
  autoComplete: string;
}) {
  const { t } = useTranslation("settings");
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="relative mt-1.5">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-full rounded-xl border border-border/40 bg-white dark:bg-card px-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-brand-indigo/20 focus:border-brand-indigo/40"
          data-testid={testId}
          placeholder={placeholder}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          onClick={onToggleShow}
          aria-label={show ? t("security.hidePassword") : t("security.showPassword")}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
