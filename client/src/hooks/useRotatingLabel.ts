import { useEffect, useState } from "react";

/**
 * Cycles through a list of labels while `active` is true.
 * Holds on the last label once reached. Resets to index 0 when `active` flips false->true.
 */
export function useRotatingLabel(labels: string[], active: boolean, intervalMs = 10000): string {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!active) {
      setIndex(0);
      return;
    }
    if (labels.length <= 1) return;

    const id = setInterval(() => {
      setIndex(i => (i < labels.length - 1 ? i + 1 : i));
    }, intervalMs);

    return () => clearInterval(id);
  }, [active, labels.length, intervalMs]);

  return labels[Math.min(index, labels.length - 1)] || "";
}
