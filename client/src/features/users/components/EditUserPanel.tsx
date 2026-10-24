// EditUserPanel: Settings > Users "Edit profile" form as a right-hand panel
// (UI_STANDARDS 3.7). The form state and the save call stay in SettingsTeamSection;
// this file only renders the fields.
import { useTranslation } from "react-i18next";
import { RightPanel } from "@/components/crm/primitives";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { AppUser } from "../types";

interface EditUserPanelProps {
  user: AppUser;
  onChange: (user: AppUser) => void;
  /** Role and status are editable by admins only. */
  isAdmin: boolean;
  /** Editing your own user: shows password and notification switches. */
  isSelf: boolean;
  roleOptions: readonly string[];
  onSave: () => void;
  onClose: () => void;
  className?: string;
}

export function EditUserPanel({ user, onChange, isAdmin, isSelf, roleOptions, onSave, onClose, className }: EditUserPanelProps) {
  const { t } = useTranslation(["users", "settings"]);

  return (
    <RightPanel
      title={t("editDialog.title", { name: user.fullName1 || user.email })}
      onClose={onClose}
      submitLabel={t("editDialog.saveChanges")}
      onSubmit={onSave}
      className={className}
      data-testid="edit-user-panel"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t("editDialog.fullName")}</Label>
          <Input value={user.fullName1 || ""} onChange={e => onChange({ ...user, fullName1: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>{t("editDialog.email")}</Label>
          <Input value={user.email || ""} onChange={e => onChange({ ...user, email: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>{t("editDialog.phone")}</Label>
          <Input value={user.phone || ""} onChange={e => onChange({ ...user, phone: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>{t("editDialog.timezone")}</Label>
          <Select value={user.timezone || ""} onValueChange={(val: any) => onChange({ ...user, timezone: val })}>
            <SelectTrigger><SelectValue placeholder={t("settings:profile.selectTimezone")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="America/Sao_Paulo">America/Sao Paulo</SelectItem>
              <SelectItem value="Europe/Amsterdam">Europe/Amsterdam</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t("editDialog.role")}</Label>
          <Select value={user.role || ""} onValueChange={(val: any) => onChange({ ...user, role: val })} disabled={!isAdmin}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {roleOptions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t("editDialog.status")}</Label>
          <Select value={user.status || ""} onValueChange={(val: any) => onChange({ ...user, status: val })} disabled={!isAdmin}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {isSelf && (
          <div className="space-y-2">
            <Label>{t("editDialog.password")}</Label>
            <Input type="password" placeholder={t("editDialog.passwordPlaceholder")} onChange={e => onChange({ ...user, password: e.target.value } as any)} />
          </div>
        )}
        {isSelf && (
          <div className="space-y-2 flex flex-col justify-end gap-4">
            <div className="flex items-center justify-between">
              <Label>{t("editDialog.emailNotifications")}</Label>
              <Switch checked={!!user.notificationEmail} onCheckedChange={checked => onChange({ ...user, notificationEmail: checked })} />
            </div>
            <div className="flex items-center justify-between">
              <Label>{t("editDialog.smsNotifications")}</Label>
              <Switch checked={!!user.notificationSms} onCheckedChange={checked => onChange({ ...user, notificationSms: checked })} />
            </div>
          </div>
        )}
      </div>
    </RightPanel>
  );
}
