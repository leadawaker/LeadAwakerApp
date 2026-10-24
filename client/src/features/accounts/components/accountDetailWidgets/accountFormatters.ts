// ── Helpers ───────────────────────────────────────────────────────────────────

export function formatTimeDisplay(val: string | null | undefined): string {
  if (!val) return "";
  const parts = val.split(":");
  if (parts.length < 2) return val;
  const hours = parseInt(parts[0], 10);
  const minutes = parts[1];
  if (isNaN(hours)) return val;
  const ampm = hours >= 12 ? "PM" : "AM";
  const h = hours % 12 === 0 ? 12 : hours % 12;
  return `${String(h).padStart(2, "0")}:${minutes} ${ampm}`;
}

export function parseServiceCategories(val: string | null | undefined): string[] {
  if (!val) return [];
  const trimmed = val.trim();
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map((s: unknown) => String(s).trim()).filter(Boolean);
    } catch { /* fall through */ }
  }
  return trimmed.split(",").map((s) => s.trim()).filter(Boolean);
}
