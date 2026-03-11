import { useState, useCallback } from "react";
import { X, Building2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { hapticSave } from "@/lib/haptics";
import type { NewAccountForm } from "./AccountCreateDialog";

const TIMEZONE_OPTIONS = [
  "America/Sao_Paulo",
  "Europe/Amsterdam",
];

const STATUS_OPTIONS = ["Active", "Trial", "Inactive", "Suspended"];
const TYPE_OPTIONS = ["Agency", "Client"];

const STATUS_I18N_KEY: Record<string, string> = {
  Active: "status.active",
  Trial: "status.trial",
  Inactive: "status.inactive",
  Suspended: "status.suspended",
};

const TYPE_I18N_KEY: Record<string, string> = {
  Agency: "type.agency",
  Client: "type.client",
};

interface AccountCreatePanelProps {
  onCreate: (data: NewAccountForm) => Promise<void>;
  onClose: () => void;
}

const DEFAULT_FORM: NewAccountForm = {
  name: "",
  status: "Active",
  type: "Client",
  owner_email: "",
  phone: "",
  website: "",
  timezone: "Europe/Amsterdam",
  business_niche: "",
  notes: "",
};

export function AccountCreatePanel({ onCreate, onClose }: AccountCreatePanelProps) {
  const { t } = useTranslation("accounts");
  const [form, setForm] = useState<NewAccountForm>({ ...DEFAULT_FORM });
  const [nameError, setNameError] = useState("");
  const [saving, setSaving] = useState(false);

  const set = useCallback((field: keyof NewAccountForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === "name") setNameError("");
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setNameError(t("create.nameRequiredDot")); return; }
    hapticSave();
    setSaving(true);
    try {
      await onCreate(form);
    } finally {
      setSaving(false);
    }
  }, [form, onCreate, t]);

  return (
    <div className="flex flex-col h-full overflow-hidden" data-testid="account-create-panel">
      {/* Sticky header */}
      <div className="shrink-0 flex items-start justify-between px-5 pt-6 pb-4 border-b border-border/30">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-full bg-brand-indigo/10 flex items-center justify-center">
            <Building2 className="h-4 w-4 text-brand-indigo" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground font-heading leading-tight">{t("create.panelTitle")}</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">{t("create.panelSubtitle")}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="icon-circle-lg icon-circle-base shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Scrollable form */}
      <form
        id="account-create-form"
        onSubmit={handleSubmit}
        className="flex-1 overflow-y-auto"
      >
        <div className="px-5 py-5 space-y-5">

          {/* Basic Information */}
          <section>
            <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/40 mb-3">{t("sections.basicInfo")}</p>
            <div className="space-y-3">
              {/* Name */}
              <div>
                <label className="block text-[11px] font-medium text-foreground/60 mb-1">
                  {t("fields.accountName")} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder={t("fields.accountNamePlaceholder")}
                  className="w-full h-10 rounded-lg border border-border/50 bg-card px-3 text-[13px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-brand-indigo/30 focus:border-brand-indigo/50"
                />
                {nameError && (
                  <p className="text-[11px] text-red-500 mt-1">{nameError}</p>
                )}
              </div>
              {/* Status + Type row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-foreground/60 mb-1">{t("fields.status")}</label>
                  <select
                    value={form.status}
                    onChange={(e) => set("status", e.target.value)}
                    className="w-full h-10 rounded-lg border border-border/50 bg-card px-3 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-brand-indigo/30"
                  >
                    {STATUS_OPTIONS.map((o) => <option key={o} value={o}>{t(STATUS_I18N_KEY[o])}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-foreground/60 mb-1">{t("fields.type")}</label>
                  <select
                    value={form.type}
                    onChange={(e) => set("type", e.target.value)}
                    className="w-full h-10 rounded-lg border border-border/50 bg-card px-3 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-brand-indigo/30"
                  >
                    {TYPE_OPTIONS.map((o) => <option key={o} value={o}>{t(TYPE_I18N_KEY[o])}</option>)}
                  </select>
                </div>
              </div>
              {/* Business Niche */}
              <div>
                <label className="block text-[11px] font-medium text-foreground/60 mb-1">{t("fields.businessNiche")}</label>
                <input
                  type="text"
                  value={form.business_niche}
                  onChange={(e) => set("business_niche", e.target.value)}
                  placeholder={t("fields.businessNichePlaceholder")}
                  className="w-full h-10 rounded-lg border border-border/50 bg-card px-3 text-[13px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-brand-indigo/30"
                />
              </div>
            </div>
          </section>

          {/* Contact */}
          <section>
            <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/40 mb-3">{t("sections.contact")}</p>
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-foreground/60 mb-1">{t("fields.ownerEmail")}</label>
                <input
                  type="email"
                  value={form.owner_email}
                  onChange={(e) => set("owner_email", e.target.value)}
                  placeholder={t("fields.ownerEmailPlaceholder")}
                  className="w-full h-10 rounded-lg border border-border/50 bg-card px-3 text-[13px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-brand-indigo/30"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-foreground/60 mb-1">{t("fields.phone")}</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => set("phone", e.target.value)}
                    placeholder={t("fields.phonePlaceholder")}
                    className="w-full h-10 rounded-lg border border-border/50 bg-card px-3 text-[13px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-brand-indigo/30"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-foreground/60 mb-1">{t("fields.website")}</label>
                  <input
                    type="url"
                    value={form.website}
                    onChange={(e) => set("website", e.target.value)}
                    placeholder={t("fields.websitePlaceholder")}
                    className="w-full h-10 rounded-lg border border-border/50 bg-card px-3 text-[13px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-brand-indigo/30"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Schedule */}
          <section>
            <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/40 mb-3">{t("sections.scheduleTimezone")}</p>
            <div>
              <label className="block text-[11px] font-medium text-foreground/60 mb-1">{t("fields.timezone")}</label>
              <select
                value={form.timezone}
                onChange={(e) => set("timezone", e.target.value)}
                className="w-full h-10 rounded-lg border border-border/50 bg-card px-3 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-brand-indigo/30"
              >
                {TIMEZONE_OPTIONS.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </div>
          </section>

          {/* Notes */}
          <section>
            <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/40 mb-3">{t("sections.notes")}</p>
            <textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder={t("fields.notesPlaceholder")}
              rows={4}
              className="w-full rounded-lg border border-border/50 bg-card px-3 py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-brand-indigo/30 resize-none leading-relaxed"
            />
          </section>

        </div>
      </form>

      {/* Sticky footer */}
      <div className="shrink-0 px-5 py-3 border-t border-border/30 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="h-10 px-4 rounded-lg text-[13px] text-foreground/60 hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50"
        >
          {t("create.cancel")}
        </button>
        <Button
          type="submit"
          form="account-create-form"
          disabled={saving}
          className="h-10 px-5 text-[13px] bg-brand-indigo text-white hover:bg-brand-indigo/90"
        >
          {saving ? t("create.creating") : t("create.createAccount")}
        </Button>
      </div>
    </div>
  );
}
