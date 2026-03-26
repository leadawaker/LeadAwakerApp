export function EditNumber({
  value,
  onChange,
  placeholder,
}: {
  value: string | number;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="number"
      value={String(value)}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full text-[12px] bg-white/60 dark:bg-white/[0.10] border border-brand-indigo/30 rounded-lg px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-brand-indigo/40 placeholder:text-foreground/30"
    />
  );
}
