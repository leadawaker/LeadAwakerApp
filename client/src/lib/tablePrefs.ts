// System fields that should always be hidden from tables
export const SYSTEM_FIELDS = new Set(["nc_order", "password_hash"]);

// Non-editable fields (timestamps, IDs, system fields)
export const NON_EDITABLE_PATTERNS = ["created_at", "updated_at", "created_by", "updated_by", "nc_order", "id"];

export interface TablePrefs {
  visibleColumns?: string[];
  colWidths?: Record<string, number>;
  sortConfig?: { key: string; direction: "asc" | "desc" | null };
}

export function loadTablePrefs(pageKey: string): TablePrefs {
  try {
    const saved = localStorage.getItem(`table_prefs_${pageKey}`);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

export function saveTablePrefs(pageKey: string, prefs: TablePrefs): void {
  localStorage.setItem(`table_prefs_${pageKey}`, JSON.stringify(prefs));
}

/**
 * Convert a DB column name to a human-readable header.
 * "first_name" -> "First Name"
 * "ai_model" -> "Ai Model"
 * "Accounts_id" -> "Accounts Id"
 * "n8n_workflow_id" -> "N8n Workflow Id"
 */
export function formatColumnHeader(dbName: string): string {
  return dbName
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Auto-discover columns from data rows, filtering out system fields.
 * Returns column names in the order they appear in the first row.
 */
export function discoverColumns(rows: any[]): string[] {
  if (!rows.length) return [];
  return Object.keys(rows[0]).filter((k) => !SYSTEM_FIELDS.has(k));
}

/**
 * Check if a field should be non-editable based on its name.
 */
export function isNonEditable(colName: string): boolean {
  const lower = colName.toLowerCase();
  return NON_EDITABLE_PATTERNS.some((p) => lower === p || lower.endsWith(`_${p}`));
}

/**
 * Generate default column widths based on column names.
 */
export function defaultColWidths(columns: string[]): Record<string, number> {
  const widths: Record<string, number> = {};
  for (const col of columns) {
    if (col === "id") widths[col] = 80;
    else if (col.endsWith("_at") || col.endsWith("_date")) widths[col] = 180;
    else if (col.includes("template") || col.includes("description") || col.includes("prompt")) widths[col] = 280;
    else widths[col] = 180;
  }
  return widths;
}
