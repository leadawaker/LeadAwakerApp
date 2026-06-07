// MobileAddLeadForm — extracted from MobileViews.tsx

import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/apiUtils";
import { useToast } from "@/hooks/use-toast";
import { createLead } from "../../api/leadsApi";
import { resolveColor } from "@/features/tags/types";

export function MobileAddLeadForm({
  open,
  onClose,
  onCreated,
  campaignsById,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (lead: Record<string, any>) => void;
  campaignsById?: Map<number, { name: string; accountId: number | null; bookingMode?: string | null }>;
}) {
  const { t } = useTranslation("leads");
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [firstName, setFirstName] = useState("");
  const [lastName,  setLastName]  = useState("");
  const [phone,     setPhone]     = useState("");
  const [email,     setEmail]     = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [availableTags, setAvailableTags] = useState<{ id: number; name: string; color: string }[]>([]);
  const [errors, setErrors] = useState<{ firstName?: string; phone?: string }>({});

  useEffect(() => { setMounted(true); }, []);

  // Fetch tags when form opens
  useEffect(() => {
    if (!open) return;
    apiFetch("/api/tags")
      .then((r) => r.ok ? r.json() : [])
      .then((data: any[]) => {
        setAvailableTags(
          (Array.isArray(data) ? data : []).map((t: any) => ({
            id: t.id ?? t.Id ?? 0,
            name: t.name || t.Name || "",
            color: t.color || t.Color || "gray",
          })).filter((t) => t.id && t.name)
        );
      })
      .catch(() => setAvailableTags([]));
  }, [open]);

  // Reset form when opened
  useEffect(() => {
    if (open) {
      setFirstName(""); setLastName(""); setPhone("");
      setEmail(""); setCampaignId(""); setSelectedTagIds([]);
      setErrors({});
    }
  }, [open]);

  const campaigns = useMemo(() => {
    if (!campaignsById) return [];
    return Array.from(campaignsById.entries()).map(([id, info]) => ({ id, name: info.name }));
  }, [campaignsById]);

  const toggleTag = (tagId: number) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const validate = () => {
    const errs: { firstName?: string; phone?: string } = {};
    if (!firstName.trim()) errs.firstName = t("addLead.firstNameRequired", "First name is required");
    if (!phone.trim() && !email.trim()) errs.phone = t("addLead.phoneOrEmailRequired", "Phone or email is required");
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        Conversion_Status: "New",
      };
      if (campaignId) payload.Campaigns_id = Number(campaignId);
      const newLead = await createLead(payload);
      const leadId = newLead?.id ?? newLead?.Id;
      // Apply tags sequentially
      if (leadId && selectedTagIds.length > 0) {
        for (const tagId of selectedTagIds) {
          await apiFetch(`/api/leads/${leadId}/tags`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tagId }),
          }).catch(() => {});
        }
      }
      toast({ title: t("addLead.created", "Lead created"), description: `${firstName} ${lastName}`.trim() });
      onCreated(newLead);
      onClose();
    } catch {
      toast({ title: t("addLead.createFailed", "Failed to create lead"), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (!mounted) return null;

  const inputCls = "neu-input w-full h-11 px-3 text-[14px]";
  const labelCls = "block mb-1";
  const labelStyle: React.CSSProperties = { fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--mute-2)" };

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="mobile-add-lead-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden fixed inset-0 z-[300] bg-black/50"
            onClick={onClose}
          />
          {/* Full-screen form panel */}
          <motion.div
            key="mobile-add-lead-form"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "tween", duration: 0.3, ease: [0.0, 0.0, 0.2, 1] }}
            data-testid="mobile-add-lead-form"
            className="lg:hidden fixed inset-x-0 bottom-0 z-[301] flex flex-col max-h-[92dvh]"
            style={{ paddingBottom: "calc(1.5rem + var(--safe-bottom))", background: "var(--bg)", borderTopLeftRadius: "var(--r-panel)", borderTopRightRadius: "var(--r-panel)", borderTop: "1px solid var(--line)", boxShadow: "0 -10px 40px rgba(60,45,25,0.20)" }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <span style={{ width: 40, height: 5, borderRadius: "var(--r-pill)", background: "var(--mute-2)", opacity: 0.6 }} />
            </div>

            {/* Header */}
            <div className="row shrink-0" style={{ justifyContent: "space-between", padding: "12px 20px", borderBottom: "1px solid var(--line)" }}>
              <span className="serif" style={{ fontSize: 22, color: "var(--ink)", letterSpacing: "-0.01em" }}>{t("addLead.title", "Add Lead")}</span>
              <button
                onClick={onClose}
                aria-label="Close"
                style={{ width: 38, height: 38, borderRadius: "var(--r-pill)", border: "none", cursor: "pointer", background: "var(--surface)", boxShadow: "var(--sh-raised-crisp)", color: "var(--mute)", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable form body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
              {/* First name */}
              <div>
                <label className={labelCls} style={labelStyle}>{t("contact.firstName", "First Name")} <span style={{ color: "var(--stage-lost)" }}>*</span></label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => { setFirstName(e.target.value); setErrors((p) => ({ ...p, firstName: undefined })); }}
                  placeholder={t("addLead.firstNamePlaceholder", "John")}
                  autoComplete="given-name"
                  className={inputCls}
                  style={errors.firstName ? { boxShadow: "inset 0 0 0 1.5px var(--stage-lost)" } : undefined}
                  data-testid="add-lead-first-name"
                />
                {errors.firstName && <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--stage-lost)" }}>{errors.firstName}</p>}
              </div>

              {/* Last name */}
              <div>
                <label className={labelCls} style={labelStyle}>{t("contact.lastName", "Last Name")}</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder={t("addLead.lastNamePlaceholder", "Doe")}
                  autoComplete="family-name"
                  className={inputCls}
                  data-testid="add-lead-last-name"
                />
              </div>

              {/* Phone (tel keyboard) */}
              <div>
                <label className={labelCls} style={labelStyle}>{t("contact.phone", "Phone")}</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => { setPhone(e.target.value); setErrors((p) => ({ ...p, phone: undefined })); }}
                  placeholder={t("addLead.phonePlaceholder", "+1 (555) 000-0000")}
                  autoComplete="tel"
                  inputMode="tel"
                  className={inputCls}
                  style={errors.phone ? { boxShadow: "inset 0 0 0 1.5px var(--stage-lost)" } : undefined}
                  data-testid="add-lead-phone"
                />
                {errors.phone && <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--stage-lost)" }}>{errors.phone}</p>}
              </div>

              {/* Email (email keyboard) */}
              <div>
                <label className={labelCls} style={labelStyle}>{t("contact.email", "Email")}</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("addLead.emailPlaceholder", "john@example.com")}
                  autoComplete="email"
                  inputMode="email"
                  className={inputCls}
                  data-testid="add-lead-email"
                />
              </div>

              {/* Campaign selector */}
              {campaigns.length > 0 && (
                <div>
                  <label className={labelCls} style={labelStyle}>{t("detailView.campaign", "Campaign")}</label>
                  <select
                    value={campaignId}
                    onChange={(e) => setCampaignId(e.target.value)}
                    className={cn(inputCls, "appearance-none pr-8")}
                    data-testid="add-lead-campaign"
                  >
                    <option value="">{t("addLead.noCampaign", "No campaign")}</option>
                    {campaigns.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Tags multi-select (pill toggles) */}
              {availableTags.length > 0 && (
                <div>
                  <label className={labelCls} style={labelStyle}>{t("detail.sections.tags", "Tags")}</label>
                  <div className="flex flex-wrap gap-2 mt-1" data-testid="add-lead-tags">
                    {availableTags.map((tag) => {
                      const hex = resolveColor(tag.color);
                      const selected = selectedTagIds.includes(tag.id);
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => toggleTag(tag.id)}
                          className={cn(
                            "inline-flex items-center px-3 py-1 rounded-full text-[12px] font-semibold border transition-colors",
                            selected
                              ? "opacity-100"
                              : "opacity-50 hover:opacity-75"
                          )}
                          style={{
                            backgroundColor: selected ? `${hex}22` : "transparent",
                            color: hex,
                            borderColor: `${hex}${selected ? "66" : "44"}`,
                          }}
                        >
                          {tag.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Submit button */}
            <div className="px-5 pt-3 shrink-0">
              <button
                onClick={handleSubmit}
                disabled={submitting}
                data-testid="add-lead-submit"
                className={cn("w-full", submitting && "pointer-events-none")}
                style={{
                  height: 52, borderRadius: "var(--r-surface)", border: "none", cursor: "pointer",
                  background: "var(--wine-grad)", boxShadow: "var(--sh-raised-medium)", color: "var(--paper)",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  fontFamily: "var(--mono)", fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700,
                  opacity: submitting ? 0.6 : 1,
                }}
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {submitting ? t("addLead.creating", "Creating…") : t("addLead.submit", "Add Lead")}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
