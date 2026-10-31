import { createHmac, timingSafeEqual } from "crypto";

// SignWell e-signature. A contract goes out as its uploaded PDF, or else as its
// text rendered to a simple HTML page. SignWell appends the signature page and
// reports back through POST /api/webhooks/signwell.

const API = "https://www.signwell.com/api/v1";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Same heading rule as the read-only view in ContractDetailView.
function isHeading(line: string): boolean {
  const t = line.trim();
  return /^\d+[.)]/.test(t) || (t.length > 0 && t === t.toUpperCase() && /[A-Z]/.test(t));
}

export function contractHtml(title: string, text: string): string {
  const body = text.split("\n").map((line) => {
    if (/^[─-]{10,}$/.test(line.trim())) return "<hr>";
    if (!line.trim()) return `<div class="gap"></div>`;
    return isHeading(line) ? `<h2>${escapeHtml(line.trim())}</h2>` : `<p>${escapeHtml(line)}</p>`;
  }).join("\n");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
body{font-family:Arial,Helvetica,sans-serif;font-size:11pt;line-height:1.45;color:#222;margin:40px}
h2{font-size:11.5pt;margin:14px 0 4px}p{margin:0;white-space:pre-wrap}.gap{height:9px}hr{border:0;border-top:1px solid #ccc;margin:10px 0}
</style></head><body>${body}</body></html>`;
}

function apiKey(): string {
  const key = process.env.SIGNWELL_API_KEY;
  if (!key) throw new Error("SIGNWELL_API_KEY not configured");
  return key;
}

export async function createSignatureRequest(input: {
  contractId: number;
  title: string;
  fileName: string;
  fileBase64: string;
  signerEmail: string;
  signerName: string;
  testMode: boolean;
}): Promise<{ ok: boolean; status: number; data: any }> {
  const res = await fetch(`${API}/documents/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": apiKey() },
    body: JSON.stringify({
      test_mode: input.testMode,
      name: input.title,
      files: [{ name: input.fileName, file_base64: input.fileBase64 }],
      recipients: [{ id: "1", name: input.signerName, email: input.signerEmail }],
      with_signature_page: true,
      subject: `Please sign: ${input.title}`,
      message: "Lead Awaker has sent you this document to read and sign.",
      custom_requester_name: "Lead Awaker",
      reminders: true,
      metadata: { contract_id: String(input.contractId) },
    }),
  });
  return { ok: res.ok, status: res.status, data: await res.json() };
}

// The signed PDF with its audit page, as a data URL like uploaded contracts.
export async function fetchCompletedPdf(documentId: string): Promise<string> {
  const res = await fetch(`${API}/documents/${documentId}/completed_pdf?audit_page=true`, {
    headers: { "X-Api-Key": apiKey() },
  });
  if (!res.ok) throw new Error(`completed_pdf ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return `data:application/pdf;base64,${buf.toString("base64")}`;
}

// SignWell signs each event with the webhook's own id as the key.
export function eventIsAuthentic(event: { type?: unknown; time?: unknown; hash?: unknown }): boolean {
  const key = process.env.SIGNWELL_WEBHOOK_ID;
  if (!key || typeof event.hash !== "string") return false;
  const expected = createHmac("sha256", key).update(`${event.type}@${event.time}`).digest("hex");
  const a = Buffer.from(event.hash);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
