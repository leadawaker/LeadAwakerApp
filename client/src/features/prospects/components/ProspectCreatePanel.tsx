import { useState, useCallback } from "react";
import { X, Building2, ChevronDown, ChevronUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { hapticSave } from "@/lib/haptics";
import type { NewProspectForm } from "./ProspectListView";

const STATUS_OPTIONS   = ["New", "Contacted", "In Progress", "Converted", "Archived"];
const PRIORITY_OPTIONS = ["High", "Medium", "Low"];
const SOURCE_OPTIONS   = ["Web Research", "Referral", "LinkedIn", "Cold Email", "Conference", "Other"];
export const PROSPECT_COUNTRIES = ["Brazil", "USA", "United Kingdom", "Netherlands", "Portugal", "Spain", "Germany", "Sweden", "Norway", "Denmark", "Estonia"];

interface ProspectCreatePanelProps {
  onCreate: (data: NewProspectForm) => Promise<any>;
  onClose: () => void;
}

const DEFAULT_FORM: NewProspectForm = {
  name: "",
  company: "",
  niche: "",
  country: "",
  city: "",
  website: "",
  phone: "",
  email: "",
  linkedin: "",
  contact_name: "",
  contact_role: "",
  contact_email: "",
  contact_phone: "",
  contact_linkedin: "",
  company_linkedin: "",
  contact2_name: "",
  contact2_role: "",
  contact2_email: "",
  contact2_phone: "",
  contact2_linkedin: "",
  source: "Web Research",
  status: "New",
  priority: "Medium",
  notes: "",
  next_action: "",
};

export function ProspectCreatePanel({ onCreate, onClose }: ProspectCreatePanelProps) {
  const { t } = useTranslation("prospects");
  const [form, setForm] = useState<NewProspectForm>({ ...DEFAULT_FORM });
  const [nameError, setNameError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showContact2, setShowContact2] = useState(false);

  const set = useCallback((field: keyof NewProspectForm, value: string) => {
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

  const inputCls = "w-full h-10 rounded-lg border border-border/50 bg-card px-3 text-[13px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-brand-indigo/30 focus:border-brand-indigo/50";
  const selectCls = "w-full h-10 rounded-lg border border-border/50 bg-card px-3 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-brand-indigo/30";
  const labelCls = "block text-[11px] font-medium text-foreground/60 mb-1";

  return (
    <div className="flex flex-col h-full overflow-hidden" data-testid="prospect-create-panel">
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
        id="prospect-create-form"
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
                <label className={labelCls}>
                  {t("fields.name")} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder={t("fields.namePlaceholder")}
                  className={inputCls}
                />
                {nameError && (
                  <p className="text-[11px] text-red-500 mt-1">{nameError}</p>
                )}
              </div>
              {/* Company + Niche row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>{t("fields.company")}</label>
                  <input
                    type="text"
                    value={form.company}
                    onChange={(e) => set("company", e.target.value)}
                    placeholder={t("fields.companyPlaceholder")}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>{t("fields.niche")}</label>
                  <input
                    type="text"
                    value={form.niche}
                    onChange={(e) => set("niche", e.target.value)}
                    placeholder={t("fields.nichePlaceholder")}
                    className={inputCls}
                  />
                </div>
              </div>
              {/* Website */}
              <div>
                <label className={labelCls}>{t("fields.website")}</label>
                <input
                  type="url"
                  value={form.website}
                  onChange={(e) => set("website", e.target.value)}
                  placeholder={t("fields.websitePlaceholder")}
                  className={inputCls}
                />
              </div>
            </div>
          </section>

          {/* Location */}
          <section>
            <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/40 mb-3">{t("sections.location")}</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>{t("fields.country")}</label>
                <select
                  value={form.country}
                  onChange={(e) => set("country", e.target.value)}
                  className={selectCls}
                >
                  <option value="">{t("fields.countryPlaceholder")}</option>
                  {PROSPECT_COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>{t("fields.city")}</label>
                <input
                  type="text"
                  value={form.city}
                  onChange={(e) => set("city", e.target.value)}
                  placeholder={t("fields.cityPlaceholder")}
                  className={inputCls}
                />
              </div>
            </div>
          </section>

          {/* Contact 1 */}
          <section>
            <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/40 mb-3">{t("sections.contact1")}</p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>{t("fields.contact1Name")}</label>
                  <input
                    type="text"
                    value={form.contact_name}
                    onChange={(e) => set("contact_name", e.target.value)}
                    placeholder={t("fields.contact1NamePlaceholder")}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>{t("fields.contact1Role")}</label>
                  <input
                    type="text"
                    value={form.contact_role}
                    onChange={(e) => set("contact_role", e.target.value)}
                    placeholder={t("fields.contact1RolePlaceholder")}
                    className={inputCls}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>{t("fields.contact1Email")}</label>
                  <input
                    type="email"
                    value={form.contact_email}
                    onChange={(e) => set("contact_email", e.target.value)}
                    placeholder={t("fields.emailPlaceholder")}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>{t("fields.contact1Phone")}</label>
                  <input
                    type="tel"
                    value={form.contact_phone}
                    onChange={(e) => set("contact_phone", e.target.value)}
                    placeholder={t("fields.phonePlaceholder")}
                    className={inputCls}
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>{t("fields.contact1Linkedin")}</label>
                <input
                  type="url"
                  value={form.contact_linkedin}
                  onChange={(e) => set("contact_linkedin", e.target.value)}
                  placeholder={t("fields.linkedinPlaceholder")}
                  className={inputCls}
                />
              </div>
            </div>
          </section>

          {/* Contact 2 (collapsible) */}
          <section>
            <button
              type="button"
              onClick={() => setShowContact2((v) => !v)}
              className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-foreground/40 mb-3 hover:text-foreground/60 transition-colors"
            >
              {showContact2 ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {showContact2 ? t("hideContact2") : t("addContact2")}
            </button>
            {showContact2 && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>{t("fields.contact2Name")}</label>
                    <input
                      type="text"
                      value={form.contact2_name}
                      onChange={(e) => set("contact2_name", e.target.value)}
                      placeholder={t("fields.contact2NamePlaceholder")}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>{t("fields.contact2Role")}</label>
                    <input
                      type="text"
                      value={form.contact2_role}
                      onChange={(e) => set("contact2_role", e.target.value)}
                      placeholder={t("fields.contact2RolePlaceholder")}
                      className={inputCls}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>{t("fields.contact2Email")}</label>
                    <input
                      type="email"
                      value={form.contact2_email}
                      onChange={(e) => set("contact2_email", e.target.value)}
                      placeholder={t("fields.emailPlaceholder")}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>{t("fields.contact2Phone")}</label>
                    <input
                      type="tel"
                      value={form.contact2_phone}
                      onChange={(e) => set("contact2_phone", e.target.value)}
                      placeholder={t("fields.phonePlaceholder")}
                      className={inputCls}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>{t("fields.contact2Linkedin")}</label>
                  <input
                    type="url"
                    value={form.contact2_linkedin}
                    onChange={(e) => set("contact2_linkedin", e.target.value)}
                    placeholder={t("fields.linkedinPlaceholder")}
                    className={inputCls}
                  />
                </div>
              </div>
            )}
          </section>

          {/* Pipeline */}
          <section>
            <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/40 mb-3">{t("sections.pipeline")}</p>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>{t("fields.source")}</label>
                  <select
                    value={form.source}
                    onChange={(e) => set("source", e.target.value)}
                    className={selectCls}
                  >
                    {SOURCE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>{t("fields.status")}</label>
                  <select
                    value={form.status}
                    onChange={(e) => set("status", e.target.value)}
                    className={selectCls}
                  >
                    {STATUS_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>{t("fields.priority")}</label>
                  <select
                    value={form.priority}
                    onChange={(e) => set("priority", e.target.value)}
                    className={selectCls}
                  >
                    {PRIORITY_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>{t("fields.nextAction")}</label>
                <input
                  type="text"
                  value={form.next_action}
                  onChange={(e) => set("next_action", e.target.value)}
                  placeholder={t("fields.nextActionPlaceholder")}
                  className={inputCls}
                />
              </div>
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
          form="prospect-create-form"
          disabled={saving}
          className="h-10 px-5 text-[13px] bg-brand-indigo text-white hover:bg-brand-indigo/90"
        >
          {saving ? t("create.creating") : t("create.createProspect")}
        </Button>
      </div>
    </div>
  );
}
