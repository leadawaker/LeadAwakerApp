# Expenses Feature — AI Reference Guide

> Read this whenever the user mentions expenses, invoices for tax purposes, BTW, VAT, NL tax, spending tracking, or the Billing → Expenses tab.

---

## Purpose

The Expenses table is Gabriel's **personal business expense tracker** for Dutch BTW (VAT) tax purposes. It lives inside the Billing section (agency-only tab) and allows uploading PDF invoices, having AI extract all relevant fields automatically, and storing records in PostgreSQL for quarterly BTW return filing with the Dutch tax authority (Belastingdienst).

**Owner context:**
- Business: Lead Awaker, Gabriel Barbosa Fronza
- NL VAT number: `NL002488258B44`
- BTW registration start: 17 December 2025
- Pre-start expenses (before Dec 17 2025) can be claimed on the first Q1 2026 BTW return

---

## Data Model

### PostgreSQL Table

Schema: `p2mxx34fvbf3ll6` (NocoDB schema — same as all other tables in this project)
Table name: `Expenses`

| Column | Type | Notes |
|--------|------|-------|
| `id` | SERIAL PK | Auto-increment |
| `date` | DATE | Invoice date |
| `year` | INTEGER | Derived from date |
| `quarter` | VARCHAR(2) | Q1–Q4 |
| `supplier` | VARCHAR(200) | Vendor name |
| `country` | VARCHAR(2) | ISO 2-letter code (NL, US, LU…) |
| `invoice_number` | VARCHAR(100) | Supplier's invoice number |
| `description` | TEXT | Brief item/service description |
| `currency` | VARCHAR(3) | EUR, USD, etc. |
| `amount_excl_vat` | NUMERIC(12,2) | Net amount |
| `vat_rate_pct` | NUMERIC(5,2) | 0, 9, or 21 (NL rates) |
| `vat_amount` | NUMERIC(12,2) | Actual VAT charged |
| `total_amount` | NUMERIC(12,2) | Gross total |
| `nl_btw_deductible` | BOOLEAN | TRUE = VAT reclaimable as voorbelasting |
| `notes` | TEXT | Tax notes, pre-start flags, etc. |
| `pdf_path` | VARCHAR(500) | Full path to saved PDF on disk |
| `created_at` | TIMESTAMPTZ | Auto |
| `updated_at` | TIMESTAMPTZ | Auto |

### Drizzle ORM Type

Defined in `shared/schema.ts` as `expenses`. Exported types: `Expenses`, `InsertExpenses`.

Field names in code are **camelCase** (Drizzle convention):
`amountExclVat`, `vatRatePct`, `vatAmount`, `totalAmount`, `nlBtwDeductible`, `pdfPath`, `invoiceNumber`, `createdAt`, `updatedAt`

### Frontend Type

`ExpenseRow` in `client/src/features/billing/types.ts` — all numeric fields typed as `string | null` (Drizzle returns numerics as strings), `nlBtwDeductible` is a proper `boolean`.

---

## NL BTW / VAT Logic

**`nl_btw_deductible = true`** when:
- Dutch supplier (NL) charging 21% or 9% BTW — fully reclaimable
- EU supplier charging VAT with a valid EU VAT number — reclaimable
- Dutch digital services (Twilio NL, etc.)

**`nl_btw_deductible = false`** when:
- US/non-EU company not charging EU VAT (e.g. Anthropic, OpenAI, AWS us-east)
- Zero-rated international services
- Personal/non-business purchases

**"NL BTW Deductible" total** in the UI = `SUM(vat_amount) WHERE nl_btw_deductible = true`. This is the amount Gabriel can reclaim each quarter on his BTW return. **Do not** use the `nl_btw_deductible` boolean itself as a numeric value — that was a bug in the old CSV-based version.

---

## API Endpoints

