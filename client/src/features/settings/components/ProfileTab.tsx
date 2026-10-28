import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Clock } from "lucide-react";
import { hapticSave } from "@/lib/haptics";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiUtils";
import { mergeProfileIntoMe } from "@/lib/userIdentity";
import { cn } from "@/lib/utils";
import { SectionCard } from "@/components/crm/primitives";
import type { UserProfile } from "../types";
import { AvatarEditor } from "./AvatarEditor";
import { PersonalInfoCard } from "./PersonalInfoCard";
import { SecurityCard } from "./SecurityCard";
import { TwoFactorCard } from "./TwoFactorCard";

/**
 * Settings > Profile: who you are. Identity header (avatar) and personal info
 * with Save. The phone My profile also carries the password and two-factor
 * blocks (`withSecurity`); desktop Settings has them under Security. `flat`
 * renders it as sections on one surface instead of a stack of cards.
 */
export function ProfileTab({
  profile,
  onProfileUpdated,
  flat = false,
  withSecurity = true,
}: {
  profile: UserProfile;
  onProfileUpdated: (p: UserProfile) => void;
  flat?: boolean;
  withSecurity?: boolean;
}) {
  const { t } = useTranslation("settings");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [name, setName] = useState(profile.fullName1 ?? "");
  const [email, setEmail] = useState(profile.email ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl ?? "");
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      const res = await apiFetch(`/api/users/${profile.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName1: name.trim() || null,
          email: email.trim() || null,
          phone: phone.trim() || null,
          avatarUrl: avatarUrl.trim() || null,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Save failed (${res.status})`);
      }
      const updated: UserProfile = await res.json();
      onProfileUpdated(updated);
      setName(updated.fullName1 ?? "");
      setEmail(updated.email ?? "");
      setPhone(updated.phone ?? "");
      setAvatarUrl(updated.avatarUrl ?? "");

      // The nav bar reads the signed-in user from /api/auth/me: patch it now, then refetch.
      queryClient.setQueryData(["/api/auth/me"], (me: any) => mergeProfileIntoMe(me, updated));
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });

      hapticSave();
      toast({ variant: "success", title: t("profile.profileSaved"), description: t("profile.profileSavedDescription") });
    } catch (err: any) {
      toast({ variant: "destructive", title: t("profile.saveFailed"), description: err.message || t("profile.saveFailedDescription") });
    } finally {
      setIsSaving(false);
    }
  };

  const userInitials = (() => {
    const n = name || email || "U";
    const parts = n.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return (parts[0]?.[0] || "U").toUpperCase();
  })();

  const identity = (
    <>
      <AvatarEditor avatarUrl={avatarUrl} initials={userInitials} onChange={setAvatarUrl} />
      <div className="flex-1 min-w-0">
        <div className={cn("font-bold font-heading text-foreground truncate", flat ? "text-2xl" : "text-3xl")}>{name || t("profile.noName")}</div>
        <span className={cn(
          "inline-block mt-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full",
          profile.role === "Admin" ? "bg-brand-indigo/10 text-brand-indigo" :
          profile.role === "Manager" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" :
          profile.role === "Editor" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" :
          "bg-muted text-muted-foreground",
        )}>
          {profile.role || t("profile.userFallback")}
        </span>
        {profile.lastLoginAt && (
          <div className="text-[11px] text-muted-foreground/60 mt-1.5 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {t("profile.lastLogin")}: {new Date(profile.lastLoginAt).toLocaleDateString(undefined, { dateStyle: "medium" })}{", "}{new Date(profile.lastLoginAt).toLocaleTimeString(undefined, { timeStyle: "short" })}
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className={flat ? "space-y-7" : "space-y-4"} data-testid="tab-profile-content">
      {/* Avatar + identity */}
      {flat ? (
        <div className="flex items-center gap-4" data-testid="section-identity">{identity}</div>
      ) : (
        <SectionCard className="p-5 flex items-center gap-5" data-testid="section-identity">{identity}</SectionCard>
      )}

      <PersonalInfoCard
        name={name}
        email={email}
        phone={phone}
        onNameChange={setName}
        onEmailChange={setEmail}
        onPhoneChange={setPhone}
        onSave={handleSaveProfile}
        isSaving={isSaving}
        flat={flat}
      />

      {withSecurity && <SecurityCard email={email} flat={flat} />}
      {withSecurity && <TwoFactorCard flat={flat} />}
    </div>
  );
}
