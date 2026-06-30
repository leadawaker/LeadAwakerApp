// Contact / identity block for LeadDetailPanel (name, phone, email, priority,
// language, source, niche, campaign). Extracted verbatim (Session C).
import { User, Phone, Mail, Activity, Layers } from "lucide-react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "@/lib/apiUtils";
import { SectionTitle, InlineEditField, InfoRow } from "./atoms";

interface LeadContactSectionProps {
  lead: Record<string, any>;
  fullName: string;
  source: string;
  demoNicheCtx: Record<string, any> | null;
  leadId: number | string | undefined;
  isAgencyPanel: boolean;
  campaigns: { id: number; name: string }[];
  handleInlineFieldSave: (fieldName: string, newValue: string) => Promise<void>;
  /** Linked conversation prompt name (agency only). */
  promptName?: string;
  /** Campaign's AI model (agency only). */
  aiModel?: string;
}

export function LeadContactSection({
  lead,
  fullName,
  source,
  demoNicheCtx,
  leadId,
  isAgencyPanel,
  campaigns,
  handleInlineFieldSave,
  promptName,
  aiModel,
}: LeadContactSectionProps) {
  const { t } = useTranslation("leads");
  return (
    <>
      {/* Contact Info — with inline editing */}
      <SectionTitle icon={<User className="h-3.5 w-3.5" />} title={t("detail.sections.contact")} />
      <div
        className="rounded-xl border border-border/40 bg-muted/20 px-3 py-1.5"
        data-testid="contact-info-section"
      >
        <InlineEditField
          label={t("detail.fields.name")}
          value={fullName}
          icon={<User className="h-3 w-3" />}
          onSave={async (v) => {
            if (!leadId) return;
            const parts = v.trim().split(/\s+/);
            const firstName = parts[0] || "";
            const lastName = parts.slice(1).join(" ") || "";
            await apiFetch(`/api/leads/${leadId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ first_name: firstName, last_name: lastName }),
            });
          }}
          testId="inline-edit-name"
        />
        <InlineEditField
          label={t("detail.fields.phone")}
          value={lead.phone || ""}
          icon={<Phone className="h-3 w-3" />}
          type="tel"
          onSave={(v) => handleInlineFieldSave("phone", v)}
          testId="inline-edit-phone"
        />
        <InlineEditField
          label={t("detail.fields.email")}
          value={lead.email || ""}
          icon={<Mail className="h-3 w-3" />}
          type="email"
          onSave={(v) => handleInlineFieldSave("email", v)}
          testId="inline-edit-email"
        />
        <InlineEditField
          label={t("detail.fields.priority")}
          value={lead.priority || ""}
          icon={<Activity className="h-3 w-3" />}
          onSave={(v) => handleInlineFieldSave("priority", v)}
          selectOptions={["", "High", "Medium", "Low"]}
          testId="inline-edit-priority"
        />
        <InfoRow
          label={t("detail.fields.language")}
          value={lead.language}
        />
        <InfoRow
          label={t("detail.fields.source")}
          value={source}
        />
        {isAgencyPanel && promptName && (
          <InfoRow label={t("detail.fields.prompt")} value={promptName} />
        )}
        {isAgencyPanel && aiModel && (
          <InfoRow label={t("detail.fields.aiModel")} value={aiModel} />
        )}
        {demoNicheCtx && (
          <div className="flex items-start justify-between gap-3 py-1.5 border-b border-border/30 last:border-0">
            <span className="text-[11px] text-muted-foreground shrink-0">Niche</span>
            <div className="text-right text-[11px] text-foreground/80">
              <div className="font-medium">{demoNicheCtx.niche_label || demoNicheCtx.raw || "—"}</div>
              {demoNicheCtx.raw && demoNicheCtx.raw !== demoNicheCtx.niche_label && (
                <div className="text-muted-foreground/60 mt-0.5 italic">{demoNicheCtx.raw}</div>
              )}
            </div>
          </div>
        )}
        {/* Campaign — editable dropdown (#31, agency view only) */}
        {isAgencyPanel && (
          <div
            className="flex items-center justify-between gap-3 py-1.5 border-b border-border/30 last:border-0 group"
            data-testid="inline-edit-campaign"
          >
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-muted-foreground/60"><Layers className="h-3 w-3" /></span>
              <span className="text-[11px] text-muted-foreground">{t("detail.fields.campaign")}</span>
            </div>
            <select
              value={String(lead.campaignsId ?? lead.campaigns_id ?? "")}
              onChange={async (e) => {
                const val = e.target.value;
                await handleInlineFieldSave("campaignsId", val ? val : (null as any));
              }}
              className="text-[12px] bg-transparent border border-dashed border-border/60 rounded px-1.5 py-0.5 max-w-[160px] focus:outline-none focus:ring-1 focus:ring-brand-indigo/50 text-foreground hover:bg-muted/40 transition-colors cursor-pointer"
              data-testid="inline-edit-campaign-select"
            >
              <option value="">{"2014"}</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>
    </>
  );
}