All require `requireAuth` + admin/operator role (`userRole !== "admin" && userRole !== "operator"` → 403).

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/expenses` | List all. Optional `?year=2026&quarter=Q1` filters |
| `POST` | `/api/expenses/parse-pdf` | Upload PDF → AI extraction → return JSON fields |
| `POST` | `/api/expenses` | Create expense row. Include `pdf_data` (Base64) to also save PDF to disk |
| `PATCH` | `/api/expenses/:id` | Update any fields |
| `DELETE` | `/api/expenses/:id` | Delete row |

**Route order matters:** `parse-pdf` is registered before `/:id` routes so Express doesn't match "parse-pdf" as an id.

---

## PDF Parsing (AI Extraction)

**Endpoint:** `POST /api/expenses/parse-pdf`
**AI provider:** OpenAI Responses API (`https://api.openai.com/v1/responses`)
**Model:** `gpt-4o-mini` (cheap, fast, accurate for structured invoice data)
**Env var:** `OPEN_AI_API_KEY` — note the non-standard spelling with underscore (user's choice)

**Request format to OpenAI:**
```json
{
  "model": "gpt-4o-mini",
  "input": [{
    "role": "user",
    "content": [
      { "type": "input_file", "filename": "invoice.pdf", "file_data": "data:application/pdf;base64,..." },
      { "type": "input_text", "text": "<extraction prompt>" }
    ]
  }]
}
```

**Response extraction:** `result.output[0].content[0].text` → parse JSON with `text.match(/\{[\s\S]*\}/)`

**Graceful degradation:** If `OPEN_AI_API_KEY` is not set, returns `{ error: "NO_API_KEY" }`. The frontend dialog detects this and shows a yellow notice + switches to manual-entry mode — the form still works without AI.

**If you need to change the AI provider:** Only modify the `parse-pdf` endpoint in `server/routes.ts`. The frontend is provider-agnostic (it just receives a JSON object with the extracted fields). Use `ANTHROPIC_API_KEY` + Anthropic Messages API (`type: "document"`) as an alternative.

---

## PDF Storage on Disk

When `POST /api/expenses` receives a `pdf_data` field (Base64 data URL):
1. Derives `YEAR` and `QUARTER` from the `date` field
2. Creates directory: `/home/gabriel/Images/Expenses/{YEAR}/{QUARTER}/`
3. Saves file as: `{DATE}_{Supplier}_{InvoiceNumber}_{CURRENCY}{Amount}.pdf`
4. Stores the full path in `pdf_path` column

`pdf_data` is stripped from the payload before writing to the DB (not stored in PostgreSQL — only the path is stored).

---

## Frontend Architecture

```
client/src/features/billing/
├── api/
│   └── expensesApi.ts        ← fetchExpenses, createExpense, updateExpense, deleteExpense, parsePdf
├── components/
│   ├── ExpenseCreateDialog.tsx  ← PDF upload + AI extraction + save form
│   ├── ExpensesView.tsx         ← Table view (sortable columns, summary stats, footer totals)
│   └── ExpensesListView.tsx     ← Card/grouped view (grouped by quarter)
└── types.ts                  ← ExpenseRow type (add new fields here if schema changes)
```

**BillingListView.tsx** contains the tab switching logic. The "Add Expense" `+` button is shown when `isExpensesTab && isAgencyUser`. The `ExpenseCreateDialog` is rendered at the bottom of the JSX alongside other dialogs.

**TanStack Query key:** `["expenses"]` — invalidate this after any create/update/delete to refresh both views.

---

## ExpenseCreateDialog Flow

1. User opens dialog via `+` button on Expenses tab
2. Drops or selects a PDF → `FileReader.readAsDataURL()` → Base64 data URL
3. Calls `parsePdf(dataUrl)` → `POST /api/expenses/parse-pdf`
4. On success: all form fields auto-populate from extracted JSON
5. On `NO_API_KEY` error: yellow notice shown, user fills fields manually
6. User reviews / edits any field
7. Clicks "Save Expense" → `createExpense(payload)` → `POST /api/expenses`
8. Success → `queryClient.invalidateQueries({ queryKey: ["expenses"] })` → dialog closes

---

## Data Source History

The original data lived in a flat CSV at `/home/gabriel/Images/Expenses/expenses.csv`. This file still exists as a backup but is **no longer the source of truth** — PostgreSQL is. The 9 original CSV rows were migrated when the table was created. Do not read from the CSV anymore.

---

## Things NOT to Change Without Good Reason

- The `OPEN_AI_API_KEY` env var name (non-standard, user's choice — don't rename to `OPENAI_API_KEY`)
- The `nl_btw_deductible` boolean semantics — the deductible *amount* is always `vat_amount` when this is `true`
- The PDF save path pattern (`/home/gabriel/Images/Expenses/{YEAR}/{QUARTER}/`) — consistent with the Invoices PDF pattern
- Agency-only access guard — expenses are private business records, never expose to Manager/Viewer roles

---

## Extending This Feature

**To add a new field** (e.g. `payment_method`):
1. Add column to the SQL table: `ALTER TABLE "p2mxx34fvbf3ll6"."Expenses" ADD COLUMN payment_method VARCHAR(50);`
2. Add to `expenses` table in `shared/schema.ts`
3. Add to `ExpenseRow` type in `billing/types.ts`
4. Add to `createExpense` / `updateExpense` handlers in `server/routes.ts`
5. Add field to `ExpenseCreateDialog.tsx` form
6. Add column to `ExpensesView.tsx` COLUMNS array if it should be visible in table view

**To add edit/delete to rows:** The `updateExpense` and `deleteExpense` API functions already exist in `expensesApi.ts`. Wire up hover actions on `<tr>` rows in `ExpensesView.tsx` following the same pattern used in `InvoicesInlineTable.tsx`.

**To export for tax filing:** Add a `GET /api/expenses/export-csv` endpoint that queries the DB and streams a CSV response. The column order should match the original CSV format for compatibility with whatever accounting tool Gabriel uses.
