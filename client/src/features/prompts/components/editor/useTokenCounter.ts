// The real GPT tokenizer (o200k_base, the gpt-4o/gpt-5 encoding family), loaded
// only once the preview opens since its rank table is about 2MB.
import { useEffect, useState } from "react";

export function useTokenCounter(enabled: boolean): ((s: string) => number) | null {
  const [count, setCount] = useState<((s: string) => number) | null>(null);
  useEffect(() => {
    if (!enabled || count) return;
    let cancelled = false;
    import("gpt-tokenizer/model/gpt-5").then((mod) => {
      if (!cancelled) setCount(() => mod.countTokens);
    });
    return () => { cancelled = true; };
  }, [enabled, count]);
  return count;
}
