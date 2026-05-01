export function EditDate({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      type="date"
      value={value ? value.slice(0, 10) : ""}
      onChange={(e) => onChange(e.target.value)}
      className="w-full text-[14px] bg-white dark:bg-white rounded-lg px-2.5 py-1.5 outline-none"
    />
  );
}
