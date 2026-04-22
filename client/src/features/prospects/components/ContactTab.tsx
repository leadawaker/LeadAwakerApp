import { useState } from "react";
import type React from "react";
import { User, Copy, Check, Sparkles, Loader2, X, Mail, Phone, Linkedin, Pencil, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "@/lib/apiUtils";
import { StructuredBrief } from "./StructuredBrief";
import { PostsCarousel } from "./PostsCarousel";
import { useRotatingLabel } from "@/hooks/useRotatingLabel";

interface ContactTabProps {
  prospect: Record<string, any>;
  slot: 1 | 2;
  prospectId: number;
  onRefresh?: () => void;
  loading?: boolean;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <button
      onClick={handleCopy}
      className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted"
      title="Copy"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3 text-muted-foreground/50" />}
    </button>
  );
}

function parseJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    return raw.split("\n").filter(Boolean);
  }
}

function ContactField({
  icon, value, placeholder, href, type, fieldKey, prospectId, slot, onRefresh, manualFlagKey, setManualFlag,
}: {
  icon: React.ReactNode;
  value: string;
  placeholder: string;
  href?: string;
  type?: string;
  fieldKey: string;
  prospectId: number;
  slot: 1 | 2;
  onRefresh?: () => void;
  manualFlagKey?: string;
  setManualFlag?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (draft.trim() === value) { setEditing(false); return; }
    setSaving(true);
    try {
      // Only auto-flag as manual when the slot's field was previously empty (first typed value),
      // not when the user is fixing a typo on an already-populated value.
      const payload: Record<string, unknown> = { [fieldKey]: draft.trim() };
      if (manualFlagKey && setManualFlag) {
        payload[manualFlagKey] = true;
      }
      await apiFetch(`/api/prospects/${prospectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      onRefresh?.();
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="shrink-0 text-muted-foreground/40">{icon}</span>
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { setDraft(value); setEditing(false); } }}
          type={type || "text"}
          className="flex-1 min-w-0 h-6 px-1.5 rounded border border-border bg-background text-[11px] focus:outline-none focus:ring-1 focus:ring-brand-indigo/40"
        />
        {saving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground/40 shrink-0" />}
      </div>
    );
  }

  return (
    <div className="group relative flex items-center gap-1.5">
      <span className="shrink-0 text-muted-foreground/40">{icon}</span>
      {value ? (
        href ? (
          <a
            href={href}
            target={type === "url" ? "_blank" : undefined}
            rel="noopener noreferrer"
            className="text-[11px] text-foreground/70 hover:text-foreground truncate"
          >{value}</a>
        ) : (
          <span className="text-[11px] text-foreground/70 truncate">{value}</span>
        )
      ) : (
        <span className="text-[11px] text-muted-foreground/30 italic">{placeholder}</span>
      )}
      <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-slate-900 rounded pl-1 shadow-sm">
        {value && <CopyButton text={value} />}
        <button
          onClick={() => { setDraft(value); setEditing(true); }}
          className="p-1 rounded hover:bg-muted"
          title="Edit"
        >
          <Pencil className="h-3 w-3 text-muted-foreground/50" />
        </button>
      </div>
    </div>
  );
}

function ContactFields({ email, phone, linkedin, prospectId, slot, onRefresh, manualFlagKey, shouldAutoFlag }: {
  email: string; phone: string; linkedin: string;
  prospectId: number; slot: 1 | 2; onRefresh?: () => void;
  manualFlagKey: string;
  shouldAutoFlag: { email: boolean; phone: boolean; linkedin: boolean };
}) {
  const prefix = slot === 1 ? "contact" : "contact2";
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex-1 min-w-0">
          <ContactField icon={<Mail className="h-3 w-3" />} value={email || ""} placeholder="Add email" href={email ? `mailto:${email}` : undefined} fieldKey={`${prefix}_email`} prospectId={prospectId} slot={slot} onRefresh={onRefresh} manualFlagKey={manualFlagKey} setManualFlag={shouldAutoFlag.email} />
        </div>
        <div className="w-px h-3 bg-border/40 shrink-0" />
        <div className="flex-1 min-w-0">
          <ContactField icon={<Phone className="h-3 w-3" />} value={phone || ""} placeholder="Add phone" href={phone ? `tel:${phone}` : undefined} fieldKey={`${prefix}_phone`} prospectId={prospectId} slot={slot} onRefresh={onRefresh} manualFlagKey={manualFlagKey} setManualFlag={shouldAutoFlag.phone} />
        </div>
      </div>
      <ContactField icon={<Linkedin className="h-3 w-3" />} value={linkedin || ""} placeholder="Add LinkedIn URL" href={linkedin || undefined} type="url" fieldKey={`${prefix}_linkedin`} prospectId={prospectId} slot={slot} onRefresh={onRefresh} manualFlagKey={manualFlagKey} setManualFlag={shouldAutoFlag.linkedin} />
    </div>
  );
}

export function ContactTab({ prospect, slot, prospectId, onRefresh, loading: parentLoading }: ContactTabProps) {
  const { t } = useTranslation("prospects");

  const prefix = slot === 1 ? "" : "contact2_";
  const linkedinUrl = slot === 1 ? prospect.contact_linkedin : prospect.contact2_linkedin;
  const contactName = slot === 1 ? prospect.contact_name : prospect.contact2_name;
  const photoUrl = prospect[`${prefix}photo_url`];
  const headline = prospect[`${prefix}headline`];
  const connectionCount = prospect[`${prefix}connection_count`];
  const followerCount = prospect[`${prefix}follower_count`];
  const contactEmail = slot === 1 ? prospect.contact_email : prospect.contact2_email;
  const contactPhone = slot === 1 ? prospect.contact_phone : prospect.contact2_phone;
  const isManual = slot === 1 ? !!prospect.contact_manual : !!prospect.contact2_manual;
  const manualFlagKey = slot === 1 ? "contact_manual" : "contact2_manual";
  const shouldAutoFlag = {
    email: !contactEmail,
    phone: !contactPhone,
    linkedin: !linkedinUrl,
  };

  async function releaseManual() {
    await apiFetch(`/api/prospects/${prospectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [manualFlagKey]: false }),
    });
    onRefresh?.();
  }
  const topPost = prospect[`${prefix}top_post`];
  const topPostData = prospect[`${prefix}top_post_data`];
  const personBriefRaw = prospect[`${prefix}person_brief`] as string | null | undefined;
  const personBriefBullets = parseJsonArray(personBriefRaw);
  // New structured format uses labeled lines like "ROLE:" / "BACKGROUND:" — detect with a quick regex
  const isStructuredBrief = !!personBriefRaw && /^[A-Z][A-Z0-9 /&-]{1,40}:/m.test(personBriefRaw);

  const [enriching, setEnriching] = useState(false);
  const [zoomed, setZoomed] = useState(false);

  async function handleEnrich() {
    if (enriching) return;
    setEnriching(true);
    try {
      await apiFetch(`/api/prospects/${prospectId}/enrich`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "linkedin", contactSlot: slot }),
      });
      onRefresh?.();
    } catch {
      // silent
    } finally {
      setEnriching(false);
    }
  }

  const showSpinner = parentLoading || enriching;
  const contactSteps = t("companyTab.loadingContactSteps", { returnObjects: true, defaultValue: [] }) as unknown;
  const contactStepLabels = Array.isArray(contactSteps) ? (contactSteps as string[]) : [];
  const fallbackContactLabel = t("companyTab.loadingContact", "Enriching contact {{slot}}...", { slot });
  const spinnerLabel = useRotatingLabel(
    contactStepLabels.length > 0 ? contactStepLabels : [fallbackContactLabel],
    showSpinner,
  );

  // No LinkedIn URL set: allow manual seeding of name/role/email/phone/linkedin
  if (!linkedinUrl) {
    const prefix = slot === 1 ? "contact" : "contact2";
    const contactRoleVal = slot === 1 ? prospect.contact_role : prospect.contact2_role;
    const shouldAutoFlagEmpty = {
      name: !contactName,
      role: !contactRoleVal,
      email: !contactEmail,
      phone: !contactPhone,
      linkedin: !linkedinUrl,
    };
    return (
      <div className="relative flex flex-col gap-2 py-2">
        {showSpinner && <LoadingOverlay label={spinnerLabel} />}
        <div className="flex items-center gap-2 flex-wrap">
          <User className="h-4 w-4 text-muted-foreground/30" />
          <span className="text-[11px] text-muted-foreground/60">
            {t("contact.manualEntryHint", "Fill any field to start this contact")}
          </span>
          {isManual && (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"
              title={t("contact.manualTooltip", "Enrichment will not overwrite manually-entered fields")}
            >
              <Lock className="h-2.5 w-2.5" />
              {t("contact.manual", "Manual")}
              <button
                onClick={releaseManual}
                className="ml-0.5 rounded hover:bg-amber-500/20 transition-colors"
                title={t("contact.releaseManual", "Allow enrichment to overwrite on next run")}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1 rounded-md border border-border/40 bg-muted/10 p-2">
          <ContactField icon={<User className="h-3 w-3" />} value={contactName || ""} placeholder={t("contact.fieldName", "Add name")} fieldKey={`${prefix}_name`} prospectId={prospectId} slot={slot} onRefresh={onRefresh} manualFlagKey={manualFlagKey} setManualFlag={shouldAutoFlagEmpty.name} />
          <ContactField icon={<Pencil className="h-3 w-3" />} value={contactRoleVal || ""} placeholder={t("contact.fieldRole", "Add role")} fieldKey={`${prefix}_role`} prospectId={prospectId} slot={slot} onRefresh={onRefresh} manualFlagKey={manualFlagKey} setManualFlag={shouldAutoFlagEmpty.role} />
          <ContactField icon={<Mail className="h-3 w-3" />} value={contactEmail || ""} placeholder={t("contact.fieldEmail", "Add email")} href={contactEmail ? `mailto:${contactEmail}` : undefined} fieldKey={`${prefix}_email`} prospectId={prospectId} slot={slot} onRefresh={onRefresh} manualFlagKey={manualFlagKey} setManualFlag={shouldAutoFlagEmpty.email} />
          <ContactField icon={<Phone className="h-3 w-3" />} value={contactPhone || ""} placeholder={t("contact.fieldPhone", "Add phone")} href={contactPhone ? `tel:${contactPhone}` : undefined} fieldKey={`${prefix}_phone`} prospectId={prospectId} slot={slot} onRefresh={onRefresh} manualFlagKey={manualFlagKey} setManualFlag={shouldAutoFlagEmpty.phone} />
          <ContactField icon={<Linkedin className="h-3 w-3" />} value={linkedinUrl || ""} placeholder={t("contact.fieldLinkedin", "Add LinkedIn URL")} type="url" fieldKey={`${prefix}_linkedin`} prospectId={prospectId} slot={slot} onRefresh={onRefresh} manualFlagKey={manualFlagKey} setManualFlag={shouldAutoFlagEmpty.linkedin} />
        </div>
        {(contactName || linkedinUrl) && (
          <button
            onClick={handleEnrich}
            disabled={enriching}
            className="self-start inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium bg-brand-indigo/10 text-brand-indigo hover:bg-brand-indigo/20 transition-colors disabled:opacity-50"
          >
            {enriching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            {linkedinUrl
              ? t("contact.enrichLinkedin", "Enrich LinkedIn")
              : t("contact.enrichByName", "Find LinkedIn and enrich")}
          </button>
        )}
      </div>
    );
  }

  // LinkedIn URL exists but no data enriched yet
  const hasData = !!(headline || photoUrl || personBriefRaw || topPostData);
  if (!hasData) {
    return (
      <div className="relative flex flex-col items-center justify-center py-8 text-center gap-2">
        {showSpinner && <LoadingOverlay label={spinnerLabel} />}
        <Sparkles className="h-6 w-6 text-muted-foreground/20" />
        <p className="text-[11px] text-muted-foreground/40 italic">
          {t("contact.enrichHint", "Enrich LinkedIn to see contact insights")}
        </p>
        <button
          onClick={handleEnrich}
          disabled={enriching}
          className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium bg-brand-indigo/10 text-brand-indigo hover:bg-brand-indigo/20 transition-colors disabled:opacity-50"
        >
          {enriching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
          {t("contact.enrichLinkedin", "Enrich LinkedIn")}
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col gap-2.5">
      {showSpinner && <LoadingOverlay label={spinnerLabel} />}
      {/* Name + manual pill */}
      <div className="flex items-center gap-2 flex-wrap">
        {contactName && (
          <p className="text-[16px] font-semibold text-foreground">{contactName}</p>
        )}
        {isManual && (
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"
            title={t("contact.manualTooltip", "Enrichment will not overwrite manually-entered fields")}
          >
            <Lock className="h-2.5 w-2.5" />
            {t("contact.manual", "Manual")}
            <button
              onClick={releaseManual}
              className="ml-0.5 rounded hover:bg-amber-500/20 transition-colors"
              title={t("contact.releaseManual", "Allow enrichment to overwrite on next run")}
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        )}
      </div>
      {/* Photo + headline */}
      <div className="flex items-start gap-3.5">
        {photoUrl && (
          <>
            <img
              src={photoUrl}
              alt={contactName || ""}
              className="w-20 h-20 rounded-full object-cover shrink-0 border border-border/30 cursor-zoom-in"
              onClick={() => setZoomed(true)}
              title="Click to enlarge"
            />
            {zoomed && (
              <div
                className="fixed inset-0 z-50 flex items-end justify-center pb-16 pt-24"
                onClick={() => setZoomed(false)}
              >
                <div className="relative max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
                  <img
                    src={photoUrl}
                    alt={contactName || ""}
                    className="w-full rounded-2xl object-cover shadow-2xl"
                  />
                  {contactName && (
                    <p className="text-center text-foreground/70 text-[13px] font-medium mt-2">{contactName}</p>
                  )}
                  <button
                    onClick={() => setZoomed(false)}
                    className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-white border border-border text-foreground flex items-center justify-center hover:bg-muted transition-colors shadow-sm"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          {headline && (
            <p className="text-[12px] font-medium text-foreground leading-snug">{headline}</p>
          )}
          {(connectionCount || followerCount) && (
            <div className="flex gap-3">
              {connectionCount && (
                <span className="text-[10px] text-muted-foreground">
                  <span className="font-semibold text-foreground">{Number(connectionCount).toLocaleString()}</span> connections
                </span>
              )}
              {followerCount && (
                <span className="text-[10px] text-muted-foreground">
                  <span className="font-semibold text-foreground">{Number(followerCount).toLocaleString()}</span> followers
                </span>
              )}
            </div>
          )}
          <ContactFields
            email={contactEmail}
            phone={contactPhone}
            linkedin={linkedinUrl}
            prospectId={prospectId}
            slot={slot}
            onRefresh={onRefresh}
            manualFlagKey={manualFlagKey}
            shouldAutoFlag={shouldAutoFlag}
          />
        </div>
      </div>

      {/* Top posts carousel (structured JSON) with legacy text fallback */}
      {topPostData ? (
        <>
          <div className="h-px bg-border/30" />
          <PostsCarousel posts={topPostData} label={t("companyTab.topLinkedInPosts", "Top LinkedIn Posts")} />
        </>
      ) : topPost ? (
        <>
          <div className="h-px bg-border/30" />
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
            {t("fields.topPost")}
          </h4>
          <div className="group flex items-start gap-1.5 p-2.5 rounded-lg bg-muted/30 border-l-2 border-brand-indigo/20">
            <p className="flex-1 text-[11px] text-foreground/70 leading-relaxed italic">{topPost}</p>
            <CopyButton text={topPost} />
          </div>
        </>
      ) : null}

      {/* Person brief: categorized structured view for new format, legacy bullets otherwise */}
      {personBriefRaw && (
        <>
          <div className="h-px bg-border/30" />
          {isStructuredBrief ? (
            <StructuredBrief text={personBriefRaw} title={contactName ? t("companyTab.aboutContact", "About {{name}}", { name: contactName }) : undefined} />
          ) : personBriefBullets.length > 0 ? (
            <ul className="flex flex-col gap-1">
              {personBriefBullets.map((bullet, i) => (
                <li key={i} className="flex items-start gap-1.5 text-[11px] text-foreground/80 leading-snug">
                  <span className="mt-1 w-1 h-1 rounded-full bg-brand-indigo/40 shrink-0" />
                  {bullet}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[11px] text-foreground/70 leading-relaxed whitespace-pre-wrap">{personBriefRaw}</p>
          )}
        </>
      )}

      {/* Re-enrich button */}
      <div className="pt-1">
        <button
          onClick={handleEnrich}
          disabled={enriching}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
        >
          {enriching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
          {t("contact.enrichLinkedin", "Enrich LinkedIn")}
        </button>
      </div>
    </div>
  );
}

function LoadingOverlay({ label }: { label: string }) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col gap-2 bg-background/85 backdrop-blur-[1px] rounded-md p-2 overflow-hidden">
      <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-brand-indigo/5 border border-brand-indigo/20 text-brand-indigo text-[11px] font-medium">
        <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
        <span className="truncate">{label}</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="w-16 h-16 rounded-full bg-brand-indigo/10 border border-dashed border-brand-indigo/30 animate-pulse shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="h-2.5 w-1/2 rounded bg-brand-indigo/20 animate-pulse" />
          <div className="h-2 w-2/3 rounded bg-brand-indigo/10 animate-pulse" />
        </div>
      </div>
      <div className="space-y-1.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="w-full p-2 rounded-lg border border-dashed border-brand-indigo/30 bg-brand-indigo/5 animate-pulse">
            <div className="h-2.5 w-1/3 rounded bg-brand-indigo/20 mb-1.5" />
            <div className="h-2 w-full rounded bg-brand-indigo/10 mb-1" />
            <div className="h-2 w-2/3 rounded bg-brand-indigo/10" />
          </div>
        ))}
      </div>
    </div>
  );
}
