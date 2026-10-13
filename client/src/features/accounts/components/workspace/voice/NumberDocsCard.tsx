// The client's paperwork for a phone number in their own name. Creates a
// private link (/number-docs/<token>) to send to the client; they fill in the
// company details and upload the documents, which go straight to Telnyx.
// This card shows what has come in. Agency only.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Check, Copy, FileText, Link2, Loader2, Minus } from "lucide-react";
import { apiFetch } from "@/lib/apiUtils";
import { VoiceCardShell, FieldLabel, ReadOnlyValue, helpStyle } from "./voiceAtoms";
import { NumberOrderPlan } from "./NumberOrderPlan";

const KINDS = ["kvk", "id", "address"] as const;
const DETAILS = ["legalName", "kvkNumber", "representative", "contactPhone", "street", "postalCode", "city"] as const;

export interface NumberRequest {
  token: string;
  status: "open" | "submitted";
  details: Record<string, string>;
  documents: { kind: (typeof KINDS)[number]; filename: string; telnyxDocumentId: string }[];
  submittedAt: string | null;
  areaCode: string | null;
  preferredNumber: string | null;
  autoOrder: boolean;
  numberOrder: {
    status: "placing" | "pending" | "success" | "failure";
    phoneNumber: string | null; orderId: string | null; error: string | null; checkedAt: string;
  } | null;
}

export function NumberDocsCard({ accountId, language, onAttach }: {
  accountId: number; language?: string | null; onAttach?: (phoneNumber: string) => Promise<boolean>;
}) {
  const { t } = useTranslation("voiceTab");
  const qc = useQueryClient();
  const key = ["number-request", accountId] as const;
  const url = `/api/accounts/${accountId}/number-request`;
  const [copied, setCopied] = useState(false);

  const { data: request, isLoading } = useQuery({
    queryKey: key,
    queryFn: async () => ((await (await apiFetch(url)).json()) as { request: NumberRequest | null }).request,
    refetchOnWindowFocus: true,
  });
  const create = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(url, { method: "POST" });
      if (!res.ok) throw new Error(String(res.status));
      return ((await res.json()) as { request: NumberRequest }).request;
    },
    onSuccess: (r) => qc.setQueryData(key, r),
  });

  const lang = (language || "").slice(0, 2).toLowerCase();
  const link = request
    ? `${window.location.origin}/number-docs/${request.token}${["nl", "en", "pt"].includes(lang) ? `?lang=${lang}` : ""}`
    : "";
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* shown as text anyway */ }
  };

  return (
    <VoiceCardShell card="docs" icon={<FileText size={17} />} title={t("numberDocs.card.title")}>
      <p style={helpStyle}>{t("numberDocs.card.help")}</p>
      {isLoading ? (
        <Loader2 size={14} className="animate-spin" style={{ color: "var(--mute)" }} />
      ) : !request ? (
        <button type="button" className="la-btn la-btn--wine" onClick={() => create.mutate()} disabled={create.isPending}>
          {create.isPending ? <Loader2 size={13} className="animate-spin" /> : <Link2 size={13} />}
          {t("numberDocs.card.create")}
        </button>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <FieldLabel>{t("numberDocs.card.link")}</FieldLabel>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <code style={{ flex: "1 1 240px", minWidth: 0, fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--ink-soft)", overflowWrap: "anywhere" }}>{link}</code>
              <button type="button" className="la-btn la-btn--soft" onClick={() => void copy()}>
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? t("numberDocs.card.copied") : t("numberDocs.card.copy")}
              </button>
            </div>
            <p style={{ ...helpStyle, margin: "8px 0 0" }}>
              {request.status === "submitted" ? t("numberDocs.card.submitted") : t("numberDocs.card.waiting")}
            </p>
          </div>

          <NumberOrderPlan accountId={accountId} request={request} onChange={(r) => qc.setQueryData(key, r)} onAttach={onAttach} />

          <div>
            <FieldLabel>{t("numberDocs.card.documents")}</FieldLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {KINDS.map((kind) => {
                const doc = request.documents.find((d) => d.kind === kind);
                return (
                  <div key={kind} style={{ display: "flex", alignItems: "baseline", gap: 8, fontSize: 13, color: doc ? "var(--ink-soft)" : "var(--mute)" }}>
                    {doc ? <Check size={13} /> : <Minus size={13} />}
                    <span>{t(`numberDocs.page.docs.${kind}.title`)}</span>
                    {doc && <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--mute)", overflowWrap: "anywhere" }}>{doc.telnyxDocumentId}</span>}
                  </div>
                );
              })}
            </div>
          </div>

          {Object.keys(request.details).length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "12px 18px" }}>
              {DETAILS.map((k) => (
                <div key={k}>
                  <FieldLabel>{t(`numberDocs.page.fields.${k}`)}</FieldLabel>
                  <ReadOnlyValue value={request.details[k]} />
                </div>
              ))}
            </div>
          )}

          {request.status === "submitted" && (
            <div>
              <button type="button" className="la-btn la-btn--soft" onClick={() => create.mutate()} disabled={create.isPending}>
                <Link2 size={13} /> {t("numberDocs.card.createNew")}
              </button>
            </div>
          )}
        </div>
      )}
    </VoiceCardShell>
  );
}
