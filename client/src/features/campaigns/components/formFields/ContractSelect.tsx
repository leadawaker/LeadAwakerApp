import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/apiUtils";

export function ContractSelect({
  value,
  onChange,
  accountsId,
}: {
  value: string;
  onChange: (v: string) => void;
  accountsId?: number | null;
}) {
  const [contracts, setContracts] = useState<{ id: number; title: string | null }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const url = accountsId ? `/api/contracts?accountId=${accountsId}` : "/api/contracts";
    apiFetch(url)
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : (data?.list ?? []);
        setContracts(list);
      })
      .catch(() => setContracts([]))
      .finally(() => setLoading(false));
  }, [accountsId]);

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={loading}
      className="w-full text-[12px] bg-white/60 dark:bg-white/[0.10] border border-brand-indigo/30 rounded-lg px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-brand-indigo/40"
    >
      <option value="">{"—"}</option>
      {contracts.map((c) => (
        <option key={c.id} value={String(c.id)}>
          {c.title || `Contract #${c.id}`}
        </option>
      ))}
    </select>
  );
}
