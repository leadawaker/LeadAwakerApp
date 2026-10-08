import { useTranslation } from "react-i18next";
import { Mail, Phone, User, IdCard } from "lucide-react";
import { Field } from "./SettingsFields";
import { SettingsCard } from "./SettingsCard";

/** Name, email and phone fields with the Save button (Profile tab). */
export function PersonalInfoCard({
  name,
  email,
  phone,
  onNameChange,
  onEmailChange,
  onPhoneChange,
  onSave,
  isSaving,
}: {
  name: string;
  email: string;
  phone: string;
  onNameChange: (v: string) => void;
  onEmailChange: (v: string) => void;
  onPhoneChange: (v: string) => void;
  onSave: () => void;
  isSaving: boolean;
}) {
  const { t } = useTranslation("settings");

  return (
    <SettingsCard
      icon={IdCard}
      title={t("profile.personalInfo")}
      description={t("profile.personalInfoDescription")}
      data-testid="section-personal-info"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-onboarding="profile-name">
        <Field
          label={t("profile.fullName")}
          value={name}
          onChange={onNameChange}
          testId="input-profile-name"
          placeholder={t("profile.fullNamePlaceholder")}
          icon={User}
        />
        <Field
          label={t("profile.email")}
          value={email}
          onChange={onEmailChange}
          testId="input-profile-email"
          placeholder="your@email.com"
          type="email"
          icon={Mail}
        />
        <Field
          label={t("profile.phone")}
          value={phone}
          onChange={onPhoneChange}
          testId="input-profile-phone"
          placeholder="+1 (555) 000-0000"
          type="tel"
          icon={Phone}
        />
      </div>

      <div className="flex justify-end pt-1">
        <button
          type="button"
          className="la-btn la-btn--wine la-btn--lg la-btn--pill disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="button-save-profile"
          data-onboarding="save-profile"
          onClick={onSave}
          disabled={isSaving}
        >
          {isSaving ? t("profile.saving") : t("profile.saveChanges")}
        </button>
      </div>
    </SettingsCard>
  );
}
